import { useEffect } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Button, Icon } from '../../components/common/UI';
import { Reveal } from '../../components/common/Motion';
import { useTravel } from '../../hooks/useTravel';
import { theme } from '../../theme';
import { s } from './onboarding.styles';

export default function Welcome() {
  const router = useRouter();
  const { start } = useTravel();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduce)
      scale.value = withTiming(1.09, { duration: 11000, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(scale);
  }, [reduce, scale]);
  const photoMotion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[s.photoLayer, photoMotion]}>
        <Image
          source={require('../../../assets/seoul-night.jpg')}
          style={s.heroPhoto}
          resizeMode="cover"
          accessibilityLabel="N서울타워에서 바라본 서울 야경"
        />
      </Animated.View>
      <View pointerEvents="none" style={s.shade} />
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.hero}>
          <Reveal style={s.logo}>
            <Icon name="finger-print-outline" size={24} color={theme.colors.mint} />
            <Text style={s.wordmark}>Travel DNA</Text>
          </Reveal>
          <View style={s.content}>
            <Reveal delay={75} style={s.story}>
              <Text style={s.destination}>서울 · 2박 3일</Text>
              <Text accessibilityRole="header" style={s.heroTitle}>
                서울을 여행하는{'\n'}나만의 방식
              </Text>
              <Text style={s.description}>
                좋아하는 장면에서 출발해{'\n'}내 취향을 담은 3일을 만들어 보세요.
              </Text>
            </Reveal>
            <Reveal delay={150} style={s.actions}>
              <Button
                title="서울 여행 시작하기"
                icon="arrow-forward"
                appearance="light"
                onPress={() => router.push('/onboarding/start')}
              />
              <Button
                title="데모로 먼저 둘러보기"
                appearance="ghost"
                onPress={() => {
                  start('민서', true);
                  router.push('/onboarding/dna');
                }}
              />
            </Reveal>
            <Text style={s.credit}>
              서울 야경 ·{' '}
              <Text
                accessibilityRole="link"
                style={s.creditLink}
                onPress={() =>
                  Linking.openURL(
                    'https://commons.wikimedia.org/wiki/File:City_of_Seoul_View_From_N_Seoul_Tower.JPG',
                  )
                }
              >
                Penmerahpenbiru
              </Text>
              {' · '}
              <Text
                accessibilityRole="link"
                style={s.creditLink}
                onPress={() => Linking.openURL('https://creativecommons.org/licenses/by/3.0/')}
              >
                CC BY 3.0
              </Text>
              {' · 화면 자름'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
