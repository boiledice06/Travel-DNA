"""Conversational Travel DNA discovery — Likert → adaptive chat → constraints."""
from __future__ import annotations

import json
import re
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from .dna import _parse_dna, extract_travel_dna
from .likert import (
    FollowupItem,
    LikertAnswer,
    build_followups,
    first_followup_prompt,
    likert_items_public,
    seed_dna_from_likert,
    validate_likert_answers,
)
from .llm import ChatModel, LlmMessage, get_chat_model
from .schemas import TravelDNA
from .store import load_session_dict, save_session_dict

ChatPhase = Literal["likert", "asking", "constraints", "draft", "confirmed"]

MAX_TURNS_BEFORE_CONSTRAINTS = 3
HARD_MAX_ASK_TURNS = 5

_TURN_SYSTEM = """You are a short Korean taste interviewer for Travel DNA.
The user already filled a Likert form; seed_dna and remaining followups are provided.
Ask ONE question per turn about concrete preferences (what specifically they like).
Offer 2 contrast chips when useful.
Never ask trip logistics (party, budget, lodging, transport) — taste only.
Do not re-ask dimensions already covered unless contradicting.
Return JSON only:
{
  "phase": "ask" | "constraints",
  "assistant_message": "short Korean question",
  "chips": ["chipA","chipB"],
  "draft_dna": null | {
    "pillars": {"do_play":0-1,"see_learn":0-1,"stay_vibe":0-1,"eat_local":0-1},
    "axes": {"authenticity":-1..1,"energy":-1..1,"density":-1..1,"novelty":-1..1,"setting":-1..1},
    "micro_keywords": ["tag"]
  }
}
Rules:
- Prefer remaining followups; gather micro_keywords (concrete tags).
- When followups are done or enough specifics collected, set phase=constraints
  (do NOT finalize DNA yet — must_have/must_avoid come next).
- Keep updating draft_dna from seed + new answers when useful.
- Keep messages under 2 sentences. No essays.
"""


class ChatMessage(BaseModel):
    role: Literal["assistant", "user"]
    content: str
    chips: List[str] = Field(default_factory=list)


class DnaChatSession(BaseModel):
    session_id: str
    phase: ChatPhase = "likert"
    turn: int = 0
    messages: List[ChatMessage] = Field(default_factory=list)
    likert_answers: Optional[dict[str, int]] = None
    seed_dna: Optional[TravelDNA] = None
    followups: List[FollowupItem] = Field(default_factory=list)
    draft_dna: Optional[TravelDNA] = None
    confirmed_dna: Optional[TravelDNA] = None
    must_have: Optional[str] = Field(default=None, max_length=500)
    must_avoid: Optional[str] = Field(default=None, max_length=500)
    constraints_submitted: bool = False
    provider: Optional[str] = None
    model: Optional[str] = None

    @field_validator("must_have", "must_avoid", mode="before")
    @classmethod
    def _blank_to_none(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class DnaChatStartResponse(BaseModel):
    session_id: str
    phase: ChatPhase
    turn: int
    assistant_message: str = ""
    chips: List[str] = Field(default_factory=list)
    likert_items: List[dict] = Field(default_factory=list)
    scale_labels: dict[int, str] = Field(default_factory=dict)


class DnaChatLikertRequest(BaseModel):
    session_id: str
    answers: List[LikertAnswer]


class DnaChatLikertResponse(BaseModel):
    session_id: str
    phase: ChatPhase
    turn: int
    assistant_message: str
    chips: List[str] = Field(default_factory=list)
    seed_dna: Optional[TravelDNA] = None
    draft_dna: Optional[TravelDNA] = None
    followups: List[FollowupItem] = Field(default_factory=list)


class DnaChatMessageRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1)
    chip: Optional[str] = None


class DnaChatMessageResponse(BaseModel):
    session_id: str
    phase: ChatPhase
    turn: int
    assistant_message: str
    chips: List[str] = Field(default_factory=list)
    draft_dna: Optional[TravelDNA] = None
    must_have: Optional[str] = None
    must_avoid: Optional[str] = None


class DnaChatConstraintsRequest(BaseModel):
    session_id: str
    must_have: Optional[str] = Field(default=None, max_length=500)
    must_avoid: Optional[str] = Field(default=None, max_length=500)

    @field_validator("must_have", "must_avoid", mode="before")
    @classmethod
    def _blank_to_none(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class DnaChatConstraintsResponse(BaseModel):
    session_id: str
    phase: ChatPhase
    turn: int
    assistant_message: str
    chips: List[str] = Field(default_factory=list)
    draft_dna: Optional[TravelDNA] = None
    must_have: Optional[str] = None
    must_avoid: Optional[str] = None


class DnaChatFinalizeRequest(BaseModel):
    session_id: str
    confirm: bool = True
    edits: Optional[TravelDNA] = None


class DnaChatFinalizeResponse(BaseModel):
    session_id: str
    phase: ChatPhase
    travel_dna: TravelDNA
    must_have: Optional[str] = None
    must_avoid: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


def _strip_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _session_to_dict(s: DnaChatSession) -> dict:
    return s.model_dump()


def _session_from_dict(data: dict) -> DnaChatSession:
    return DnaChatSession.model_validate(data)


def _save(session: DnaChatSession) -> None:
    save_session_dict(session.session_id, _session_to_dict(session))


def _load(session_id: str) -> DnaChatSession:
    raw = load_session_dict(session_id)
    if raw is None:
        raise KeyError(f"session not found: {session_id}")
    return _session_from_dict(raw)


def _transcript(session: DnaChatSession) -> str:
    lines = []
    for m in session.messages:
        lines.append(f"{m.role}: {m.content}")
    return "\n".join(lines)


def _parse_turn(raw: str) -> dict:
    data = json.loads(_strip_fence(raw))
    if not isinstance(data, dict):
        raise ValueError("chat turn JSON must be an object")
    phase = data.get("phase") or "ask"
    if phase not in ("ask", "constraints", "draft"):
        phase = "ask"
    # Legacy "draft" from LLM → treat as ready for constraints
    if phase == "draft":
        phase = "constraints"
    msg = str(data.get("assistant_message") or "").strip() or "어떤 분위기를 더 좋아하세요?"
    chips = [str(c).strip() for c in (data.get("chips") or []) if str(c).strip()][:4]
    draft = data.get("draft_dna")
    return {"phase": phase, "assistant_message": msg, "chips": chips, "draft_dna": draft}


def _constraints_prompt() -> tuple[str, list[str]]:
    return (
        "이제 필수적으로 필요한 것(꼭 원하는 것)과 피해야 하는 것을 적어 주세요. "
        "없으면 ‘없음’이라고 적어 주셔도 됩니다.",
        ["없음"],
    )


def start_dna_chat(*, llm: Optional[ChatModel] = None) -> DnaChatStartResponse:
    """Start in likert phase — no first chat question."""
    del llm
    from .likert import SCALE_LABELS_KO

    session_id = uuid4().hex[:12]
    session = DnaChatSession(
        session_id=session_id,
        phase="likert",
        turn=0,
        messages=[],
    )
    _save(session)
    return DnaChatStartResponse(
        session_id=session_id,
        phase=session.phase,
        turn=session.turn,
        assistant_message="먼저 아래 5문항에 답해 주세요.",
        chips=[],
        likert_items=likert_items_public(),
        scale_labels=dict(SCALE_LABELS_KO),
    )


def submit_likert(
    req: DnaChatLikertRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> DnaChatLikertResponse:
    del llm
    session = _load(req.session_id)
    if session.phase != "likert":
        raise ValueError(f"likert only allowed in phase=likert (got {session.phase})")

    answers = validate_likert_answers(req.answers)
    seed = seed_dna_from_likert(answers)
    followups = build_followups(answers, seed)
    q, chips = first_followup_prompt(followups)

    session.likert_answers = answers
    session.seed_dna = seed
    session.draft_dna = seed
    session.followups = followups
    session.phase = "asking"
    session.turn = 0
    session.messages.append(ChatMessage(role="assistant", content=q, chips=chips))
    _save(session)

    return DnaChatLikertResponse(
        session_id=session.session_id,
        phase=session.phase,
        turn=session.turn,
        assistant_message=q,
        chips=chips,
        seed_dna=seed,
        draft_dna=seed,
        followups=followups,
    )


def get_dna_chat(session_id: str) -> DnaChatSession:
    return _load(session_id)


def send_dna_chat_message(
    req: DnaChatMessageRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> DnaChatMessageResponse:
    session = _load(req.session_id)
    if session.phase == "confirmed":
        raise ValueError("session already confirmed")
    if session.phase == "likert":
        raise ValueError("submit Likert answers before chatting")
    if session.phase in ("constraints", "draft"):
        raise ValueError(
            f"chat messages not accepted in phase={session.phase}; "
            "use constraints or finalize"
        )

    user_text = req.message.strip()
    if req.chip:
        chip = req.chip.strip()
        if chip and chip not in user_text:
            user_text = f"{chip}. {user_text}".strip() if user_text else chip
    if not user_text:
        raise ValueError("message is required")

    session.messages.append(ChatMessage(role="user", content=user_text))
    session.turn += 1

    # Pop one followup when user answered (best-effort)
    if session.followups:
        session.followups = session.followups[1:]

    model = llm or get_chat_model()
    force_constraints = session.turn >= MAX_TURNS_BEFORE_CONSTRAINTS
    hard_force = session.turn >= HARD_MAX_ASK_TURNS
    remaining = [f.model_dump() for f in session.followups]
    seed_blob = session.seed_dna.model_dump() if session.seed_dna else None
    user_blob = (
        f"seed_dna: {json.dumps(seed_blob, ensure_ascii=False)}\n"
        f"remaining_followups: {json.dumps(remaining, ensure_ascii=False)}\n"
        f"Transcript so far:\n{_transcript(session)}\n"
        f"Turn count: {session.turn}. "
        + (
            "Force phase=constraints now (keep/update draft_dna)."
            if force_constraints or hard_force
            else (
                "Followups empty — ask one concrete preference question, "
                "or phase=constraints if specifics are enough."
                if not remaining
                else "Continue asking for specifics, or phase=constraints if enough."
            )
        )
    )
    resp = model.complete(
        [
            LlmMessage(role="system", content=_TURN_SYSTEM),
            LlmMessage(role="user", content=user_blob),
        ],
        temperature=0.4,
        response_json=True,
    )
    session.provider = getattr(model, "provider", None)
    session.model = getattr(model, "model", None)

    parsed = _parse_turn(resp.text)
    # Empty followup queue alone does not skip specifics — wait for LLM or turn cap.
    go_constraints = force_constraints or hard_force or parsed["phase"] == "constraints"

    draft_dna = session.draft_dna or session.seed_dna
    raw_draft = parsed.get("draft_dna")
    if raw_draft:
        try:
            draft_dna = _parse_dna(json.dumps(raw_draft, ensure_ascii=False))
            session.draft_dna = draft_dna
        except Exception:
            pass

    if go_constraints:
        session.phase = "constraints"
        q, chips = _constraints_prompt()
        # Prefer fixed constraints prompt so must_have/must_avoid are always asked
        assistant_message = q
        chips = chips
        if draft_dna is None:
            try:
                draft_dna = extract_travel_dna(_transcript(session), llm=model)
                session.draft_dna = draft_dna
            except Exception:
                draft_dna = session.seed_dna
                session.draft_dna = draft_dna
    else:
        session.phase = "asking"
        assistant_message = parsed["assistant_message"]
        chips = parsed["chips"] or []

    session.messages.append(
        ChatMessage(role="assistant", content=assistant_message, chips=chips)
    )
    _save(session)
    return DnaChatMessageResponse(
        session_id=session.session_id,
        phase=session.phase,
        turn=session.turn,
        assistant_message=assistant_message,
        chips=chips,
        draft_dna=session.draft_dna,
        must_have=session.must_have,
        must_avoid=session.must_avoid,
    )


def submit_constraints(
    req: DnaChatConstraintsRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> DnaChatConstraintsResponse:
    """Persist must_have / must_avoid (asked fields; empty OK after submit)."""
    del llm
    session = _load(req.session_id)
    if session.phase not in ("asking", "constraints", "draft"):
        raise ValueError(
            f"constraints not allowed in phase={session.phase}"
        )
    if session.phase == "asking" and session.turn < 1 and session.followups:
        # Allow early constraints only if chat already started or queue empty —
        # still require leaving likert first (phase != likert).
        pass

    session.must_have = req.must_have
    session.must_avoid = req.must_avoid
    session.constraints_submitted = True

    if session.draft_dna is None:
        session.draft_dna = session.seed_dna
    if session.draft_dna is None:
        raise ValueError("no draft DNA — submit Likert first")

    session.phase = "draft"
    confirm_msg = (
        "취향 DNA 초안과 원하는 것/피하고 싶은 것을 정리했어요. "
        "이대로 확정할까요?"
    )
    chips = ["확정", "수정할래요"]
    session.messages.append(
        ChatMessage(role="assistant", content=confirm_msg, chips=chips)
    )
    _save(session)
    return DnaChatConstraintsResponse(
        session_id=session.session_id,
        phase=session.phase,
        turn=session.turn,
        assistant_message=confirm_msg,
        chips=chips,
        draft_dna=session.draft_dna,
        must_have=session.must_have,
        must_avoid=session.must_avoid,
    )


def finalize_dna_chat(
    req: DnaChatFinalizeRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> DnaChatFinalizeResponse:
    session = _load(req.session_id)
    if not req.confirm:
        raise ValueError("confirm=false: continue chatting via message endpoint")
    if not session.constraints_submitted:
        raise ValueError(
            "must_have/must_avoid not collected yet — POST /api/dna-chat/constraints first"
        )
    if session.phase not in ("draft", "constraints", "confirmed"):
        raise ValueError(f"finalize not allowed in phase={session.phase}")

    dna = req.edits or session.draft_dna
    if dna is None:
        model = llm or get_chat_model()
        dna = extract_travel_dna(_transcript(session), llm=model)
        session.provider = getattr(model, "provider", session.provider)
        session.model = getattr(model, "model", session.model)

    session.confirmed_dna = dna
    session.draft_dna = dna
    session.phase = "confirmed"
    session.messages.append(
        ChatMessage(role="assistant", content="Travel DNA를 확정했어요.", chips=[])
    )
    _save(session)
    return DnaChatFinalizeResponse(
        session_id=session.session_id,
        phase=session.phase,
        travel_dna=dna,
        must_have=session.must_have,
        must_avoid=session.must_avoid,
        provider=session.provider,
        model=session.model,
    )
