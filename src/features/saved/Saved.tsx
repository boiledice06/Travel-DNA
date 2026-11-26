import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Empty, Screen } from '../../components/common/UI';
import { PlaceCard } from '../../components/place/PlaceCard';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
export default function Saved() {
  const { data, recommendations, toggleSave, allPlaces } = useTravel();
  const router = useRouter();
  const saved = data.savedIds.flatMap((id) => {
    const p = allPlaces.find((p) => p.id === id);
    return p ? [p] : [];
  });
  return (
    <Screen>
      <View style={{ gap: 8, paddingTop: 6 }}>
        <Text style={ui.eyebrow}>북마크</Text>
        <Text accessibilityRole="header" style={ui.title}>
          찜한 장소
        </Text>
        <Text style={ui.body}>저장한 장소 {saved.length}곳을 이 기기에서 다시 볼 수 있어요.</Text>
      </View>
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
          recommendation={recommendations.find((r) => r.placeId === p.id)}
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
