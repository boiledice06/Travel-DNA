import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ATTRIBUTES, CONFLICTS } from '../../types';
import { attributeLabels, conflictLabels } from '../../data/mock/places';
import { Button, FadeIn, Icon, Screen } from '../../components/common/UI';
import { DNABars } from '../../components/profile/DNABars';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
export default function DNAScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { data, dna, completeOnboarding } = useTravel();
  const router = useRouter();
  const top = [...ATTRIBUTES]
    .filter((k) => dna.preferences[k] > 0)
    .sort((a, b) => dna.preferences[b] - dna.preferences[a])
    .slice(0, 3);
  return (
    <Screen>
      <View style={ui.between}>
        <Text style={ui.eyebrow}>YOUR TRAVEL DNA</Text>
        <Text style={ui.badge}>
          {data.demo ? '데모 프로필' : data.experiences.length + '개의 기억'}
        </Text>
      </View>
      <FadeIn>
        <View style={{ gap: 16 }}>
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 24,
              backgroundColor: '#EAF4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="finger-print-outline" size={46} color="#3DB8BC" />
          </View>
          <Text style={ui.title}>
            {dna.title}
            {dna.evidenceCount > 0 ? '입니다.' : '.'}
          </Text>
          <Text style={ui.body}>
            {data.nickname}님의 여행 기억 속에서 발견한 취향이에요. 새로운 경험을 남기면 이 프로필도
            함께 바뀝니다.
          </Text>
        </View>
      </FadeIn>
      <View style={ui.card}>
        <View style={ui.between}>
          <Text style={ui.subtitle}>취향의 스펙트럼</Text>
          <Icon name="analytics-outline" size={20} />
        </View>
        <DNABars dna={dna} />
        <Text style={ui.small}>
          0–100의 상대 선호 강도 · 가장 많이 지지된 태그를 기준으로 정규화합니다. 만족 확률이
          아닙니다.
        </Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.subtitle}>당신이 좋아하는 장면</Text>
        <View style={ui.wrap}>
          {top.length ? (
            top.map((k) => (
              <Text key={k} style={ui.badge}>
                {attributeLabels[k]}
              </Text>
            ))
          ) : (
            <Text style={ui.body}>좋았던 경험 태그를 선택해 주세요.</Text>
          )}
        </View>
        <View style={ui.divider} />
        <Text style={ui.subtitle}>조금 피하고 싶은 것</Text>
        <View style={ui.wrap}>
          {CONFLICTS.filter((k) => dna.aversions[k] > 0).map((k) => (
            <Text key={k} style={[ui.badge, { backgroundColor: '#FFF0EA', color: '#A66453' }]}>
              {conflictLabels[k]}
            </Text>
          ))}
          {!Object.values(dna.aversions).some((v) => v > 0) && (
            <Text style={ui.body}>아직 기피한 경험이 없어요.</Text>
          )}
        </View>
      </View>
      <View style={ui.row}>
        <Icon name="information-circle-outline" size={20} />
        <Text style={[ui.small, { flex: 1 }]}>
          로컬 규칙 기반 분석입니다. 장소 특성은 시연용으로 구성했으며, 추천 점수는 예상
          일치도입니다. 실제 리뷰 분석 또는 학습된 AI 결과가 아닙니다.
        </Text>
      </View>
      <Button
        title="나와 닮은 장소 발견하기"
        icon="arrow-forward"
        onPress={() => {
          if (onboarding) completeOnboarding();
          router.replace('/(tabs)');
        }}
      />
      <Button
        title="여행 기록 다듬기"
        secondary
        icon="journal-outline"
        onPress={() => router.push(onboarding ? '/onboarding/experiences' : '/(tabs)/experiences')}
      />
    </Screen>
  );
}
