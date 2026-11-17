"""DNA chat: Likert → asking → constraints → draft → confirmed."""
from __future__ import annotations

import json

import pytest

from category_agent.dna_chat import (
    DnaChatConstraintsRequest,
    DnaChatFinalizeRequest,
    DnaChatLikertRequest,
    DnaChatMessageRequest,
    finalize_dna_chat,
    send_dna_chat_message,
    start_dna_chat,
    submit_constraints,
    submit_likert,
)
from category_agent.likert import REQUIRED_LIKERT_IDS, LikertAnswer, seed_dna_from_likert
from category_agent.llm.base import LlmMessage, LlmResponse
from category_agent.schemas import TravelDNA


class StubChatLLM:
    provider = "stub"
    model = "stub-chat"
    calls = 0

    def complete(
        self,
        messages: list[LlmMessage],
        *,
        temperature: float = 0.4,
        response_json: bool = False,
    ) -> LlmResponse:
        self.calls += 1
        user = messages[1].content
        turn = 1
        if "Turn count:" in user:
            try:
                turn = int(user.split("Turn count:")[1].split(".")[0].strip())
            except Exception:
                turn = 1
        if turn >= 2 or "Force phase=constraints" in user:
            payload = {
                "phase": "constraints",
                "assistant_message": "이제 원하는 것/피할 것을 적어 주세요.",
                "chips": [],
                "draft_dna": {
                    "pillars": {
                        "do_play": 0.2,
                        "see_learn": 0.2,
                        "stay_vibe": 0.3,
                        "eat_local": 0.3,
                    },
                    "axes": {
                        "authenticity": 0.7,
                        "energy": -0.4,
                        "density": -0.6,
                        "novelty": 0.2,
                        "setting": -0.1,
                    },
                    "micro_keywords": ["골목카페", "독립서점"],
                },
            }
        else:
            payload = {
                "phase": "ask",
                "assistant_message": "어떤 카페·서점 분위기가 좋아요?",
                "chips": ["골목 카페", "독립서점"],
                "draft_dna": None,
            }
        return LlmResponse(
            text=json.dumps(payload, ensure_ascii=False),
            model=self.model,
            provider=self.provider,
        )


def _all_mid_answers() -> list[LikertAnswer]:
    return [LikertAnswer(id=i, value=3) for i in REQUIRED_LIKERT_IDS]


def _store(tmp_path, monkeypatch):
    import category_agent.store as store

    monkeypatch.setattr(store, "_ROOT", tmp_path / "mvp_store")
    monkeypatch.setattr(store, "_PROFILES", tmp_path / "mvp_store" / "profiles")
    monkeypatch.setattr(store, "_SESSIONS", tmp_path / "mvp_store" / "dna_sessions")


def test_seed_dna_mechanical():
    answers = {i: 5 for i in REQUIRED_LIKERT_IDS}
    answers["ax_density"] = 1
    answers["ax_energy"] = 1
    dna = seed_dna_from_likert(answers)
    assert dna.axes.density == -1.0
    assert dna.axes.authenticity == 1.0
    assert dna.axes.novelty == 1.0
    assert dna.axes.energy == -1.0
    assert dna.axes.setting == 1.0
    assert abs(sum(dna.pillars.as_dict().values()) - 1.0) < 1e-6
    # Pillars not on form — equal mid seed
    vals = list(dna.pillars.as_dict().values())
    assert max(vals) - min(vals) < 1e-6


def test_likert_then_chat_then_constraints_then_confirm(tmp_path, monkeypatch):
    _store(tmp_path, monkeypatch)
    llm = StubChatLLM()

    started = start_dna_chat(llm=llm)
    assert started.phase == "likert"
    assert len(started.likert_items) == 5
    assert {it["id"] for it in started.likert_items} == set(REQUIRED_LIKERT_IDS)
    assert llm.calls == 0

    with pytest.raises(ValueError, match="Likert"):
        send_dna_chat_message(
            DnaChatMessageRequest(session_id=started.session_id, message="아직"),
            llm=llm,
        )

    seeded = submit_likert(
        DnaChatLikertRequest(session_id=started.session_id, answers=_all_mid_answers()),
        llm=llm,
    )
    assert seeded.phase == "asking"
    assert seeded.seed_dna is not None
    assert seeded.assistant_message

    mid = send_dna_chat_message(
        DnaChatMessageRequest(session_id=started.session_id, message="골목 카페"),
        llm=llm,
    )
    assert mid.phase == "asking"
    assert mid.turn == 1

    ready = send_dna_chat_message(
        DnaChatMessageRequest(session_id=started.session_id, message="독립서점 좋아해요"),
        llm=llm,
    )
    assert ready.phase == "constraints"
    assert ready.draft_dna is not None

    with pytest.raises(ValueError, match="must_have/must_avoid"):
        finalize_dna_chat(
            DnaChatFinalizeRequest(session_id=started.session_id, confirm=True),
            llm=llm,
        )

    draft = submit_constraints(
        DnaChatConstraintsRequest(
            session_id=started.session_id,
            must_have="독립서점",
            must_avoid="클럽",
        ),
        llm=llm,
    )
    assert draft.phase == "draft"
    assert draft.must_have == "독립서점"
    assert draft.must_avoid == "클럽"

    done = finalize_dna_chat(
        DnaChatFinalizeRequest(session_id=started.session_id, confirm=True),
        llm=llm,
    )
    assert done.phase == "confirmed"
    assert isinstance(done.travel_dna, TravelDNA)
    assert done.must_avoid == "클럽"


def test_cannot_message_after_confirm(tmp_path, monkeypatch):
    _store(tmp_path, monkeypatch)
    llm = StubChatLLM()
    started = start_dna_chat(llm=llm)
    submit_likert(
        DnaChatLikertRequest(session_id=started.session_id, answers=_all_mid_answers()),
        llm=llm,
    )
    send_dna_chat_message(
        DnaChatMessageRequest(session_id=started.session_id, message="골목"),
        llm=llm,
    )
    send_dna_chat_message(
        DnaChatMessageRequest(session_id=started.session_id, message="실내"),
        llm=llm,
    )
    submit_constraints(
        DnaChatConstraintsRequest(
            session_id=started.session_id, must_have="없음", must_avoid="없음"
        ),
        llm=llm,
    )
    finalize_dna_chat(
        DnaChatFinalizeRequest(session_id=started.session_id, confirm=True),
        llm=llm,
    )
    with pytest.raises(ValueError, match="confirmed"):
        send_dna_chat_message(
            DnaChatMessageRequest(session_id=started.session_id, message="또"),
            llm=llm,
        )
