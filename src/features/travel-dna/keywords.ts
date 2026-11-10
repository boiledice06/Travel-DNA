import type { Experience } from '../../types/index.ts';

// Literal tokens only: this is not semantic analysis or an inference of intent.
export function extractKeywords(experiences: Experience[]) {
  const collect = (field: 'goodReason' | 'badReason') => {
    const counts = new Map<string, number>();
    for (const experience of experiences) {
      const tokens = experience[field].toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? [];
      for (const token of new Set(tokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([token]) => token);
  };
  return { positive: collect('goodReason'), negative: collect('badReason') };
}
