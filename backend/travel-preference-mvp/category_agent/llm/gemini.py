"""Bounded Gemini Developer API calls with sanitized diagnostics."""
import importlib
import json
import logging
import os
import random
import time

from google import genai
from google.genai import errors, types

from .upstream import ModelFailure
from .vertex import VertexChatModel

_ATTEMPT_SECONDS = 12
_TOTAL_SECONDS = 27
_MAX_ATTEMPTS = 3
_LOG = logging.getLogger("uvicorn.error")


def _transport_errors():
    installed = []
    for name in ("httpx", "httpx2"):
        try:
            installed.append(importlib.import_module(name))
        except ImportError:
            continue
    return (
        tuple(error for http in installed for error in (http.ConnectError, http.ConnectTimeout, http.PoolTimeout)),
        tuple(http.TimeoutException for http in installed),
        tuple(http.TransportError for http in installed),
    )


_CONNECT_ERRORS, _TIMEOUT_ERRORS, _TRANSPORT_ERRORS = _transport_errors()


def classify_gemini_error(exc: errors.APIError) -> ModelFailure:
    code = exc.code
    detail = exc.details
    if isinstance(detail, dict):
        detail = detail.get("error", detail)
    reasons = detail.get("details", []) if isinstance(detail, dict) else detail
    reason_codes = {
        item.get("reason") for item in reasons if isinstance(item, dict)
    } if isinstance(reasons, list) else set()
    if code in (401, 403) or reason_codes & {
        "API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED",
        "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED",
        "CREDENTIALS_MISSING", "ACCESS_TOKEN_EXPIRED",
    } or (code == 400 and "api key" in str(exc.message or "").lower()):
        kind = "model_auth"
    elif code == 429:
        kind = "model_rate_limit"
    elif code in (500, 502, 503, 504):
        kind = "model_unavailable"
    elif code == 408:
        kind = "model_timeout"
    elif code == 404:
        kind = "model_not_found"
    else:
        kind = "model_request"
    return ModelFailure(kind, code)


class GeminiChatModel(VertexChatModel):
    provider = "gemini"

    def __init__(self, *, api_key: str | None = None, model: str | None = None):
        key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
        if not key:
            raise ModelFailure("model_auth")
        self.model = (model or os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite").strip()
        self._client = genai.Client(
            vertexai=False,
            api_key=key,
            http_options=types.HttpOptions(
                api_version="v1beta",
                timeout=_ATTEMPT_SECONDS * 1000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def complete(self, messages, *, temperature=0.4, response_json=False):
        started = time.monotonic()
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                result = super().complete(messages, temperature=temperature, response_json=response_json)
                if not result.text:
                    raise ModelFailure("model_output")
                if response_json:
                    candidate = result.text
                    if candidate.startswith("```") and candidate.endswith("```"):
                        candidate = candidate.partition("\n")[2][:-3]
                    try:
                        parsed = json.loads(candidate)
                    except (ValueError, RecursionError):
                        raise ModelFailure("model_output") from None
                    if not isinstance(parsed, (dict, list)):
                        raise ModelFailure("model_output")
            except errors.APIError as exc:
                failure = classify_gemini_error(exc)
            except _CONNECT_ERRORS:
                failure = ModelFailure("model_connect")
            except _TIMEOUT_ERRORS:
                # A read timeout has an unknown result. Avoid sending a second generation.
                failure = ModelFailure("model_timeout")
            except _TRANSPORT_ERRORS:
                failure = ModelFailure("model_transport")
            except ModelFailure as exc:
                failure = exc
            else:
                _LOG.info("gemini outcome=success attempt=%d elapsed_ms=%d", attempt, (time.monotonic() - started) * 1000)
                return result
            delay = 0.35 * 2 ** (attempt - 1) + random.uniform(0, 0.12)
            retry = (
                failure.transient and attempt < _MAX_ATTEMPTS
                and time.monotonic() - started + delay + _ATTEMPT_SECONDS <= _TOTAL_SECONDS
            )
            _LOG.warning("gemini outcome=%s upstream_status=%s attempt=%d retry=%s elapsed_ms=%d",
                         failure.code, failure.provider_status, attempt, retry,
                         (time.monotonic() - started) * 1000)
            if not retry:
                raise failure from None
            time.sleep(delay)
