import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Chip, Icon, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { ATTRIBUTES, CONFLICTS, type Attribute, type Conflict } from '../../types';
import { attributeLabels, conflictLabels } from '../../data/mock/places';
export default function ExperienceEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, upsertExperience } = useTravel();
  const router = useRouter();
  const existing = data.experiences.find((e) => e.id === id);
  const [placeName, setPlaceName] = useState(existing?.placeName ?? '');
  const [rating, setRating] = useState(existing?.rating ?? 4);
  const [likes, setLikes] = useState<Attribute[]>(existing?.likes ?? []);
  const [dislikes, setDislikes] = useState<Conflict[]>(existing?.dislikes ?? []);
  const [goodReason, setGoodReason] = useState(existing?.goodReason ?? '');
  const [badReason, setBadReason] = useState(existing?.badReason ?? '');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/experiences'));
  if (id !== 'new' && !existing)
    return (
      <Screen>
        <Text style={ui.title}>기록을 찾을 수 없어요</Text>
        <Button title="돌아가기" onPress={goBack} />
      </Screen>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Pressable accessibilityRole="button" style={ui.back} onPress={goBack}>
          <Icon name="arrow-back" />
          <Text style={ui.body}>돌아가기</Text>
        </Pressable>
        <Text style={ui.eyebrow}>A MEMORY WORTH KEEPING</Text>
        <Text style={ui.title}>
          {existing ? '기억을 조금 더 선명하게.' : '어떤 여행이 기억나나요?'}
        </Text>
        <View>
          <Text style={ui.label}>방문 지역 또는 장소 *</Text>
          <TextInput
            accessibilityLabel="방문 지역 또는 장소"
            style={ui.input}
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="예: 교토 · 히가시야마"
            maxLength={80}
          />
        </View>
        <View>
          <Text style={ui.label}>전반적인 만족도 · {rating} / 5</Text>
          <View style={ui.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'만족도 ' + n + '점'}
                accessibilityState={{ selected: rating === n }}
                key={n}
                onPress={() => setRating(n)}
                style={{ padding: 6, minHeight: 48 }}
              >
                <Icon name={n <= rating ? 'star' : 'star-outline'} size={32} color="#F48B79" />
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text style={ui.label}>좋았던 경험 · 여러 개 선택</Text>
          <View style={ui.wrap}>
            {ATTRIBUTES.map((k) => (
              <Chip
                key={k}
                label={attributeLabels[k]}
                selected={likes.includes(k)}
                onPress={() =>
                  setLikes((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))
                }
              />
            ))}
          </View>
        </View>
        <View>
          <Text style={ui.label}>아쉬웠던 경험 · 여러 개 선택</Text>
          <View style={ui.wrap}>
            {CONFLICTS.map((k) => (
              <Chip
                key={k}
                label={conflictLabels[k]}
                selected={dislikes.includes(k)}
                onPress={() =>
                  setDislikes((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))
                }
              />
            ))}
          </View>
        </View>
        <View>
          <Text style={ui.label}>좋았던 이유 · 선택</Text>
          <TextInput
            accessibilityLabel="좋았던 이유"
            style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]}
            multiline
            value={goodReason}
            onChangeText={setGoodReason}
            placeholder="어떤 순간이 좋았나요?"
            maxLength={1000}
          />
        </View>
        <View>
          <Text style={ui.label}>아쉬웠던 이유 · 선택</Text>
          <TextInput
            accessibilityLabel="아쉬웠던 이유"
            style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]}
            multiline
            value={badReason}
            onChangeText={setBadReason}
            placeholder="다음 여행에서는 피하고 싶은 것이 있나요?"
            maxLength={1000}
          />
        </View>
        <Text style={ui.small}>
          태그와 만족도가 추천에 반영됩니다. 자유 텍스트는 기억을 보관하는 용도이며 자동 분석하지
          않습니다.
        </Text>
        <Button
          title="이 기억 저장하기"
          disabled={!placeName.trim()}
          icon="checkmark"
          onPress={() => {
            upsertExperience({
              id:
                existing?.id ?? 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
              placeName: placeName.trim(),
              rating,
              likes,
              dislikes,
              goodReason: goodReason.trim(),
              badReason: badReason.trim(),
              updatedAt: new Date().toISOString(),
            });
            goBack();
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
