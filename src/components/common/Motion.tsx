import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { theme } from '../../theme';

export function Reveal({
  children,
  delay = 0,
  distance = 9,
  style,
}: PropsWithChildren<{ delay?: number; distance?: number; style?: StyleProp<ViewStyle> }>) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    progress.value = reduce
      ? 1
      : withDelay(
          delay,
          withTiming(1, { duration: theme.motion.reveal, easing: Easing.out(Easing.cubic) }),
        );
    return () => cancelAnimation(progress);
  }, [delay, progress, reduce]);
  const entrance = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));
  return <Animated.View style={[style, entrance]}>{children}</Animated.View>;
}

function Rung({
  index,
  phase,
  light,
  feature,
}: {
  index: number;
  phase: SharedValue<number>;
  light: boolean;
  feature: boolean;
}) {
  const color = light ? theme.colors.mint : theme.colors.accent;
  const other = light ? '#D5E8DC' : theme.colors.primary;
  const amplitude = feature ? 43 : 26;
  const wave = () => {
    'worklet';
    return phase.value + index * 0.43;
  };
  const front = useAnimatedStyle(() => ({
    opacity: 0.65 + Math.cos(wave()) * 0.32,
    transform: [
      { translateY: Math.sin(wave()) * amplitude },
      { scale: 0.8 + Math.cos(wave()) * 0.25 },
    ],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: 0.65 - Math.cos(wave()) * 0.32,
    transform: [
      { translateY: -Math.sin(wave()) * amplitude },
      { scale: 0.8 - Math.cos(wave()) * 0.25 },
    ],
  }));
  const link = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.027, Math.abs(Math.sin(wave()))) }],
  }));
  return (
    <View style={styles.rung}>
      <Animated.View
        style={[styles.link, { height: amplitude * 2, backgroundColor: color }, link]}
      />
      <Animated.View
        style={[styles.dot, feature && styles.featureDot, { backgroundColor: other }, back]}
      />
      <Animated.View
        style={[styles.dot, feature && styles.featureDot, { backgroundColor: color }, front]}
      />
    </View>
  );
}

export function Helix({
  active = false,
  light = false,
  feature = false,
}: {
  active?: boolean;
  light?: boolean;
  feature?: boolean;
}) {
  const phase = useSharedValue(0.3);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const spin = withTiming(0.3 + 2 * Math.PI, {
      duration: theme.motion.helixCycle,
      easing: Easing.linear,
    });
    phase.value = 0.3;
    phase.value = active ? withRepeat(spin, -1) : withTiming(1.22, { duration: 650 });
    return () => cancelAnimation(phase);
  }, [active, phase, reduce]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.helix, feature && styles.feature]}
    >
      {Array.from({ length: 18 }, (_, index) => (
        <Rung key={index} index={index} phase={phase} light={light} feature={feature} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  helix: { height: 78, flexDirection: 'row', width: '100%', alignItems: 'center' },
  feature: { height: 122 },
  featureDot: { width: 11, height: 11, borderRadius: 6 },
  rung: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  link: { position: 'absolute', width: 1, height: 52, opacity: 0.28 },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
});
