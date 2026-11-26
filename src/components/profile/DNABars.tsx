import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { TravelDNA } from '../../types';
import { ATTRIBUTES } from '../../types';
import { attributeLabels } from '../../data/mock/places';
import { theme as t } from '../../theme';

function SpectrumBar({
  label,
  value,
  emphasized,
  progress,
}: {
  label: string;
  value: number;
  emphasized: boolean;
  progress: SharedValue<number>;
}) {
  const growth = useAnimatedStyle(() => ({ width: `${value * progress.value}%` }));
  return (
    <View accessible accessibilityLabel={`${label}, 상대 선호 ${value}`}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, emphasized && s.highlight, growth]} />
      </View>
    </View>
  );
}
export function DNABars({ dna }: { dna: TravelDNA }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    progress.value = reduce ? 1 : withTiming(1, { duration: t.motion.camera });
  }, [progress, reduce]);
  return (
    <View style={s.chart}>
      {[...ATTRIBUTES]
        .sort((a, b) => dna.preferences[b] - dna.preferences[a])
        .map((key, index) => (
          <SpectrumBar
            key={key}
            label={attributeLabels[key]}
            value={Math.round(dna.preferences[key] * 100)}
            emphasized={index < 3}
            progress={progress}
          />
        ))}
    </View>
  );
}
const s = StyleSheet.create({
  chart: { gap: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 10 },
  label: { fontSize: 14, color: t.colors.text, fontWeight: '600' },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 5, borderRadius: 3, backgroundColor: t.colors.line, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: '#73A69D' },
  highlight: { backgroundColor: t.colors.accent },
});
