import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ATTRIBUTES, CONFLICTS } from '../../types';
import { attributeLabels, conflictLabels } from '../../data/mock/places';
import { Button, FadeIn, Icon, Screen } from '../../components/common/UI';
import { Helix, Reveal } from '../../components/common/Motion';
import { confirmedKeywords, PreferenceSummary } from '../../components/profile/PreferenceSummary';
import { theme as t } from '../../theme';
import { DNABars } from '../../components/profile/DNABars';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { BackendClient } from '../../services/backend/client';
import { TripFlow } from '../trip/TripFlow';
export default function DNAScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { data, dna, completeOnboarding, serverTrip, applyServerResult } = useTravel();
  const [editing, setEditing] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{
    keywords: string[];
    mustHave: string;
    mustAvoid: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setSession(null);
    setSessionError(false);
    if (serverTrip)
      new BackendClient(serverTrip.serverUrl)
        .getSession(serverTrip.sessionId)
        .then((value) => {
          if (!active) return;
          if (!value || typeof value !== 'object') throw new Error('Invalid session data');
          const v = value as Record<string, unknown>;
          const confirmed =
            v.confirmed_dna && typeof v.confirmed_dna === 'object'
              ? (v.confirmed_dna as Record<string, unknown>)
              : {};
          setSession({
            keywords: confirmedKeywords(confirmed),
            mustHave: typeof v.must_have === 'string' ? v.must_have : '',
            mustAvoid: typeof v.must_avoid === 'string' ? v.must_avoid : '',
          });
        })
        .catch(() => {
          if (active) setSessionError(true);
        });
    return () => {
      active = false;
    };
  }, [attempt, serverTrip]);
  const router = useRouter();
  const top = [...ATTRIBUTES]
    .filter((k) => dna.preferences[k] > 0)
    .sort((a, b) => dna.preferences[b] - dna.preferences[a])
    .slice(0, 3);
  return (
    <Screen>
      <Reveal style={s.hero}>
        <Text style={[ui.eyebrow, s.lightKicker]}>Travel DNA</Text>
        <Text accessibilityRole="header" style={[ui.title, s.lightTitle]}>
          나의 여행 취향
        </Text>
        <Helix light />
        <Text style={s.lightCopy}>
          {data.demo ? '데모 여행 기록' : `${data.nickname}님의 여행 기록`} ·{' '}
          {data.experiences.length}개
        </Text>
      </Reveal>
      {serverTrip && (
        <View style={s.section}>
          <Text style={ui.eyebrow}>설문 · 대화</Text>
          <Text style={ui.subtitle}>최근 확정한 서버 취향</Text>
          {session ? (
            <PreferenceSummary {...session} />
          ) : sessionError ? (
            <>
              <Text accessibilityRole="alert" style={ui.body}>
                서버의 대화와 조건을 불러오지 못했어요. 최근 추천 일정은 이 기기에 남아 있어요.
              </Text>
              <Button
                title="서버 취향 다시 불러오기"
                secondary
                onPress={() => setAttempt((value) => value + 1)}
              />
            </>
          ) : (
            <View style={ui.row}>
              <ActivityIndicator size="small" color={t.colors.accent} />
              <Text accessibilityLiveRegion="polite" style={ui.small}>
                서버 취향을 불러오는 중
              </Text>
            </View>
          )}
          <Button title="여행 취향 다시 설정" secondary onPress={() => setEditing(true)} />
        </View>
      )}
      <FadeIn>
        <View style={s.section}>
          <Text style={ui.eyebrow}>이 기기의 여행 기록</Text>
          <Text style={ui.title}>{dna.title}</Text>
          <Text style={ui.body}>
            남긴 여행 기록에서 좋아하는 경험과 피하고 싶은 경험을 살펴볼 수 있어요.
          </Text>
        </View>
      </FadeIn>
      <View style={s.section}>
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
      <View style={s.section}>
        <Text style={ui.subtitle}>좋아하는 장면</Text>
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
      <TripFlow
        visible={editing}
        previousTrip={serverTrip}
        onClose={() => setEditing(false)}
        onResult={(trip) => {
          applyServerResult(trip);
          setEditing(false);
          router.navigate('/(tabs)');
        }}
      />
      <Button
        title="여행 기록 다듬기"
        secondary
        icon="journal-outline"
        onPress={() => router.push('/onboarding/experiences')}
      />
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: { backgroundColor: t.colors.ink, borderRadius: t.radius.lg, gap: 7, padding: 20 },
  lightKicker: { color: t.colors.mint },
  lightTitle: { color: t.colors.white },
  lightCopy: { color: '#C6DCD5', fontSize: 13, lineHeight: 20 },
  section: { paddingVertical: 14, borderTopWidth: 1, borderColor: t.colors.line, gap: 12 },
});
