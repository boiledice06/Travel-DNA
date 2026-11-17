import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { s } from '../recommendations/map-home.styles';
import {
  BackendClient,
  type ChatStart,
  type ChatTurn,
  type TripProfileInput,
} from '../../services/backend/client';
import type { ServerTrip } from '../../services/storage/serverTrip';
import { tripStyles as ts } from './trip.styles';

type Phase = 'profile' | 'likert' | 'asking' | 'constraints' | 'draft' | 'confirmed';
const initial: TripProfileInput = {
  party_size: '2',
  companion_type: 'friends',
  duration: '2n3d',
  transport: 'walk_subway',
  budget_level: 'mid',
  time_window: 'morning',
};
const options = {
  party_size: [
    ['1', '1명'],
    ['2', '2명'],
    ['3-4', '3–4명'],
    ['5+', '5명 이상'],
  ],
  companion_type: [
    ['solo', '혼자'],
    ['couple', '연인'],
    ['friends', '친구'],
    ['family', '가족'],
    ['with_kids', '아이와 함께'],
  ],
  transport: [
    ['walk_subway', '도보·지하철'],
    ['bus_ok', '버스 포함'],
    ['taxi_car', '택시·차량'],
    ['minimize', '이동 최소화'],
  ],
  budget_level: [
    ['low', '낮음'],
    ['mid', '보통'],
    ['high', '높음'],
  ],
  time_window: [
    ['morning', '오전'],
    ['afternoon', '오후'],
    ['evening', '저녁'],
  ],
} as const;
interface Props {
  visible: boolean;
  onClose: () => void;
  onResult: (trip: ServerTrip) => void;
  previousTrip: ServerTrip | null;
}
export function TripFlow({ visible, onClose, onResult, previousTrip }: Props) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [profile, setProfile] = useState(initial);
  const [purpose, setPurpose] = useState('');
  const [profileId, setProfileId] = useState('');
  const [session, setSession] = useState<ChatStart | null>(null);
  const [turn, setTurn] = useState<ChatTurn | null>(null);
  const [phase, setPhase] = useState<Phase>('profile');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{ role: string; text: string }[]>([]);
  const [mustHave, setMustHave] = useState('');
  const [mustAvoid, setMustAvoid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [phase, visible]);
  const url = process.env.EXPO_PUBLIC_RECOMMENDATION_SERVER_URL ?? '';
  const client = new BackendClient(url, 30000);
  const act = async (work: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };
  const begin = () =>
    act(async () => {
      if (!url.trim())
        throw new Error(
          '서버 주소가 설정되지 않았어요. 데모를 이용하거나 서버 URL을 설정해 주세요.',
        );
      const id = (await client.createProfile(profile)).id;
      setProfileId(id);
      const started = await client.start();
      setSession(started);
      setTurn(started);
      setPhase('likert');
    });
  const applyTurn = (next: ChatTurn) => {
    setTurn(next);
    setPhase(next.phase === 'confirmed' ? 'confirmed' : next.phase);
  };
  const submitLikert = () =>
    act(async () => {
      if (!session) return;
      const next = await client.likert(
        session.session_id,
        session.likert_items.map((item) => ({ id: item.id, value: answers[item.id] })),
      );
      setHistory([{ role: 'assistant', text: next.assistant_message }]);
      applyTurn(next);
    });
  const send = (value: string) =>
    act(async () => {
      if (!session || !value.trim()) return;
      const next = await client.message(session.session_id, value.trim());
      setHistory((h) => [
        ...h,
        { role: 'user', text: value.trim() },
        { role: 'assistant', text: next.assistant_message },
      ]);
      setMessage('');
      applyTurn(next);
    });
  const constraints = () =>
    act(async () => {
      if (!session) return;
      const wanted = [purpose.trim() && `여행 목적: ${purpose.trim()}`, mustHave.trim()]
        .filter(Boolean)
        .join('\n');
      const next = await client.constraints(session.session_id, wanted, mustAvoid);
      applyTurn(next);
    });
  const finalize = () =>
    act(async () => {
      if (!session) return;
      await client.finalize(session.session_id);
      setPhase('confirmed');
    });
  const find = () =>
    act(async () => {
      if (!session || !profileId) return;
      const result = await client.find(profileId, session.session_id);
      onResult({ serverUrl: url.trim(), profileId, sessionId: session.session_id, result });
      onClose();
    });
  const retryPrevious = () =>
    act(async () => {
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
    setPhase('profile');
    setError('');
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          automaticallyAdjustKeyboardInsets
          onContentSizeChange={() => {
            if (phase === 'asking' && history.length > 1)
              scroll.current?.scrollToEnd({ animated: true });
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.modal,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={ui.eyebrow}>SEOUL · 3 DAYS</Text>
          <Text style={ui.title}>나의 서울 여행 만들기</Text>
          {phase === 'profile' && (
            <>
              <Text style={ui.body}>서울 · 2박 3일. 아래 조건은 추천 서버로 전송됩니다.</Text>
              <Text style={ui.label}>인원</Text>
              <View style={ui.wrap}>
                {options.party_size.map(([v, l]) => (
                  <Chip
                    key={v}
                    label={l}
                    selected={profile.party_size === v}
                    onPress={() => setProfile({ ...profile, party_size: v })}
                  />
                ))}
              </View>
              <Text style={ui.label}>동행</Text>
              <View style={ui.wrap}>
                {options.companion_type.map(([v, l]) => (
                  <Chip
                    key={v}
                    label={l}
                    selected={profile.companion_type === v}
                    onPress={() => setProfile({ ...profile, companion_type: v })}
                  />
                ))}
              </View>
              <Text style={ui.label}>이동 수단</Text>
              <View style={ui.wrap}>
                {options.transport.map(([v, l]) => (
                  <Chip
                    key={v}
                    label={l}
                    selected={profile.transport === v}
                    onPress={() => setProfile({ ...profile, transport: v })}
                  />
                ))}
              </View>
              <Text style={ui.label}>전체 여행 예산 수준</Text>
              <View style={ui.wrap}>
                {options.budget_level.map(([v, l]) => (
                  <Chip
                    key={v}
                    label={l}
                    selected={profile.budget_level === v}
                    onPress={() => setProfile({ ...profile, budget_level: v })}
                  />
                ))}
              </View>
              <TextInput
                accessibilityLabel="전체 여행 예산 메모"
                placeholder="전체 여행 예산 메모 (선택)"
                value={profile.budget_note ?? ''}
                onChangeText={(v) => setProfile({ ...profile, budget_note: v })}
                style={ui.input}
              />
              <Text style={ui.label}>주로 활동할 시간</Text>
              <View style={ui.wrap}>
                {options.time_window.map(([v, l]) => (
                  <Chip
                    key={v}
                    label={l}
                    selected={profile.time_window === v}
                    onPress={() => setProfile({ ...profile, time_window: v })}
                  />
                ))}
              </View>
              <TextInput
                accessibilityLabel="여행 목적"
                placeholder="여행 목적 및 기타 조건 (선택)"
                maxLength={90}
                value={purpose}
                onChangeText={setPurpose}
                style={ui.input}
              />
              <Text style={ui.small}>
                목적은 필수 희망 사항과 함께 서버로 전달됩니다. 예산은 가격 충족을 보장하지
                않습니다.
              </Text>
              <Button title="취향 설문 시작" onPress={begin} disabled={loading} />
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
              <View style={ts.scale}>
                <Text style={ts.progress}>
                  응답 {Object.keys(answers).length} / {session.likert_items.length}
                </Text>
                <Text style={ui.small}>
                  {[...session.likert_items[0].scale]
                    .sort((a, b) => a.value - b.value)
                    .map((o) => `${o.value} ${o.label_ko}`)
                    .join(' · ')}
                </Text>
              </View>
              {session.likert_items.map((item, index) => (
                <View key={item.id} style={ts.question}>
                  <Text style={ts.questionTitle}>
                    {index + 1}. {item.statement_ko}
                  </Text>
                  <View style={ts.numbers}>
                    {[...item.scale]
                      .sort((a, b) => a.value - b.value)
                      .map(({ value: n, label_ko: label }) => (
                        <Pressable
                          key={n}
                          accessibilityRole="radio"
                          accessibilityLabel={`${index + 1}번 문항 ${n}점 ${label}`}
                          accessibilityState={{ checked: answers[item.id] === n }}
                          onPress={() => setAnswers({ ...answers, [item.id]: n })}
                          style={[ts.number, answers[item.id] === n && ts.numberSelected]}
                        >
                          <Text style={[ts.numberText, answers[item.id] === n && ts.userText]}>
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </View>
              ))}
              <Button
                title="설문 제출"
                disabled={loading || session.likert_items.some((item) => !answers[item.id])}
                onPress={submitLikert}
              />
            </>
          )}
          {phase === 'asking' && (
            <>
              <Text style={ui.subtitle}>취향 대화</Text>
              {history.map((m, i) => (
                <View key={i} style={[ts.bubble, m.role === 'user' && ts.userBubble]}>
                  <Text style={[ui.small, m.role === 'user' && ts.userText]}>
                    {m.role === 'user' ? '나' : 'Travel DNA'}
                  </Text>
                  <Text style={[ui.body, m.role === 'user' && ts.userText]}>{m.text}</Text>
                </View>
              ))}
              <View style={ui.wrap}>
                {turn?.chips.map((chip) => (
                  <Chip key={chip} label={chip} selected={false} onPress={() => send(chip)} />
                ))}
              </View>
              <View style={ts.composer}>
                <TextInput
                  accessibilityLabel="대화 답변"
                  placeholder="여행 취향을 입력해 주세요"
                  value={message}
                  onChangeText={setMessage}
                  style={[ui.input, ts.messageInput]}
                  multiline
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="답변 보내기"
                  accessibilityState={{ disabled: loading || !message.trim() }}
                  disabled={loading || !message.trim()}
                  onPress={() => send(message)}
                  style={[ts.send, (loading || !message.trim()) && { opacity: 0.45 }]}
                >
                  <Text style={ts.sendText}>전송</Text>
                </Pressable>
              </View>
            </>
          )}
          {phase === 'constraints' && (
            <>
              <Text style={ui.body}>{turn?.assistant_message}</Text>
              <TextInput
                accessibilityLabel="꼭 원하는 것"
                placeholder="꼭 원하는 것 (선택)"
                value={mustHave}
                onChangeText={setMustHave}
                maxLength={400}
                style={ui.input}
              />
              <TextInput
                accessibilityLabel="피하고 싶은 것"
                placeholder="피하고 싶은 것 (선택)"
                value={mustAvoid}
                onChangeText={setMustAvoid}
                maxLength={500}
                style={ui.input}
              />
              <Button title="조건 제출" onPress={constraints} disabled={loading} />
            </>
          )}
          {phase === 'draft' && (
            <>
              <Text style={ui.body}>{turn?.assistant_message}</Text>
              <Text style={ui.body}>
                여행 목적: {purpose || '없음'}
                {'\n'}꼭 원하는 것: {mustHave || '없음'}
                {'\n'}피하고 싶은 것: {mustAvoid || '없음'}
              </Text>
              <Button title="취향 확정" onPress={finalize} disabled={loading} />
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
              <Text style={ui.body}>서버 취향이 확정되었어요. 추천 후보를 요청합니다.</Text>
              <Button title="서울 장소 추천 받기" onPress={find} disabled={loading} />
            </>
          )}
          {loading && (
            <View style={ui.row}>
              <ActivityIndicator />
              <Text style={ui.small}>서버 응답을 기다리고 있어요…</Text>
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={ui.body}>
              {error} 같은 단계를 다시 시도하거나 처음부터 시작해 주세요.
            </Text>
          )}
          {phase !== 'profile' && (
            <Button title="처음부터 다시 시작" secondary onPress={reset} disabled={loading} />
          )}
          <Button title="닫기" secondary onPress={onClose} disabled={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
