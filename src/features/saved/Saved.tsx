import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Empty, Screen } from '../../components/common/UI';
import { PlaceCard } from '../../components/place/PlaceCard';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { places } from '../../data/mock/places';
export default function Saved() {
  const { data, recommendations, toggleSave } = useTravel();
  const router = useRouter();
  const saved = data.savedIds.flatMap((id) => {
    const p = places.find((p) => p.id === id);
    return p ? [p] : [];
  });
  return (
    <Screen>
      <Text style={ui.eyebrow}>PLACES TO COME BACK TO</Text>
      <Text style={ui.title}>다음 여행의{'\n'}작은 위시리스트.</Text>
      <Text style={ui.body}>
        마음에 닿은 장소 {saved.length}곳.{'\n'}저장한 장소는 이 기기에 계속 남아 있어요.
      </Text>
      {saved.length === 0 && (
        <Empty
          title="마음에 드는 곳을 담아보세요"
          message="지도나 장소 상세에서 북마크를 누르면 여기에 모입니다."
        />
      )}
      {saved.map((p) => (
        <PlaceCard
          key={p.id}
          place={p}
          recommendation={recommendations.find((r) => r.placeId === p.id)!}
          saved
          onSave={() => toggleSave(p.id)}
          onOpen={() => router.push({ pathname: '/place/[id]', params: { id: p.id } })}
        />
      ))}
      <Button
        title="지도에서 더 발견하기"
        secondary
        icon="map-outline"
        onPress={() => router.push('/(tabs)')}
      />
    </Screen>
  );
}
