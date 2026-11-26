import type { Place } from '../../types';
import { seoulPhotoCatalog } from './seoulPhotoCatalog';

const identities = seoulPhotoCatalog.flatMap((entry) =>
  entry.places.map((identity) => ({ ...identity, entry })),
);

export function reviewedSeoulPhoto(place: Place) {
  if (place.region !== 'seoul') return;
  const samePlace = (candidate: (typeof identities)[number]) =>
    candidate.name === place.name &&
    Math.hypot(
      (candidate.latitude - place.latitude) * 111_195,
      (candidate.longitude - place.longitude) * 88_300,
    ) <= 100;
  const indexed = identities.find((candidate) => candidate.id === place.id && samePlace(candidate));
  if (indexed) return indexed.entry;

  // Search providers can assign a different ID to the same verified place.
  const matches = new Set(identities.filter(samePlace).map((candidate) => candidate.entry));
  return matches.size === 1 ? matches.values().next().value : undefined;
}

export function withReviewedSeoulPhoto(place: Place): Place {
  const photo = reviewedSeoulPhoto(place)?.photo;
  return photo && photo !== place.photo ? { ...place, photo } : place;
}
