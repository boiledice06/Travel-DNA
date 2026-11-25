type DemoBootstrap = {
  protocol: string;
  epoch: string;
  scenario: 'a' | 'b';
  photos: Record<string, string>;
};

const protocol = 'travel-dna-presentation-v2';
const candidate = (
  globalThis as typeof globalThis & { __TRAVEL_DNA_DEMO__?: Partial<DemoBootstrap> }
).__TRAVEL_DNA_DEMO__;

const bootstrap =
  candidate?.protocol === protocol &&
  typeof candidate.epoch === 'string' &&
  candidate.epoch.length > 0 &&
  (candidate.scenario === 'a' || candidate.scenario === 'b') &&
  candidate.photos &&
  typeof candidate.photos === 'object' &&
  !Array.isArray(candidate.photos)
    ? candidate
    : undefined;

const presentationDocument =
  typeof document !== 'undefined' &&
  document.querySelector('meta[name="travel-dna-presentation"]') !== null;

export const presentationMode =
  !!candidate || presentationDocument || process.env.EXPO_PUBLIC_TRAVEL_PRESENTATION === '1';

export const presentationStartupFailed = presentationMode && !bootstrap;

export const recommendationServerUrl = presentationMode
  ? bootstrap && typeof window !== 'undefined'
    ? `${window.location.origin}${bootstrap.scenario === 'a' ? '/demo-api/a' : ''}`
    : ''
  : process.env.EXPO_PUBLIC_RECOMMENDATION_SERVER_URL;

export function travelStorageKey(normalKey: string): string {
  if (!presentationMode) return normalKey;
  const scenarioPrefix = bootstrap?.scenario === 'a' ? 'a/' : '';
  return `@travel-dna/presentation/${scenarioPrefix}${bootstrap?.epoch ?? 'inactive'}/${normalKey.slice('@travel-dna/'.length)}`;
}

export function presentationPhotoUrl(source: string): string | undefined {
  if (!presentationMode) return source;
  const local = bootstrap?.photos?.[source];
  return typeof local === 'string' &&
    /^\/demo-assets\/[a-f0-9]{64}\.(bmp|jpg|png|webp)$/.test(local)
    ? local
    : undefined;
}
