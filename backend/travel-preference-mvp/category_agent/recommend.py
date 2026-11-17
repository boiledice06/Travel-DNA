"""
Numeric Travel DNA → flat lists of industry names only (no narratives).

Main pass: pillars + axes → 업종명 list.
Micro pass: separate call → micro 업종명 list.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from .llm import ChatModel, LlmMessage, get_chat_model
from .schemas import (
    DEFAULT_TOTAL_SLOTS,
    PILLAR_LABELS_KO,
    IndustryPlanRequest,
    IndustryPlanResponse,
    PillarName,
    TravelDNA,
)

_MAIN_SYSTEM = """List travel industry/category kind names (업종명) only.
Short concrete nouns: 갤러리, 박물관, 카페, 방탈출, 도자기 공예 체험 공방, 전통시장, 공원.
No explanations, no summary, no reasons, no adjectives stacks, no venue names.

Return JSON only:
{"industries":["카페","갤러리","방탈출"]}
One name per requested slot, same order as slots.
"""

_MICRO_SYSTEM = """Given micro taste keywords, list short industry names that fit them.
Examples: 고양이 → 고양이 카페, 독립서점 → 독립서점, 식물 → 식물원.
Names only. No explanations.

Return JSON only:
{"micro_industries":["고양이 카페","독립서점","식물원"]}
"""


def _expand_slots(allocation: dict[PillarName, int]) -> List[PillarName]:
    order: List[PillarName] = ["stay_vibe", "eat_local", "see_learn", "do_play"]
    remaining = dict(allocation)
    slots: List[PillarName] = []
    while sum(remaining.values()) > 0:
        progressed = False
        for p in order:
            if remaining.get(p, 0) > 0:
                slots.append(p)
                remaining[p] -= 1
                progressed = True
        if not progressed:
            break
    return slots


def _strip_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _main_user_prompt(req: IndustryPlanRequest, slots: list[dict]) -> str:
    dna = req.travel_dna
    return (
        "DNA (context only):\n"
        f"{json.dumps({'pillars': dna.pillars.as_dict(), 'axes': dna.axes.model_dump()}, ensure_ascii=False)}\n"
        f"Slots (pillar hints, return {len(slots)} names in order):\n"
        f"{json.dumps(slots, ensure_ascii=False)}\n"
        "Return industries name list only."
    )


def _parse_name_list(raw: str, key: str, expect: Optional[int] = None) -> list[str]:
    data = json.loads(_strip_fence(raw))
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        rows = data.get(key) or data.get("industries") or data.get("names") or []
    else:
        raise ValueError("Expected JSON object or array of names")
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if isinstance(row, str):
            name = row.strip()
        elif isinstance(row, dict):
            name = str(row.get("industry_ko") or row.get("name") or "").strip()
        else:
            continue
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)
    if expect is not None and len(out) < expect:
        # allow shorter if model deduped; pad not needed — search uses names
        pass
    if not out:
        raise ValueError(f"No names parsed from {key}")
    return out


def _plan_main(req: IndustryPlanRequest, model: ChatModel) -> tuple[dict[PillarName, int], list[str]]:
    allocation = req.travel_dna.pillars.allocate_slots(req.total_slots)
    pillars = _expand_slots(allocation)
    slots = [
        {"slot_index": i, "pillar": p, "pillar_label": PILLAR_LABELS_KO[p]}
        for i, p in enumerate(pillars, start=1)
    ]
    resp = model.complete(
        [
            LlmMessage(role="system", content=_MAIN_SYSTEM),
            LlmMessage(role="user", content=_main_user_prompt(req, slots)),
        ],
        temperature=0.4,
        response_json=True,
    )
    names = _parse_name_list(resp.text, "industries", expect=len(slots))
    # keep at most total_slots names
    return allocation, names[: req.total_slots]


def _plan_micro(req: IndustryPlanRequest, model: ChatModel) -> list[str]:
    micros = list(req.travel_dna.micro_keywords)
    if not micros:
        return []
    n = len(micros) * req.micro_kinds_per_keyword
    resp = model.complete(
        [
            LlmMessage(role="system", content=_MICRO_SYSTEM),
            LlmMessage(
                role="user",
                content=(
                    f"Micro keywords: {json.dumps(micros, ensure_ascii=False)}\n"
                    f"Return about {n} industry names total.\n"
                    "Names only."
                ),
            ),
        ],
        temperature=0.4,
        response_json=True,
    )
    return _parse_name_list(resp.text, "micro_industries")


def plan_industries(
    req: IndustryPlanRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> IndustryPlanResponse:
    model = llm or get_chat_model()
    allocation, industries = _plan_main(req, model)
    micro_industries = _plan_micro(req, model)
    return IndustryPlanResponse(
        city=req.city,
        travel_dna=req.travel_dna,
        slot_allocation=allocation,
        provider=getattr(model, "provider", "unknown"),
        model=getattr(model, "model", "unknown"),
        industries=industries,
        micro_industries=micro_industries,
        region_agnostic=True,
    )


def plan_industries_from_dna(
    *,
    travel_dna: TravelDNA,
    total_slots: int = DEFAULT_TOTAL_SLOTS,
    city: Optional[str] = None,
    micro_kinds_per_keyword: int = 2,
    llm: Optional[ChatModel] = None,
) -> IndustryPlanResponse:
    return plan_industries(
        IndustryPlanRequest(
            city=city,
            travel_dna=travel_dna,
            total_slots=total_slots,
            micro_kinds_per_keyword=micro_kinds_per_keyword,
        ),
        llm=llm,
    )


__all__ = ["plan_industries", "plan_industries_from_dna"]
