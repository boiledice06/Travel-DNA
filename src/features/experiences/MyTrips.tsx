import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Empty, Icon, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { createItinerary } from '../../services/itinerary';
import { theme as t } from '../../theme';

export default function MyTrips() {
  const { serverTrip } = useTravel();
  const router = useRouter();
  const days = serverTrip ? createItinerary(serverTrip.result.places) : [];
  return (
    <Screen>
      <View style={s.heading}>
        <Text style={ui.eyebrow}>서울 · 2박 3일</Text>
        <Text accessibilityRole="header" style={ui.title}>
          내 여행
        </Text>
        <Text style={ui.body}>이 기기에 저장한 최근 추천 일정이에요.</Text>
      </View>
      {!serverTrip ? (
        <Empty
          title="아직 만든 일정이 없어요"
          message="지도에서 여행을 설계하면 3일 일정이 여기에 표시됩니다."
        />
      ) : (
        <>
          {days.map((places, day) => (
            <View key={day} style={s.day}>
              <View style={ui.between}>
                <Text accessibilityRole="header" style={ui.subtitle}>
                  Day {day + 1}
                </Text>
                <Text style={ui.small}>{places.length}곳</Text>
              </View>
              {places.map((place, index) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${index + 1}번째 방문, ${place.name} 상세 보기`}
                  style={s.stop}
                  onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
                >
                  <View style={s.track}>
                    <Text style={s.order}>{index + 1}</Text>
                    {index < places.length - 1 && <View style={s.line} />}
                  </View>
                  <View style={s.stopCopy}>
                    <Text style={s.name}>{place.name}</Text>
                    <Text style={ui.small} numberOfLines={1}>
                      {place.district || place.category}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={17} color={t.colors.muted} />
                </Pressable>
              ))}
              {!places.length && <Text style={ui.small}>이 날에는 배정된 장소가 없어요.</Text>}
            </View>
          ))}
          <Text style={ui.small}>
            방문 순서는 장소 간 직선 거리를 기준으로 정했어요. 실제 이동 경로는 지도 앱에서 확인해
            주세요.
          </Text>
        </>
      )}
      <Button
        title="지도에서 일정 보기"
        icon="map-outline"
        onPress={() => router.navigate('/(tabs)')}
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

const s = StyleSheet.create({
  heading: { gap: 8, paddingTop: 6 },
  day: { borderTopWidth: 1, borderColor: t.colors.line, paddingTop: 14 },
  stop: { flexDirection: 'row', minHeight: 60, alignItems: 'center', gap: 12 },
  track: { width: 30, alignSelf: 'stretch', alignItems: 'center', paddingTop: 9 },
  order: {
    color: t.colors.primary,
    backgroundColor: t.colors.pale,
    textAlign: 'center',
    width: 27,
    lineHeight: 27,
    borderRadius: 14,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 12,
  },
  line: { flex: 1, width: 1, backgroundColor: t.colors.line, marginBottom: -8 },
  stopCopy: { flex: 1, paddingVertical: 8, gap: 2 },
  name: { fontSize: 15, color: t.colors.text, fontWeight: '700', lineHeight: 21 },
});
