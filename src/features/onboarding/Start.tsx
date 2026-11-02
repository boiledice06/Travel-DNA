import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Icon, Screen } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
export default function Start() {
  const router = useRouter();
  const { data, start } = useTravel();
  const [nickname, setNickname] = useState(data.nickname);
  return (
    <Screen>
      <View style={{ paddingTop: 32, gap: 20 }}>
        <Icon name="finger-print-outline" size={54} color="#3DB8BC" />
        <Text style={ui.eyebrow}>01 / YOUR NAME</Text>
        <Text style={ui.title}>어떤 이름으로{'\n'}여행을 시작할까요?</Text>
        <Text style={ui.body}>닉네임 하나면 충분해요.{'\n'}나를 위한 추천을 함께 찾아볼게요.</Text>
        <View>
          <Text style={ui.label}>닉네임</Text>
          <TextInput
            accessibilityLabel="닉네임"
            style={ui.input}
            value={nickname}
            onChangeText={setNickname}
            maxLength={16}
            placeholder="예: 민서"
            autoFocus
            returnKeyType="next"
          />
        </View>
        <Button
          title="여행 기억 남기기"
          disabled={!nickname.trim()}
          icon="arrow-forward"
          onPress={() => {
            start(nickname, false);
            router.push('/onboarding/experiences');
          }}
        />
        <Button title="뒤로" secondary onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
