"""Stub tests for NL → Travel DNA → industries pipeline."""
from __future__ import annotations

import json

import pytest

from category_agent.dna import _parse_dna, extract_travel_dna
from category_agent.llm.base import LlmMessage, LlmResponse
from category_agent.pipeline import run_nl_to_industries
from category_agent.schemas import NlPipelineRequest, TravelDNA


class StubDnaThenPlanLLM:
    """First call → DNA JSON; later calls → industry / micro name lists."""

    provider = "stub"
    model = "stub-model"
    calls = 0

    def complete(
        self,
        messages: list[LlmMessage],
        *,
        temperature: float = 0.4,
        response_json: bool = False,
    ) -> LlmResponse:
        self.calls += 1
        system = messages[0].content
        user = messages[1].content
        if "Travel DNA" in system or "pillars" in system and "Extract" in system:
            return LlmResponse(
                text=json.dumps(
                    {
                        "pillars": {
                            "do_play": 0.1,
                            "see_learn": 0.2,
                            "stay_vibe": 0.45,
                            "eat_local": 0.25,
                        },
                        "axes": {
                            "authenticity": 0.7,
                            "energy": -0.4,
                            "density": -0.6,
                            "novelty": 0.1,
                            "setting": -0.2,
                        },
                        "micro_keywords": ["골목카페", "독립서점"],
                    },
                    ensure_ascii=False,
                ),
                model=self.model,
                provider=self.provider,
            )
        if "micro" in system.lower() or "Micro keywords" in user:
            return LlmResponse(
                text=json.dumps(
                    {"micro_industries": ["골목 카페", "독립서점"]},
                    ensure_ascii=False,
                ),
                model=self.model,
                provider=self.provider,
            )
        n = user.count('"slot_index"')
        names = ["카페", "갤러리", "방탈출", "박물관", "전통시장", "공원"][: max(n, 1)]
        return LlmResponse(
            text=json.dumps({"industries": names}, ensure_ascii=False),
            model=self.model,
            provider=self.provider,
        )


def test_parse_dna_normalizes_pillars():
    dna = _parse_dna(
        json.dumps(
            {
                "pillars": {"do_play": 2, "see_learn": 2, "stay_vibe": 4, "eat_local": 2},
                "axes": {"authenticity": 2, "energy": -2, "density": 0, "novelty": 0, "setting": 0},
                "micro_keywords": ["#고양이", "독립서점", ""],
            }
        )
    )
    assert isinstance(dna, TravelDNA)
    total = sum(dna.pillars.as_dict().values())
    assert abs(total - 1.0) < 1e-6
    assert dna.axes.authenticity == 1.0
    assert dna.axes.energy == -1.0
    assert dna.micro_keywords == ["고양이", "독립서점"]


def test_extract_travel_dna_stub():
    llm = StubDnaThenPlanLLM()
    dna = extract_travel_dna("골목 카페 좋아하고 번화가는 싫어요", llm=llm)
    assert llm.calls == 1
    assert abs(sum(dna.pillars.as_dict().values()) - 1.0) < 1e-6
    assert "골목카페" in dna.micro_keywords or "독립서점" in dna.micro_keywords


def test_nl_pipeline_stub_two_plus_dna():
    llm = StubDnaThenPlanLLM()
    result = run_nl_to_industries(
        text="골목 카페랑 독립서점 좋아하고 번화가는 싫어요",
        total_slots=6,
        micro_kinds_per_keyword=1,
        llm=llm,
    )
    # 1 DNA + 1 main + 1 micro
    assert llm.calls == 3
    assert result.provider == "stub"
    assert len(result.industries) == 6
    assert result.micro_industries == ["골목 카페", "독립서점"]
    assert result.places is None
    assert result.travel_dna.pillars.stay_vibe == pytest.approx(0.45)


def test_nl_request_requires_text():
    with pytest.raises(Exception):
        NlPipelineRequest(text="")
