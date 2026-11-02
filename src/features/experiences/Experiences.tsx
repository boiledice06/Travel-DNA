import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, Icon, IconButton, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { attributeLabels, conflictLabels } from '../../data/mock/places';
export default function Experiences({ onboarding = false }: { onboarding?: boolean }) {
  const { data, deleteExperience } = useTravel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState<string | null>(null);
  return (
    <>
      <Screen>
        <Text style={ui.eyebrow}>{onboarding ? '02 / YOUR MEMORIES' : 'YOUR TRAVEL JOURNAL'}</Text>
        <Text style={ui.title}>여행의 기억,{'\n'}취향의 단서.</Text>
        <Text style={ui.body}>
          어디에 갔는지보다 무엇이 좋았는지가 중요해요.{'\n'}기억이 쌓일수록 나의 추천도 달라집니다.
        </Text>
        {data.demo && (
          <Text style={ui.badge}>데모 경험으로 시작했어요 · 자유롭게 수정할 수 있어요</Text>
        )}
        <Button title="여행 기록 추가" icon="add" onPress={() => router.push('/experience/new')} />
        {!data.experiences.length && (
          <Empty
            title="첫 번째 기억을 남겨요"
            message="장소 이름과 만족도만 입력해도 저장할 수 있어요. 좋아한 태그를 선택하면 추천에 반영됩니다."
          />
        )}
        {data.experiences.map((e) => (
          <View key={e.id} style={ui.card}>
            <View style={ui.between}>
              <View style={{ flex: 1 }}>
                <Text style={ui.subtitle}>{e.placeName}</Text>
                <Text style={{ color: '#F48B79', marginTop: 8, fontSize: 18 }}>
                  {'★'.repeat(e.rating)}
                  <Text style={{ color: '#DBE1E8' }}>{'★'.repeat(5 - e.rating)}</Text>
                </Text>
              </View>
              <IconButton
                icon="create-outline"
                label={e.placeName + ' 기록 수정'}
                onPress={() => router.push({ pathname: '/experience/[id]', params: { id: e.id } })}
              />
              <IconButton
                icon="trash-outline"
                label={e.placeName + ' 기록 삭제'}
                onPress={() => setDeleting(e.id)}
              />
            </View>
            <View style={ui.wrap}>
              {e.likes.map((k) => (
                <Text key={k} style={ui.badge}>
                  {attributeLabels[k]}
                </Text>
              ))}
            </View>
            {e.goodReason ? <Text style={ui.body}>{e.goodReason}</Text> : null}
            {e.dislikes.length > 0 && (
              <Text style={ui.small}>
                아쉬웠던 점 · {e.dislikes.map((k) => conflictLabels[k]).join(', ')}
              </Text>
            )}
            {e.badReason ? <Text style={ui.small}>{e.badReason}</Text> : null}
          </View>
        ))}
        {onboarding && (
          <>
            <Button
              title={data.experiences.length ? '나의 Travel DNA 확인' : '기록 없이 먼저 둘러보기'}
              icon="arrow-forward"
              onPress={() => router.push('/onboarding/dna')}
            />
            <Text style={ui.small}>기록이 없으면 개인화 점수는 중립값 50으로 표시돼요.</Text>
          </>
        )}
      </Screen>
      <Modal
        transparent
        visible={deleting !== null}
        animationType="fade"
        onRequestClose={() => setDeleting(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: '#16263A66',
            padding: 28,
            paddingBottom: insets.bottom + 28,
          }}
        >
          <View style={ui.card}>
            <Icon name="journal-outline" />
            <Text style={ui.subtitle}>이 기억을 삭제할까요?</Text>
            <Text style={ui.body}>
              삭제하면 이 경험이 취향 계산에서 빠지고 추천 순위가 다시 계산됩니다.
            </Text>
            <Button
              title="기록 삭제"
              onPress={() => {
                if (deleting) deleteExperience(deleting);
                setDeleting(null);
              }}
            />
            <Button title="취소" secondary onPress={() => setDeleting(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
