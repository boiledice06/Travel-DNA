"""Resolve ChatModel from env; default to the Gemini Developer API."""
from __future__ import annotations

import os

from .base import ChatModel


def get_chat_model(provider: str | None = None) -> ChatModel:
    name = (provider or os.getenv("TRAVEL_MVP_LLM_PROVIDER") or "gemini").strip().lower()
    if name in {"gemini", "gemini_developer"}:
        from .gemini import GeminiChatModel

        return GeminiChatModel()
    if name in {"vertex", "vertexai", "google_vertex"}:
        from .vertex import VertexChatModel

        return VertexChatModel()
    raise ValueError(
        f"Unknown TRAVEL_MVP_LLM_PROVIDER={name!r}. "
        "Implemented: gemini, vertex."
    )
