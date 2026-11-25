import { StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import { Reveal } from '../common/Motion';
import { ui } from '../common/ui.styles';

export function confirmedKeywords(value: unknown): string[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('micro_keywords' in value) ||
    !Array.isArray(value.micro_keywords)
  )
    return [];
  return value.micro_keywords.filter(
    (word): word is string => typeof word === 'string' && Boolean(word.trim()),
  );
}

export function PreferenceSummary({
  keywords,
  mustHave,
  mustAvoid,
}: {
  keywords?: string[];
  mustHave: string;
  mustAvoid: string;
}) {
  return (
    <View style={s.summary}>
      {keywords !== undefined && (
        <View style={s.section}>
          <Text style={s.label}>주요 키워드</Text>
          <View style={ui.wrap}>
            {keywords.map((word, index) => (
              <Reveal key={word + index} delay={Math.min(index, 5) * 45}>
                <Text style={s.keyword}>{word}</Text>
              </Reveal>
            ))}
            {keywords.length === 0 && <Text style={ui.body}>확정된 키워드가 없어요.</Text>}
          </View>
        </View>
      )}
      <View style={s.condition}>
        <Text style={s.label}>필수 조건</Text>
        <Text style={s.detail}>{mustHave || '없음'}</Text>
      </View>
      <View style={[s.condition, s.avoid]}>
        <Text style={[s.label, s.avoidLabel]}>제외 조건</Text>
        <Text style={s.detail}>{mustAvoid || '없음'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summary: { gap: t.spacing.md },
  section: { gap: t.spacing.sm, paddingBottom: t.spacing.sm },
  keyword: {
    color: t.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    backgroundColor: t.colors.pale,
  },
  condition: { borderStartWidth: 2, borderStartColor: t.colors.accent, paddingStart: 12, gap: 3 },
  avoid: { borderStartColor: t.colors.warm },
  avoidLabel: { color: t.colors.warm },
  label: { color: t.colors.accent, fontSize: 12, fontWeight: '700' },
  detail: { color: t.colors.text, fontSize: 15, lineHeight: 23 },
});
