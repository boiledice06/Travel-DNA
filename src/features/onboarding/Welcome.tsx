import { useState } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Icon } from '../../components/common/UI';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { s } from './onboarding.styles';
export default function Welcome() {
  const router = useRouter();
  const { start } = useTravel();
  const [imageFailed, setImageFailed] = useState(false);
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
          {!imageFailed && (
            <Image
              source={require('../../../assets/seoul-night.jpg')}
              style={s.heroPhoto}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
              accessibilityLabel="N서울타워에서 바라본 서울 야경"
            />
          )}
          <View style={s.logo}>
            <Icon name="finger-print-outline" size={26} />
            <Text style={{ fontWeight: '700', color: '#174A7E', letterSpacing: 1 }}>
              TRAVEL DNA
            </Text>
          </View>
          <View style={s.heroShade}>
            <Text style={ui.eyebrow}>A JOURNEY THAT FEELS LIKE YOU</Text>
            <Text style={s.heroTitle}>나의 취향으로{'\n'}완성하는 서울 3일</Text>
          </View>
        </View>
        <View style={s.content}>
          <Text style={s.credit}>
            서울 야경 사진:{' '}
            <Text
              accessibilityRole="link"
              onPress={() =>
                Linking.openURL(
                  'https://commons.wikimedia.org/wiki/File:City_of_Seoul_View_From_N_Seoul_Tower.JPG',
                )
              }
            >
              Penmerahpenbiru
            </Text>{' '}
            ·{' '}
            <Text
              accessibilityRole="link"
              onPress={() => Linking.openURL('https://creativecommons.org/licenses/by/3.0/')}
            >
              CC BY 3.0
            </Text>{' '}
            (크기 조정·화면 자름)
          </Text>
          <Text style={ui.title}>서울에서 만나는{'\n'}나만의 여행</Text>
          <Text style={ui.body}>
            여행 취향을 발견하고, 나에게 맞는 장소를 연결해 보세요.{'\n'}여행 조건을 정하고 · 취향을
            발견하고 · 서울을 탐색해요.
          </Text>
          <View style={ui.row}>
            <Icon name="map-outline" color="#3DB8BC" />
            <Text style={ui.small}>기억을 남기고 · 취향을 발견하고 · 지도로 떠나요</Text>
          </View>
          <Button
            title="서울 여행 시작하기"
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
