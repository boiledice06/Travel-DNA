import type { AppData, Experience } from '../../types/index.ts';
import { demoExperiences } from '../../data/mock/places.ts';
export function hasDemoRecords(records: Experience[]): boolean {
  return records.some((record) => demoExperiences.some((sample) => sample.id === record.id));
}
/** Re-entering onboarding never discards personal records or hides demo provenance. */
export function startProfile(data: AppData, nickname: string, useDemo: boolean): AppData {
  const experiences = useDemo
    ? [
        ...data.experiences,
        ...demoExperiences.filter((sample) => !data.experiences.some((e) => e.id === sample.id)),
      ]
    : data.experiences;
  return {
    ...data,
    nickname: nickname.trim() || '여행자',
    demo: hasDemoRecords(experiences),
    experiences,
  };
}
