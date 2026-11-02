export const ATTRIBUTES = [
  'nature',
  'night',
  'walk',
  'architecture',
  'culture',
  'food',
  'quiet',
  'local',
  'shopping',
  'activity',
] as const;
export const CONFLICTS = ['crowds', 'cost', 'waiting', 'access', 'commercial'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Conflict = (typeof CONFLICTS)[number];
export type RegionId = 'seoul' | 'busan';
export type Vector<K extends string> = Record<K, number>;
export interface Experience {
  id: string;
  placeName: string;
  rating: number;
  likes: Attribute[];
  dislikes: Conflict[];
  goodReason: string;
  badReason: string;
  updatedAt: string;
}
export interface Place {
  id: string;
  name: string;
  region: RegionId;
  country: string;
  district: string;
  latitude: number;
  longitude: number;
  description: string;
  image: string;
  category: string;
  positiveAttributes: Partial<Vector<Attribute>>;
  negativeAttributes: Partial<Vector<Conflict>>;
  reviewKeywords: string[];
  source: 'curated-demo';
}
export interface TravelDNA {
  preferences: Vector<Attribute>;
  aversions: Vector<Conflict>;
  evidenceCount: number;
  title: string;
}
export interface Recommendation {
  placeId: string;
  score: number;
  matchedAttributes: Attribute[];
  conflictingAttributes: Conflict[];
  reason: string;
}
export interface AppData {
  version: 1;
  nickname: string;
  onboarded: boolean;
  demo: boolean;
  experiences: Experience[];
  savedIds: string[];
  region: RegionId;
}
