import pytest
from pydantic import ValidationError
from category_agent.trip_profile import TripProfileCreate

@pytest.mark.parametrize('duration', ['half_day', 'full_day', '1n2d', '2n3d'])
def test_supported_durations_are_preserved(duration):
    profile = TripProfileCreate(party_size='2', companion_type='friends', duration=duration, transport='walk_subway', time_window='morning').to_profile()
    assert profile.model_dump()['duration'] == duration
    assert profile.hard_constraints_summary()['duration'] == duration

def test_unknown_duration_is_rejected():
    with pytest.raises(ValidationError):
        TripProfileCreate(party_size='2', companion_type='friends', duration='3d', transport='walk_subway', time_window='morning')
