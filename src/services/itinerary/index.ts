import type { Place } from '../../types/index.ts';

/** Deterministic, capacity-limited geographic grouping; not road routing. */
export function createItinerary(places: Place[]): Place[][] {
  const seen = new Set<string>();
  const candidates = places
    .filter((p) => {
      if (
        seen.has(p.id) ||
        p.region !== 'seoul' ||
        !Number.isFinite(p.latitude) ||
        !Number.isFinite(p.longitude) ||
        p.latitude < 37.4 ||
        p.latitude > 37.75 ||
        p.longitude < 126.75 ||
        p.longitude > 127.2
      )
        return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, 15);
  const distance = (a: Place, b: Place) =>
    Math.hypot((a.latitude - b.latitude) * 111, (a.longitude - b.longitude) * 88);
  const days: Place[][] = [[], [], []];
  if (!candidates.length) return days;
  // Seed each day with a point far from existing seeds, then fill by closest day.
  days[0].push(candidates.shift()!);
  for (let i = 1; i < 3 && candidates.length; i++) {
    let best = 0;
    for (let j = 1; j < candidates.length; j++) {
      const nearest = (p: Place) => Math.min(...days.flat().map((s) => distance(p, s)));
      if (nearest(candidates[j]) > nearest(candidates[best])) best = j;
    }
    days[i].push(candidates.splice(best, 1)[0]);
  }
  const cap = Math.ceil((candidates.length + days.flat().length) / 3);
  while (candidates.length) {
    let choice = { day: 0, index: 0, distance: Infinity };
    days.forEach((day, dayIndex) => {
      if (!day.length || day.length >= cap) return;
      candidates.forEach((p, index) => {
        const d = distance(day[day.length - 1], p);
        if (d < choice.distance) choice = { day: dayIndex, index, distance: d };
      });
    });
    days[choice.day].push(candidates.splice(choice.index, 1)[0]);
  }
  return days;
}
