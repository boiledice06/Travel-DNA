import { Redirect } from 'expo-router';
import { useTravel } from '../src/hooks/useTravel';
export default function Index() {
  const { data } = useTravel();
  return <Redirect href={data.onboarded ? '/(tabs)' : '/onboarding'} />;
}
