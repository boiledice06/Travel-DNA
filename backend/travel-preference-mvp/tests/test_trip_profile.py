"""TripProfile form validation — logistics only (no must_avoid)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from category_agent.store import get_profile, save_profile
from category_agent.trip_profile import DEFAULT_CITY, TripProfile, TripProfileCreate


def _base(**overrides):
    data = {
        "party_size": "2",
        "companion_type": "couple",
        "duration": "full_day",
        "transport": "walk_subway",
        "time_window": "afternoon",
    }
    data.update(overrides)
    return data


def test_city_fixed_seoul():
    p = TripProfileCreate(**_base()).to_profile()
    assert p.city == DEFAULT_CITY == "서울"


def test_no_must_avoid_on_profile():
    assert "must_avoid" not in TripProfile.model_fields
    assert "must_avoid" not in TripProfileCreate.model_fields
    p = TripProfileCreate(**_base()).to_profile()
    summary = p.hard_constraints_summary()
    assert "must_avoid" not in summary


def test_age_gender_skippable():
    p = TripProfileCreate(**_base()).to_profile()
    assert p.age_band == "skip"
    assert p.gender == "skip"


def test_lodging_clears_area_when_none():
    p = TripProfileCreate(**_base(), lodging="none", lodging_area="홍대").to_profile()
    assert p.lodging_area is None


def test_invalid_party_size():
    with pytest.raises(ValidationError):
        TripProfileCreate(**_base(party_size="10"))


def test_persist_roundtrip(tmp_path, monkeypatch):
    import category_agent.store as store

    monkeypatch.setattr(store, "_ROOT", tmp_path / "mvp_store")
    monkeypatch.setattr(store, "_PROFILES", tmp_path / "mvp_store" / "profiles")
    monkeypatch.setattr(store, "_SESSIONS", tmp_path / "mvp_store" / "dna_sessions")
    p = TripProfileCreate(**_base(), budget_note="식사 저렴").to_profile()
    save_profile(p)
    loaded = get_profile(p.id)
    assert loaded is not None
    assert loaded.budget_note == "식사 저렴"
    assert loaded.city == "서울"
