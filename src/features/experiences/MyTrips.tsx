import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Empty, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { createItinerary } from '../../services/itinerary';

export default function MyTrips() {
  const { serverTrip } = useTravel();
  const router = useRouter();
  const days = serverTrip ? createItinerary(serverTrip.result.places) : [];
  return (
    <Screen>
      <Text style={ui.eyebrow}>YOUR SEOUL ITINERARY</Text>
      <Text style={ui.title}>내 여행</Text>
      <Text style={ui.body}>
        이 기기에 저장된 최근 추천 일정이에요. 장소 순서는 직선 거리 기준이며 실제 이동 경로가
        아닙니다.
      </Text>
      {!serverTrip ? (
        <Empty
          title="아직 만든 일정이 없어요"
          message="지도에서 여행 조건과 취향을 입력하면 3일 일정이 이곳에 표시됩니다."
        />
      ) : (
        days.map((places, index) => (
          <View
            key={index}
            style={{
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#E3EAEE',
            }}
          >
            <Text style={ui.subtitle}>
              Day {index + 1} <Text style={ui.small}> · {places.length}곳</Text>
            </Text>
            {places.map((place, i) => (
              <Text key={place.id} style={ui.body}>
                {i + 1}. {place.name}
              </Text>
            ))}
            {!places.length && <Text style={ui.small}>배정된 장소가 없어요.</Text>}
          </View>
        ))
      )}
      <Button
        title="지도에서 일정 보기"
        icon="map-outline"
        onPress={() => router.push('/(tabs)')}
      />
      <Button
        title="여행 기록 보기"
        secondary
        icon="journal-outline"
        onPress={() => router.push('/onboarding/experiences')}
      />
    </Screen>
  );
}
