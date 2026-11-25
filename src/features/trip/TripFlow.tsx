import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Icon, useSelectionPulse } from '../../components/common/UI';
import { Helix, Reveal } from '../../components/common/Motion';
import { ui } from '../../components/common/ui.styles';
import { confirmedKeywords, PreferenceSummary } from '../../components/profile/PreferenceSummary';
import {
  BackendClient,
  type ChatStart,
  type ChatTurn,
  type TripProfileInput,
} from '../../services/backend/client';
import type { ServerTrip } from '../../services/storage/serverTrip';
import { theme } from '../../theme';
import { tripStyles as ts } from './trip.styles';

type Phase = 'profile' | 'likert' | 'asking' | 'constraints' | 'draft' | 'confirmed';
type Busy = 'request' | 'chat' | 'recommendation';
type Confirmed = { keywords: string[]; mustHave: string; mustAvoid: string };
const initial: TripProfileInput = {
  party_size: '2',
  companion_type: 'friends',
  duration: '2n3d',
  transport: 'walk_subway',
  budget_level: 'mid',
  time_window: 'morning',
};
const groups = [
  [
    'party_size',
    '인원',
    [
      ['1', '1명'],
      ['2', '2명'],
      ['3-4', '3–4명'],
      ['5+', '5명 이상'],
    ],
  ],
  [
    'companion_type',
    '동행',
    [
      ['solo', '혼자'],
      ['couple', '연인'],
      ['friends', '친구'],
      ['family', '가족'],
      ['with_kids', '아이와 함께'],
    ],
  ],
  [
    'transport',
    '주 이동 수단',
    [
      ['walk_subway', '도보·지하철'],
      ['bus_ok', '버스 포함'],
      ['taxi_car', '택시·차량'],
      ['minimize', '이동 최소화'],
    ],
  ],
  [
    'budget_level',
    '전체 여행 예산',
    [
      ['low', '낮음'],
      ['mid', '보통'],
      ['high', '높음'],
    ],
  ],
  [
    'time_window',
    '주로 활동할 시간',
    [
      ['morning', '오전'],
      ['afternoon', '오후'],
      ['evening', '저녁'],
    ],
  ],
] as const;
const heading: Record<Phase, string> = {
  profile: '어떤 서울 여행을\n떠나고 싶나요?',
  likert: '어떤 여행에\n마음이 가나요?',
  asking: '기억하고 싶은 장면',
  constraints: '여행에 꼭 담을 것',
  draft: '여행 취향 확인',
  confirmed: '당신의 Travel DNA',
};

function SurveyProgress({ count, total }: { count: number; total: number }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    const percent = count / total;
    progress.value = reduce ? percent : withTiming(percent, { duration: theme.motion.reveal });
    return () => cancelAnimation(progress);
  }, [count, total, progress, reduce]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View
      style={ts.title}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: count }}
    >
      <Text style={ts.progress}>
        응답 {count} / {total}
      </Text>
      <View style={ts.progressTrack}>
        <Animated.View style={[ts.progressFill, fill]} />
      </View>
    </View>
  );
}

function Rating({
  value,
  label,
  selected,
  onPress,
}: {
  value: number;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const pulse = useSelectionPulse(selected);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[ts.number, selected && ts.numberSelected]}
    >
      <Animated.Text style={[ts.numberText, selected && ts.userText, pulse]}>{value}</Animated.Text>
    </Pressable>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onResult: (trip: ServerTrip) => void;
  previousTrip: ServerTrip | null;
}

export function TripFlow({ visible, onClose, onResult, previousTrip }: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const request = useRef(false);
  const [profile, setProfile] = useState(initial);
  const [purpose, setPurpose] = useState('');
  const [profileId, setProfileId] = useState('');
  const [session, setSession] = useState<ChatStart | null>(null);
  const [turn, setTurn] = useState<ChatTurn | null>(null);
  const [phase, setPhase] = useState<Phase>('profile');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [mustHave, setMustHave] = useState('');
  const [mustAvoid, setMustAvoid] = useState('');
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState('');
  const [webHeight, setWebHeight] = useState<number>();
  const loading = busy !== null;
  const url = process.env.EXPO_PUBLIC_RECOMMENDATION_SERVER_URL ?? '';
  const client = new BackendClient(url, 30000);

  useEffect(() => {
    if (visible) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [phase, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () =>
      setWebHeight(
        viewport.scale === 1 && viewport.height + 100 < window.innerHeight
          ? viewport.height
          : undefined,
      );
    resize();
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, [visible]);

  const act = async (kind: Busy, work: () => Promise<void>) => {
    if (request.current) return;
    request.current = true;
    setBusy(kind);
    setError('');
    try {
      await work();
    } catch (e) {
      const detail = e instanceof Error ? e.message : '요청에 실패했어요.';
      const upstream = detail.match(/HTTP (50[23])/);
      setError(
        upstream
          ? `여행 서버가 응답을 완료하지 못했어요 (HTTP ${upstream[1]}). 같은 단계에서 다시 시도해 주세요.`
          : detail,
      );
    } finally {
      request.current = false;
      setBusy(null);
    }
  };

  const begin = () =>
    act('request', async () => {
      if (!url.trim())
        throw new Error('여행 취향 서버에 연결할 수 없어요. 지도에서 데모 장소를 탐색해 보세요.');
      Keyboard.dismiss();
      const id = (await client.createProfile(profile)).id;
      setProfileId(id);
      const started = await client.start();
      setSession(started);
      setTurn(started);
      setPhase('likert');
    });
  const applyTurn = (next: ChatTurn) => {
    setTurn(next);
    setPhase(next.phase);
  };
  const submitLikert = () =>
    act('request', async () => {
      if (!session || session.likert_items.some((item) => !answers[item.id])) return;
      const next = await client.likert(
        session.session_id,
        session.likert_items.map((item) => ({ id: item.id, value: answers[item.id] })),
      );
      setHistory([{ role: 'assistant', text: next.assistant_message }]);
      applyTurn(next);
    });
  const send = (value: string) =>
    act('chat', async () => {
      const text = value.trim();
      if (!session || !text) return;
      setPendingMessage(text);
      try {
        const next = await client.message(session.session_id, text);
        setHistory((h) => [
          ...h,
          { role: 'user', text },
          { role: 'assistant', text: next.assistant_message },
        ]);
        setMessage('');
        if (next.phase !== 'asking') Keyboard.dismiss();
        applyTurn(next);
      } finally {
        setPendingMessage('');
      }
    });
  const constraints = () =>
    act('request', async () => {
      if (!session) return;
      Keyboard.dismiss();
      const wanted = [purpose.trim() && `여행 목적: ${purpose.trim()}`, mustHave.trim()]
        .filter(Boolean)
        .join('\n');
      applyTurn(await client.constraints(session.session_id, wanted, mustAvoid));
    });
  const finalize = () =>
    act('request', async () => {
      if (!session) return;
      const result = await client.finalize(session.session_id);
      setConfirmed({
        keywords: confirmedKeywords(result.travel_dna),
        mustHave: typeof result.must_have === 'string' ? result.must_have : '',
        mustAvoid: typeof result.must_avoid === 'string' ? result.must_avoid : '',
      });
      setPhase('confirmed');
    });
  const find = () =>
    act('recommendation', async () => {
      if (!session || !profileId) return;
      const result = await client.find(profileId, session.session_id);
      onResult({ serverUrl: url.trim(), profileId, sessionId: session.session_id, result });
      onClose();
    });
  const retryPrevious = () =>
    act('recommendation', async () => {
      if (!previousTrip) return;
      const state = await client.getSession(previousTrip.sessionId);
      if (!state || typeof state !== 'object' || !('phase' in state) || state.phase !== 'confirmed')
        throw new Error('이전 취향 세션이 확정 상태가 아니에요. 처음부터 시작해 주세요.');
      const result = await client.find(previousTrip.profileId, previousTrip.sessionId);
      onResult({ ...previousTrip, result });
      onClose();
    });
  const reset = () => {
    setProfileId('');
    setSession(null);
    setTurn(null);
    setAnswers({});
    setHistory([]);
    setMessage('');
    setConfirmed(null);
    setPhase('profile');
    setError('');
  };
  const close = () => {
    if (request.current) return;
    Keyboard.dismiss();
    onClose();
  };
  const chat = phase === 'asking';
  const displayedHistory = pendingMessage
    ? [...history, { role: 'user', text: pendingMessage }]
    : history;
  const submit = {
    profile: { title: '취향 설문 시작', action: begin },
    likert: { title: '설문 제출', action: submitLikert },
    constraints: { title: '조건 제출', action: constraints },
    draft: { title: '취향 확정', action: finalize },
    confirmed: { title: '서울 장소 추천 받기', action: find },
  } as const;

  return (
    <Modal visible={visible} animationType={reduce ? 'none' : 'fade'} onRequestClose={close}>
      {busy === 'recommendation' ? (
        <View style={ts.loading} accessibilityLiveRegion="polite">
          <Reveal style={ts.loadingInner}>
            <Text style={[ui.eyebrow, ts.kicker]}>Travel DNA</Text>
            <Helix active light />
            <Text accessibilityRole="header" style={[ui.title, ts.lightTitle]}>
              서울에서 만날 장소를 찾고 있어요
            </Text>
            <Text style={[ui.body, ts.lightBody]}>
              확정한 취향과 여행 조건으로 서버에 추천을 요청했어요.
            </Text>
          </Reveal>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={[ts.root, webHeight !== undefined && { flex: 0, height: webHeight }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[ts.top, { paddingTop: insets.top }]}>
            <View style={[ts.column, ts.topInner]}>
              <Text style={ui.eyebrow}>Travel DNA · 서울</Text>
              <View style={ts.toolbarActions}>
                {phase !== 'profile' && (
                  <Pressable
                    accessibilityRole="button"
                    style={ts.reset}
                    disabled={loading}
                    onPress={reset}
                  >
                    <Text style={ts.helper}>처음부터 다시 시작</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                  onPress={close}
                  disabled={loading}
                >
                  <Text style={ts.close}>닫기</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <ScrollView
            ref={scroll}
            onContentSizeChange={() => {
              if (chat) scroll.current?.scrollToEnd({ animated: !reduce });
            }}
            onLayout={() => {
              if (chat) scroll.current?.scrollToEnd({ animated: false });
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[ts.column, ts.content]}
          >
            <Reveal key={phase} style={ts.stage}>
              <Text accessibilityRole="header" style={ui.title}>
                {heading[phase]}
              </Text>
              {phase === 'profile' && (
                <>
                  <View style={ts.scope}>
                    <Icon name="calendar-outline" />
                    <View style={ts.scopeCopy}>
                      <Text style={ui.subtitle}>서울 · 2박 3일</Text>
                      <Text style={ui.small}>이번 여행은 서울의 3일 일정으로 만들어요.</Text>
                    </View>
                  </View>
                  {groups.map(([key, label, values]) => (
                    <View key={key} style={ts.group}>
                      <Text style={ui.label}>{label}</Text>
                      <View style={ui.wrap}>
                        {values.map(([value, name]) => (
                          <Chip
                            key={value}
                            label={name}
                            selected={profile[key] === value}
                            disabled={loading}
                            onPress={() => setProfile((current) => ({ ...current, [key]: value }))}
                          />
                        ))}
                      </View>
                      {key === 'budget_level' && (
                        <TextInput
                          accessibilityLabel="전체 여행 예산 메모"
                          placeholderTextColor={theme.colors.muted}
                          placeholder="예산 메모 (선택)"
                          value={profile.budget_note ?? ''}
                          onChangeText={(budget_note) =>
                            setProfile((current) => ({ ...current, budget_note }))
                          }
                          style={ui.input}
                        />
                      )}
                    </View>
                  ))}
                  <View style={ts.conditionField}>
                    <Text style={ui.label}>여행 목적</Text>
                    <TextInput
                      accessibilityLabel="여행 목적"
                      placeholderTextColor={theme.colors.muted}
                      placeholder="예: 전시를 보고 동네를 걷고 싶어요"
                      maxLength={90}
                      value={purpose}
                      onChangeText={setPurpose}
                      style={ui.input}
                    />
                  </View>
                  <Text style={ui.small}>
                    입력한 조건은 추천 서버로 전달됩니다. 예산 충족 여부는 방문 전 확인해 주세요.
                  </Text>
                  {previousTrip && (
                    <Button
                      title="이전 확정 취향으로 다시 추천"
                      secondary
                      onPress={retryPrevious}
                      disabled={loading}
                    />
                  )}
                </>
              )}
              {phase === 'likert' && session && (
                <>
                  <Text style={ui.body}>{turn?.assistant_message}</Text>
                  <SurveyProgress
                    count={Object.keys(answers).length}
                    total={session.likert_items.length}
                  />
                  {session.likert_items.map((item, index) => {
                    const scale = [...item.scale].sort((a, b) => a.value - b.value);
                    return (
                      <View key={item.id} style={ts.question}>
                        <View style={ts.questionHead}>
                          <Text style={ts.ordinal}>{String(index + 1).padStart(2, '0')}</Text>
                          <Text lineBreakStrategyIOS="hangul-word" style={ts.questionTitle}>
                            {item.statement_ko}
                          </Text>
                        </View>
                        <View style={ts.numbers} accessibilityRole="radiogroup">
                          {scale.map(({ value, label_ko }) => (
                            <Rating
                              key={value}
                              value={value}
                              label={`${index + 1}번 문항 ${value}점 ${label_ko}`}
                              selected={answers[item.id] === value}
                              onPress={() =>
                                setAnswers((current) => ({ ...current, [item.id]: value }))
                              }
                            />
                          ))}
                        </View>
                        <View style={ui.between}>
                          <Text style={ui.small}>{scale[0].label_ko}</Text>
                          <Text style={ui.small}>{scale[scale.length - 1].label_ko}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              {chat && (
                <>
                  {displayedHistory.map((entry, index) => {
                    const user = entry.role === 'user';
                    return (
                      <Reveal
                        key={`${index}-${entry.role}-${entry.text}`}
                        style={[ts.bubble, user && ts.userBubble]}
                      >
                        <Text style={[ts.messageLabel, user && ts.userText]}>
                          {user ? '나' : 'Travel DNA'}
                        </Text>
                        <Text
                          lineBreakStrategyIOS="hangul-word"
                          style={[ui.body, ts.chatText, user && ts.userText]}
                        >
                          {entry.text}
                        </Text>
                      </Reveal>
                    );
                  })}
                  {busy === 'chat' && (
                    <Reveal style={[ts.bubble, ts.status]}>
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                      <Text accessibilityLiveRegion="polite" style={ui.small}>
                        Travel DNA가 답변을 준비하고 있어요
                      </Text>
                    </Reveal>
                  )}
                </>
              )}
              {phase === 'constraints' && (
                <>
                  <Text style={ui.body}>{turn?.assistant_message}</Text>
                  <View style={ts.conditionField}>
                    <Text style={ui.label}>꼭 원하는 것</Text>
                    <TextInput
                      accessibilityLabel="꼭 원하는 것"
                      placeholderTextColor={theme.colors.muted}
                      placeholder="예: 박물관이나 미술관 (선택)"
                      value={mustHave}
                      onChangeText={setMustHave}
                      maxLength={400}
                      multiline
                      style={[ui.input, ts.conditionInput]}
                    />
                  </View>
                  <View style={ts.conditionField}>
                    <Text style={ui.label}>피하고 싶은 것</Text>
                    <TextInput
                      accessibilityLabel="피하고 싶은 것"
                      placeholderTextColor={theme.colors.muted}
                      placeholder="예: 늦은 밤 술집 (선택)"
                      value={mustAvoid}
                      onChangeText={setMustAvoid}
                      maxLength={500}
                      multiline
                      style={[ui.input, ts.conditionInput]}
                    />
                  </View>
                </>
              )}
              {phase === 'draft' && (
                <>
                  <Text style={ui.body}>{turn?.assistant_message}</Text>
                  {purpose.trim() ? (
                    <Text style={ui.body}>여행 목적 · {purpose.trim()}</Text>
                  ) : null}
                  <PreferenceSummary mustHave={mustHave} mustAvoid={mustAvoid} />
                  <Button
                    title="조건 수정"
                    secondary
                    onPress={() => setPhase('constraints')}
                    disabled={loading}
                  />
                </>
              )}
              {phase === 'confirmed' && (
                <>
                  <Helix />
                  <Text style={ui.body}>
                    설문과 대화에서 확정한 취향을 바탕으로 서울의 장소를 찾아요.
                  </Text>
                  {confirmed && <PreferenceSummary {...confirmed} />}
                </>
              )}
            </Reveal>
          </ScrollView>
          <View style={[ts.footer, { paddingBottom: insets.bottom }]}>
            <View style={[ts.column, ts.footerInner]}>
              {!!error && (
                <Text accessibilityRole="alert" style={ts.error}>
                  {error}
                </Text>
              )}
              {chat ? (
                <>
                  {turn?.chips.length ? (
                    <ScrollView
                      horizontal
                      keyboardShouldPersistTaps="handled"
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={ui.row}
                    >
                      {turn.chips.map((chip) => (
                        <Chip
                          key={chip}
                          label={chip}
                          selected={false}
                          disabled={loading}
                          onPress={() => send(chip)}
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                  <View style={ts.composer}>
                    <TextInput
                      accessibilityLabel="대화 답변"
                      placeholderTextColor={theme.colors.muted}
                      placeholder="어떤 여행을 좋아하나요?"
                      value={message}
                      onChangeText={setMessage}
                      style={[ui.input, ts.messageInput]}
                      editable={!loading}
                      multiline
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="답변 보내기"
                      accessibilityState={{ disabled: loading || !message.trim() }}
                      disabled={loading || !message.trim()}
                      onPress={() => send(message)}
                      style={[ts.send, (loading || !message.trim()) && { opacity: 0.5 }]}
                    >
                      <Icon name="arrow-up" color={theme.colors.white} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {loading && (
                    <View style={ts.status}>
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                      <Text accessibilityLiveRegion="polite" style={ui.small}>
                        서버 응답을 기다리고 있어요
                      </Text>
                    </View>
                  )}
                  <Button
                    title={submit[phase].title}
                    onPress={submit[phase].action}
                    disabled={
                      loading ||
                      (phase === 'likert' &&
                        Boolean(session?.likert_items.some((item) => !answers[item.id])))
                    }
                  />
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
