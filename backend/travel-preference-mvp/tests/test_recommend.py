"""Stub tests — name-only industry lists + separate micro pass."""
from __future__ import annotations

import json

import pytest

from category_agent.llm.base import LlmMessage, LlmResponse
from category_agent.recommend import plan_industries
from category_agent.schemas import (
    DEFAULT_TOTAL_SLOTS,
    IndustryPlanRequest,
    PreferenceAxes,
    TourismPillars,
    TravelDNA,
)


DNA_WITH_MICRO = TravelDNA(
    pillars=TourismPillars(do_play=0.15, see_learn=0.2, stay_vibe=0.4, eat_local=0.25),
    axes=PreferenceAxes(
        authenticity=0.6,
        energy=-0.3,
        density=-0.5,
        novelty=0.2,
        setting=-0.2,
    ),
    micro_keywords=["고양이", "독립서점"],
)


class StubLLM:
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
        assert "No explanations" in system or "names only" in system.lower() or "Names only" in system
        if "micro" in system.lower() or "Micro keywords" in user:
            return LlmResponse(
                text=json.dumps({"micro_industries": ["고양이 카페", "독립서점"]}, ensure_ascii=False),
                model=self.model,
                provider=self.provider,
            )
        assert "reason" not in system.lower() or "no reason" in system.lower()
        # count slots from prompt
        n = user.count('"slot_index"')
        names = ["카페", "갤러리", "방탈출", "박물관", "전통시장", "공원", "공방", "서점"][: max(n, 1)]
        return LlmResponse(
            text=json.dumps({"industries": names}, ensure_ascii=False),
            model=self.model,
            provider=self.provider,
        )


def test_default_slots_raised():
    assert DEFAULT_TOTAL_SLOTS >= 16


def test_pillar_sum_validation():
    with pytest.raises(Exception):
        TourismPillars(do_play=0.5, see_learn=0.5, stay_vibe=0.5, eat_local=0.5)


def test_name_only_two_pass():
    llm = StubLLM()
    result = plan_industries(
        IndustryPlanRequest(travel_dna=DNA_WITH_MICRO, total_slots=6, micro_kinds_per_keyword=1),
        llm=llm,
    )
    assert llm.calls == 2
    assert result.industries == ["카페", "갤러리", "방탈출", "박물관", "전통시장", "공원"]
    assert all(isinstance(x, str) for x in result.industries)
    assert result.micro_industries == ["고양이 카페", "독립서점"]
    assert not hasattr(result, "summary") or result.model_dump().get("summary") in (None, "")
