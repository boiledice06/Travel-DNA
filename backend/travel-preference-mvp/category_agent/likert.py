"""Likert questionnaire → deterministic TravelDNA seed (no LLM)."""
from __future__ import annotations

from typing import Dict, List, Literal

from pydantic import BaseModel, Field, field_validator

from .schemas import PreferenceAxes, TourismPillars, TravelDNA

LikertValue = Literal[1, 2, 3, 4, 5]

SCALE_LABELS_KO: Dict[int, str] = {
    5: "매우 그렇다",
    4: "그렇다",
    3: "보통이다",
    2: "그렇지 않다",
    1: "매우 그렇지 않다",
}

# Exactly 5 items = all PreferenceAxes. Pillars stay mid/default (chat may refine).
# Axis poles (dna.py): authenticity landmark↔local; energy rest/static↔active;
# density quiet↔crowded; novelty classic↔unusual; setting indoor/urban↔nature/outdoor.
# energy = 활동적 vs 정적 — NOT busy/leisurely travel pace.
LIKERT_ITEMS: List[dict] = [
    {
        "id": "ax_authenticity",
        "statement_ko": "유명 랜드마크보다 골목·로컬 느낌이 더 좋다.",
        "maps_to": "axes.authenticity",
        "kind": "axis",
        "target": "authenticity",
    },
    {
        "id": "ax_energy",
        "statement_ko": "차분하고 정적인 것보다 활동적인 경험이 더 좋다.",
        "maps_to": "axes.energy",
        "kind": "axis",
        "target": "energy",
    },
    {
        "id": "ax_density",
        "statement_ko": "사람 많고 활기찬 핫플·번화가가 더 좋다.",
        "maps_to": "axes.density",
        "kind": "axis",
        "target": "density",
    },
    {
        "id": "ax_novelty",
        "statement_ko": "익숙한 활동보다 새롭고 낯선 경험이 더 좋다.",
        "maps_to": "axes.novelty",
        "kind": "axis",
        "target": "novelty",
    },
    {
        "id": "ax_setting",
        "statement_ko": "실내·도심보다 야외·자연 쪽 일정이 더 편하다.",
        "maps_to": "axes.setting",
        "kind": "axis",
        "target": "setting",
    },
]

REQUIRED_LIKERT_IDS = tuple(item["id"] for item in LIKERT_ITEMS)

# Soft mid seed for all pillars (not asked on the form; chat can adjust).
_RESIDUAL_PILLAR_RAW = 3.0


class LikertAnswer(BaseModel):
    id: str
    value: int = Field(..., ge=1, le=5)

    @field_validator("value", mode="before")
    @classmethod
    def _as_int(cls, v: object) -> object:
        return int(v)


class FollowupItem(BaseModel):
    axis_or_pillar: str
    reason: str
    suggested_chips: List[str] = Field(default_factory=list)


def likert_items_public() -> List[dict]:
    """Payload for POST /api/dna-chat/start."""
    scale = [{"value": v, "label_ko": SCALE_LABELS_KO[v]} for v in (5, 4, 3, 2, 1)]
    return [
        {
            "id": it["id"],
            "statement_ko": it["statement_ko"],
            "maps_to": it["maps_to"],
            "scale": scale,
        }
        for it in LIKERT_ITEMS
    ]


def _likert_to_axis(score: int) -> float:
    """1→-1, 3→0, 5→+1."""
    return (float(score) - 3.0) / 2.0


def _normalize_pillar_raw(raw: Dict[str, float]) -> TourismPillars:
    keys = ("do_play", "see_learn", "stay_vibe", "eat_local")
    clipped = {k: max(0.05, float(raw.get(k, _RESIDUAL_PILLAR_RAW))) for k in keys}
    total = sum(clipped.values()) or 1.0
    norm = {k: clipped[k] / total for k in keys}
    drift = 1.0 - sum(norm.values())
    norm["stay_vibe"] = max(0.0, norm["stay_vibe"] + drift)
    return TourismPillars(**norm)


def validate_likert_answers(answers: List[LikertAnswer]) -> Dict[str, int]:
    by_id = {a.id: int(a.value) for a in answers}
    missing = [i for i in REQUIRED_LIKERT_IDS if i not in by_id]
    if missing:
        raise ValueError(f"missing likert answers: {', '.join(missing)}")
    extra = [k for k in by_id if k not in REQUIRED_LIKERT_IDS]
    if extra:
        raise ValueError(f"unknown likert ids: {', '.join(extra)}")
    for k, v in by_id.items():
        if v < 1 or v > 5:
            raise ValueError(f"likert {k} must be 1..5 (got {v})")
    return by_id


def seed_dna_from_likert(answers: Dict[str, int]) -> TravelDNA:
    """Mechanical mapping — no LLM. Pillars default mid; axes from all 5 items."""
    axes = PreferenceAxes(
        authenticity=_likert_to_axis(answers["ax_authenticity"]),
        energy=_likert_to_axis(answers["ax_energy"]),
        density=_likert_to_axis(answers["ax_density"]),
        novelty=_likert_to_axis(answers["ax_novelty"]),
        setting=_likert_to_axis(answers["ax_setting"]),
    )
    pillars = _normalize_pillar_raw(
        {
            "do_play": _RESIDUAL_PILLAR_RAW,
            "see_learn": _RESIDUAL_PILLAR_RAW,
            "stay_vibe": _RESIDUAL_PILLAR_RAW,
            "eat_local": _RESIDUAL_PILLAR_RAW,
        }
    )
    return TravelDNA(pillars=pillars, axes=axes, micro_keywords=[])


def build_followups(answers: Dict[str, int], seed: TravelDNA) -> List[FollowupItem]:
    """Queue deepen questions for axis extremes / all-mid ambiguity."""
    del seed
    followups: List[FollowupItem] = []
    axis_chips = {
        "authenticity": ["로컬·골목", "랜드마크"],
        "energy": ["활동적", "정적·차분"],
        "density": ["핫플·번화가", "골목·조용"],
        "novelty": ["새롭고 낯선", "익숙한 명소"],
        "setting": ["야외·자연", "실내·도심"],
    }
    for it in LIKERT_ITEMS:
        score = answers[it["id"]]
        if score in (1, 5):
            target = it["target"]
            followups.append(
                FollowupItem(
                    axis_or_pillar=f"axes.{target}",
                    reason="extreme",
                    suggested_chips=axis_chips.get(target, []),
                )
            )

    if not followups and all(v == 3 for v in answers.values()):
        followups.append(
            FollowupItem(
                axis_or_pillar="axes.general",
                reason="all_mid",
                suggested_chips=["골목 카페", "야외 산책", "실내 전시"],
            )
        )

    return followups[:5]


def first_followup_prompt(followups: List[FollowupItem]) -> tuple[str, List[str]]:
    if not followups:
        return (
            "설문 반영했어요. 구체적으로 좋아하는 장소·분위기·키워드가 있으면 알려 주세요.",
            ["골목 카페", "독립서점", "야외 산책"],
        )
    fu = followups[0]
    chips = list(fu.suggested_chips)
    if fu.axis_or_pillar.endswith("novelty"):
        msg = "익숙한 명소와 새롭고 낯선 경험 중 어느 쪽에 더 끌리세요?"
    elif fu.axis_or_pillar.endswith("density"):
        msg = "핫플·번화가 쪽을 골랐는데, 구체적으로 어떤 분위기가 좋아요?"
    elif fu.axis_or_pillar.endswith("authenticity"):
        msg = "로컬·골목 취향이 강하네요. 어떤 느낌이 특히 좋나요?"
    elif fu.axis_or_pillar.endswith("setting"):
        msg = "야외/실내 쪽 선호가 분명해요. 구체적인 예가 있을까요?"
    elif fu.axis_or_pillar.endswith("energy"):
        msg = "활동적/정적 취향이 분명해요. 어떤 활동 또는 휴식 스타일이 좋아요?"
    elif fu.reason == "all_mid":
        msg = "설문이 고르게 나왔어요. 구체적으로 좋아하는 장소·분위기를 알려 주세요."
    else:
        msg = "방금 설문에서 강한 답이 있었어요. 조금만 더 구체적으로 알려 주세요."
    return msg, chips
