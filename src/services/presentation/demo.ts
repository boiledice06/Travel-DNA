type DemoBootstrap = {
  epoch: string;
  scenario?: 'a' | 'b';
  photos: Record<string, string>;
};

const bootstrap = (globalThis as typeof globalThis & { __TRAVEL_DNA_DEMO__?: DemoBootstrap })
  .__TRAVEL_DNA_DEMO__;

export const presentationMode = process.env.EXPO_PUBLIC_TRAVEL_PRESENTATION === '1';

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
  const local = bootstrap?.photos[source];
  return local && /^\/demo-assets\/[a-f0-9]{64}\.(bmp|jpg|png|webp)$/.test(local)
    ? local
    : undefined;
}
