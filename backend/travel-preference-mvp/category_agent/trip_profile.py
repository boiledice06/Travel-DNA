"""Trip logistics — form / structured input only (not chat). City fixed to 서울."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator

DEFAULT_CITY = "서울"

PartySize = Literal["1", "2", "3-4", "5+"]
CompanionType = Literal["solo", "couple", "friends", "family", "with_kids"]
AgeBand = Literal["teens", "20s", "30s", "40s", "50s", "60plus", "skip"]
Gender = Literal["female", "male", "other", "skip"]
Duration = Literal["half_day", "full_day", "1n2d", "2n3d"]
LodgingKind = Literal["none", "has"]
Transport = Literal["walk_subway", "bus_ok", "taxi_car", "minimize"]
MobilityPreference = Literal["high_mobility", "balanced", "one_neighborhood"]
BudgetLevel = Literal["low", "mid", "high"]
TimeWindow = Literal["morning", "afternoon", "evening"]


class TripProfile(BaseModel):
    """Hard constraints from form intake. Never filled by taste chat."""

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    city: Literal["서울"] = DEFAULT_CITY
    party_size: PartySize
    companion_type: CompanionType
    age_band: AgeBand = "skip"
    gender: Gender = "skip"
    duration: Duration
    lodging: LodgingKind = "none"
    lodging_area: Optional[str] = Field(
        default=None,
        description="Optional preferred area when lodging=has",
    )
    transport: Transport
    mobility_preference: MobilityPreference = "balanced"
    budget_level: BudgetLevel = "mid"
    budget_note: Optional[str] = None
    time_window: TimeWindow
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("lodging_area", "budget_note", mode="before")
    @classmethod
    def _blank_to_none(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def _lodging_area_rule(self) -> "TripProfile":
        if self.lodging == "none":
            object.__setattr__(self, "lodging_area", None)
        return self

    def hard_constraints_summary(self) -> dict:
        """Logistics-only constraint pack (taste avoids live on DNA session)."""
        return {
            "city": self.city,
            "party_size": self.party_size,
            "companion_type": self.companion_type,
            "duration": self.duration,
            "transport": self.transport,
            "mobility_preference": self.mobility_preference,
            "budget_level": self.budget_level,
            "time_window": self.time_window,
            "lodging": self.lodging,
            "lodging_area": self.lodging_area,
        }


class TripProfileCreate(BaseModel):
    """POST body — id/created_at assigned server-side. Logistics only."""

    party_size: PartySize
    companion_type: CompanionType
    age_band: AgeBand = "skip"
    gender: Gender = "skip"
    duration: Duration
    lodging: LodgingKind = "none"
    lodging_area: Optional[str] = None
    transport: Transport
    mobility_preference: MobilityPreference = "balanced"
    budget_level: BudgetLevel = "mid"
    budget_note: Optional[str] = None
    time_window: TimeWindow

    def to_profile(self) -> TripProfile:
        return TripProfile(**self.model_dump(), city=DEFAULT_CITY)
