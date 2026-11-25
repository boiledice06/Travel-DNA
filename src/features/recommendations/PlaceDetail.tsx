import { Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, IconButton, Photo, Screen } from '../../components/common/UI';
import { Reveal } from '../../components/common/Motion';
import { theme } from '../../theme';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { attributeLabels, conflictLabels, regions } from '../../data/mock/places';
import { s } from './place-detail.styles';
export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, recommendations, toggleSave, allPlaces } = useTravel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place =
    allPlaces.find((p) => p.id === id) ??
    allPlaces.find((p) => {
      try {
        return decodeURIComponent(p.id) === id;
      } catch {
        return false;
      }
    });
  const r = recommendations.find((r) => r.placeId === place?.id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  if (!place || !r)
    return (
      <Screen>
        <Text style={ui.title}>장소를 찾을 수 없어요</Text>
        <Button title="지도 홈으로" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  const saved = data.savedIds.includes(place.id);
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View>
          <Photo
            uri={place.image}
            category={place.category}
            style={place.image ? s.image : s.noImage}
          />
          <View style={[s.back, { top: insets.top + 12 }]}>
            <IconButton icon="arrow-back" label="이전 화면으로" onPress={back} />
          </View>
          {place.image ? (
            <View style={s.imageCaption}>
              <Text style={ui.small}>
                {place.source === 'api'
                  ? '사진 출처: 한국관광공사 TourAPI'
                  : '여행 분위기 참고 이미지 · 실제 장소 사진 아님'}
              </Text>
            </View>
          ) : null}
        </View>
        <Reveal style={s.body}>
          <Text style={ui.eyebrow}>
            {regions[place.region].name} · {place.category}
          </Text>
          <View style={ui.between}>
            <View style={{ flex: 1 }}>
              <Text style={[ui.title, { fontSize: 32 }]}>{place.name}</Text>
              <Text style={ui.body}>{place.district}</Text>
            </View>
            <IconButton
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              label={saved ? '장소 저장 취소' : '장소 저장'}
              active={saved}
              onPress={() => toggleSave(place.id)}
            />
          </View>
          {place.description ? <Text style={ui.body}>{place.description}</Text> : null}
          {place.source === 'api' && !!place.image && (
            <Text style={ui.small}>
              사진별 이용 조건을 확인해 주세요. 피사체의 권리를 침해하는 이용과 기업 CI·BI 이용은
              금지됩니다.{' '}
              <Text
                accessibilityRole="link"
                onPress={() => Linking.openURL('https://www.data.go.kr/data/15101578/openapi.do')}
                style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
              >
                TourAPI 이용 안내
              </Text>
            </Text>
          )}
          {place.source === 'api' &&
          r.reason === '서버에서 별도의 추천 이유를 제공하지 않았어요.' ? (
            <Text style={ui.small}>{r.reason}</Text>
          ) : (
            <View style={s.reason}>
              <View style={ui.between}>
                <View>
                  <Text style={ui.small}>
                    {place.source === 'api' ? '서버 추천 근거' : '데모 · 예상 일치도'}
                  </Text>
                  {r.score !== null && (
                    <Text style={s.score}>
                      {r.score}
                      <Text style={{ fontSize: 16, letterSpacing: 0, color: theme.colors.muted }}>
                        {' '}
                        / 100
                      </Text>
                    </Text>
                  )}
                </View>
                <Icon name="finger-print-outline" size={42} color={theme.colors.accent} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  lineHeight: 25,
                  fontWeight: '600',
                  color: theme.colors.primary,
                }}
              >
                {r.reason}
              </Text>
              {place.source === 'curated-demo' && (
                <Text style={ui.small}>
                  선호 일치 가점과 기피 충돌 감점을 반영한 규칙 기반 지수입니다. 실제 만족 확률이
                  아닙니다.
                </Text>
              )}
            </View>
          )}
          {place.source === 'curated-demo' && (
            <>
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
                    <Icon name="checkmark-circle-outline" color={theme.colors.accent} size={19} />
                    <Text style={[ui.body, { flex: 1 }]}>
                      {attributeLabels[k]} · 기록에서 선호한 특성과 일치
                    </Text>
                  </View>
                ))}
                {r.conflictingAttributes.map((k) => (
                  <View key={k} style={s.feature}>
                    <Icon name="alert-circle-outline" color={theme.colors.warm} size={19} />
                    <Text style={[ui.body, { flex: 1 }]}>
                      {conflictLabels[k]} · 기록에서 기피한 특성과 충돌 가능
                    </Text>
                  </View>
                ))}
                {!r.matchedAttributes.length && !r.conflictingAttributes.length && (
                  <Text style={ui.body}>
                    기록을 추가하면 이 장소와 취향의 연결을 확인할 수 있어요.
                  </Text>
                )}
              </View>
            </>
          )}
          <Text style={ui.small}>
            {place.source === 'api'
              ? `장소 데이터 출처: ${place.sourceName}`
              : '장소 특성은 시연용 편집 데이터입니다.'}{' '}
            운영 시간, 요금, 방문 제한은 방문 전 공식 안내를 확인해 주세요.
          </Text>
          <Button
            title={saved ? '저장한 장소 · 저장 취소' : '다음 여행을 위해 저장'}
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            onPress={() => toggleSave(place.id)}
          />
          <Button title="지도 탐색 계속하기" secondary onPress={back} />
        </Reveal>
      </ScrollView>
    </View>
  );
}
