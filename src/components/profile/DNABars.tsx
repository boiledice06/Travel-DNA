import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type { TravelDNA } from '../../types';
import { ATTRIBUTES } from '../../types';
import { attributeLabels } from '../../data/mock/places';
import { theme } from '../../theme';
export function DNABars({ dna }: { dna: TravelDNA }) {
  return (
    <View style={{ gap: 14 }}>
      {[...ATTRIBUTES]
        .sort((a, b) => dna.preferences[b] - dna.preferences[a])
        .map((k, i) => (
          <View
            key={k}
            accessibilityLabel={
              attributeLabels[k] + ', 상대 선호 ' + Math.round(dna.preferences[k] * 100)
            }
          >
            <View style={s.row}>
              <Text style={s.label}>{attributeLabels[k]}</Text>
              <Text style={s.value}>{Math.round(dna.preferences[k] * 100)}</Text>
            </View>
            <View style={s.track}>
              <View
                style={[
                  s.fill,
                  {
                    width: (Math.round(dna.preferences[k] * 100) + '%') as DimensionValue,
                    backgroundColor: i < 3 ? theme.colors.accent : '#94B6CB',
                  },
                ]}
              />
            </View>
          </View>
        ))}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  label: { fontSize: 13, color: theme.colors.text },
  value: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  track: { height: 7, borderRadius: 5, backgroundColor: '#EDF1F5', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 5 },
});
