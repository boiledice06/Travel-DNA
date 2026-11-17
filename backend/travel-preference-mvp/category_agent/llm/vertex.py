"""Google Vertex AI adapter via google-genai (ADC / gcloud application-default)."""
from __future__ import annotations

import os
from typing import Optional

from google import genai
from google.genai import types

from .base import LlmMessage, LlmResponse


def _normalize_model(name: str) -> str:
    # Aider-style "vertex_ai/gemini-3.8-flash" → "gemini-3.8-flash"
    n = (name or "").strip()
    if "/" in n:
        n = n.split("/", 1)[1]
    return n or "gemini-3.8-flash"


class VertexChatModel:
    provider = "vertex"

    def __init__(
        self,
        *,
        project: Optional[str] = None,
        location: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.project = (
            project
            or os.getenv("VERTEXAI_PROJECT")
            or os.getenv("GOOGLE_CLOUD_PROJECT")
            or ""
        ).strip()
        self.location = (
            location
            or os.getenv("VERTEXAI_LOCATION")
            or os.getenv("GOOGLE_CLOUD_LOCATION")
            or "global"
        ).strip()
        self.model = _normalize_model(
            model
            or os.getenv("VERTEXAI_MODEL")
            or os.getenv("TRAVEL_MVP_LLM_MODEL")
            or "gemini-3.8-flash"
        )
        if not self.project:
            raise RuntimeError(
                "VERTEXAI_PROJECT (or GOOGLE_CLOUD_PROJECT) is required for Vertex ADC."
            )
        # google-genai Vertex path uses ADC when no api_key is passed
        os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", self.project)
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", self.location)
        self._client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )

    def complete(
        self,
        messages: list[LlmMessage],
        *,
        temperature: float = 0.4,
        response_json: bool = False,
    ) -> LlmResponse:
        system_parts = [m.content for m in messages if m.role == "system"]
        contents: list[types.Content] = []
        for m in messages:
            if m.role == "system":
                continue
            role = "model" if m.role == "assistant" else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=m.content)])
            )
        if not contents:
            raise ValueError("At least one user/assistant message is required")

        config_kwargs: dict = {"temperature": temperature}
        if system_parts:
            config_kwargs["system_instruction"] = "\n\n".join(system_parts)
        if response_json:
            config_kwargs["response_mime_type"] = "application/json"

        resp = self._client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(**config_kwargs),
        )
        text = (resp.text or "").strip()
        return LlmResponse(text=text, model=self.model, provider=self.provider, raw=resp)
