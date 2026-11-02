import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, IconButton, Photo, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { attributeLabels, conflictLabels, places, regions } from '../../data/mock/places';
import { s } from './place-detail.styles';
export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, recommendations, toggleSave } = useTravel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place = places.find((p) => p.id === id);
  const r = recommendations.find((r) => r.placeId === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  if (!place || !r)
    return (
      <Screen>
        <Text style={ui.title}>장소를 찾을 수 없어요</Text>
        <Button title="지도 홈으로" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  const saved = data.savedIds.includes(id);
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View>
          <Photo uri={place.image} style={s.image} />
          <View style={[s.back, { top: insets.top + 12 }]}>
            <IconButton icon="arrow-back" label="이전 화면으로" onPress={back} />
          </View>
          <View style={s.imageCaption}>
            <Text style={ui.small}>여행 분위기 참고 이미지 · 실제 장소 사진 아님</Text>
          </View>
        </View>
        <View style={s.body}>
          <Text style={ui.eyebrow}>{regions[place.region].english}</Text>
          <View style={ui.between}>
            <View style={{ flex: 1 }}>
              <Text style={[ui.title, { fontSize: 32 }]}>{place.name}</Text>
              <Text style={ui.body}>{place.district}</Text>
            </View>
            <IconButton
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              label={saved ? '장소 저장 취소' : '장소 저장'}
              active={saved}
              onPress={() => toggleSave(id)}
            />
          </View>
          <Text style={ui.body}>{place.description}</Text>
          <View style={s.reason}>
            <View style={ui.between}>
              <View>
                <Text style={ui.small}>
                  {data.demo ? '데모 기록 기반' : '나의 기록 기반'} 예상 일치도
                </Text>
                <Text style={s.score}>
                  {r.score}
                  <Text style={{ fontSize: 16, letterSpacing: 0, color: '#68788A' }}> / 100</Text>
                </Text>
              </View>
              <Icon name="finger-print-outline" size={42} color="#3DB8BC" />
            </View>
            <Text style={{ fontSize: 16, lineHeight: 25, fontWeight: '600', color: '#174A7E' }}>
              {r.reason}
            </Text>
            <Text style={ui.small}>
              선호 일치 가점과 기피 충돌 감점을 반영한 규칙 기반 지수입니다. 실제 만족 확률이
              아닙니다.
            </Text>
          </View>
          <Text style={ui.subtitle}>이 장소를 이루는 장면</Text>
          <View style={ui.wrap}>
            {Object.keys(place.positiveAttributes).map((k) => (
              <Text key={k} style={ui.badge}>
                {attributeLabels[k as keyof typeof attributeLabels]}
              </Text>
            ))}
          </View>
          <View style={ui.card}>
            <Text style={ui.subtitle}>나의 취향과 연결해 보면</Text>
            {r.matchedAttributes.map((k) => (
              <View key={k} style={s.feature}>
                <Icon name="checkmark-circle-outline" color="#3DB8BC" size={19} />
                <Text style={[ui.body, { flex: 1 }]}>
                  {attributeLabels[k]} · 기록에서 선호한 특성과 일치
                </Text>
              </View>
            ))}
            {r.conflictingAttributes.map((k) => (
              <View key={k} style={s.feature}>
                <Icon name="alert-circle-outline" color="#F48B79" size={19} />
                <Text style={[ui.body, { flex: 1 }]}>
                  {conflictLabels[k]} · 기록에서 기피한 특성과 충돌 가능
                </Text>
              </View>
            ))}
            {!r.matchedAttributes.length && !r.conflictingAttributes.length && (
              <Text style={ui.body}>기록을 추가하면 이 장소와 취향의 연결을 확인할 수 있어요.</Text>
            )}
          </View>
          <Text style={ui.small}>
            장소 특성은 시연용 편집 데이터입니다. 운영 시간, 요금, 방문 제한은 방문 전 공식 안내를
            확인해 주세요.
          </Text>
          <Button
            title={saved ? '저장한 장소 · 저장 취소' : '다음 여행을 위해 저장'}
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            onPress={() => toggleSave(id)}
          />
          <Button title="지도 탐색 계속하기" secondary onPress={back} />
        </View>
      </ScrollView>
    </View>
  );
}
