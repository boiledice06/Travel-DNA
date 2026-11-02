import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Travel DNA',
  slug: 'travel-dna',
  version: '1.0.0',
  scheme: 'traveldna',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { bundleIdentifier: 'com.traveldna.mvp', supportsTablet: true },
  android: { package: 'com.traveldna.mvp' },
  web: { bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    'expo-splash-screen',
    [
      'expo-location',
      { locationWhenInUsePermission: '지도에서 내 위치로 이동하기 위해 위치를 사용합니다.' },
    ],
    ...(process.env.GOOGLE_MAPS_API_KEY
      ? ([['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }]] as [
          string,
          Record<string, string>,
        ][])
      : []),
  ],
};
export default config;
