import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Icon, Photo } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { s } from './onboarding.styles';
export default function Welcome() {
  const router = useRouter();
  const { start } = useTravel();
  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 28,
          maxWidth: 760,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <View style={s.hero}>
          <Photo
            uri="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=85"
            style={s.heroPhoto}
          />
          <View style={s.logo}>
            <Icon name="finger-print-outline" size={26} />
            <Text style={{ fontWeight: '700', color: '#174A7E', letterSpacing: 1 }}>
              TRAVEL DNA
            </Text>
          </View>
          <View style={s.heroShade}>
            <Text style={ui.eyebrow}>A JOURNEY THAT FEELS LIKE YOU</Text>
            <Text style={s.heroTitle}>다음 여행은,{'\n'}더 나답게.</Text>
          </View>
        </View>
        <View style={s.content}>
          <Text style={ui.title}>좋았던 기억이{'\n'}다음 목적지가 되도록.</Text>
          <Text style={ui.body}>
            사람들이 많이 찾는 곳보다, 내가 좋아할 곳.{'\n'}지난 여행의 경험에서 당신만의 취향을
            발견해요.
          </Text>
          <View style={ui.row}>
            <Icon name="map-outline" color="#3DB8BC" />
            <Text style={ui.small}>기억을 남기고 · 취향을 발견하고 · 지도로 떠나요</Text>
          </View>
          <Button
            title="나의 여행 취향 찾기"
            icon="arrow-forward"
            onPress={() => router.push('/onboarding/start')}
          />
          <Button
            title="데모로 먼저 둘러보기"
            secondary
            onPress={() => {
              start('민서', true);
              router.push('/onboarding/dna');
            }}
          />
          <Text style={[ui.small, { textAlign: 'center' }]}>
            회원가입 없이 시작해요. 기록은 이 기기에만 저장됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
