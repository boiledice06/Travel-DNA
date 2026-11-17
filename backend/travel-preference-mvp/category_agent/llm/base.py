"""Swappable chat-model abstraction. Product code depends on this, not a vendor SDK."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True)
class LlmMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass(frozen=True)
class LlmResponse:
    text: str
    model: str
    provider: str
    raw: Optional[object] = None


@runtime_checkable
class ChatModel(Protocol):
    """Thin adapter contract — swap Vertex / OpenAI / etc. behind this."""

    provider: str
    model: str

    def complete(
        self,
        messages: list[LlmMessage],
        *,
        temperature: float = 0.4,
        response_json: bool = False,
    ) -> LlmResponse: ...
