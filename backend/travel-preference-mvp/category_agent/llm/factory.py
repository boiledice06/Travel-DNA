"""Resolve ChatModel from env. Default: Vertex. Swap later without changing callers."""
from __future__ import annotations

import os

from .base import ChatModel


def get_chat_model(provider: str | None = None) -> ChatModel:
    name = (provider or os.getenv("TRAVEL_MVP_LLM_PROVIDER") or "vertex").strip().lower()
    if name in {"vertex", "vertexai", "google_vertex"}:
        from .vertex import VertexChatModel

        return VertexChatModel()
    raise ValueError(
        f"Unknown TRAVEL_MVP_LLM_PROVIDER={name!r}. "
        "Implemented now: vertex. Add another adapter under category_agent/llm/ to swap."
    )
