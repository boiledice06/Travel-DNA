"""Gemini Developer API adapter using an API key, not Vertex ADC."""
import os

from google import genai
from google.genai import errors
from google.genai import types

from .vertex import VertexChatModel


class GeminiChatModel(VertexChatModel):
    provider = "gemini"

    def __init__(self, *, api_key: str | None = None, model: str | None = None):
        key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self.model = (model or os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite").strip()
        self._client = genai.Client(
            vertexai=False, api_key=key, http_options=types.HttpOptions(api_version="v1beta")
        )

    def complete(self, messages, *, temperature=0.4, response_json=False):
        try:
            return super().complete(messages, temperature=temperature, response_json=response_json)
        except errors.APIError as exc:
            # Avoid returning provider bodies or request data containing credentials.
            raise RuntimeError(f"Gemini HTTP {exc.code}") from None
