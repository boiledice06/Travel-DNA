import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place, Recommendation } from '../../types';
import { IconButton, Photo } from '../common/UI';
import { ui } from '../common/ui.styles';
import { theme } from '../../theme';
interface Props {
  place: Place;
  recommendation: Recommendation;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  compact?: boolean;
}
export const PlaceCard = memo(function PlaceCard({
  place,
  recommendation,
  saved,
  onSave,
  onOpen,
  compact,
}: Props) {
  return (
    <View style={[styles.card, compact && { borderWidth: 0, padding: 0 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${place.name} 상세 보기`}
        onPress={onOpen}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Photo uri={place.image} style={styles.photo} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.category}>
            {place.category} · {place.region === 'seoul' ? '서울' : '부산'}
          </Text>
          <Text
            style={[ui.subtitle, !compact && { fontSize: 18, lineHeight: 24 }]}
            numberOfLines={compact ? 1 : 2}
          >
            {place.name}
          </Text>
          <Text style={ui.small} numberOfLines={compact ? 2 : 3}>
            {recommendation.reason}
          </Text>
          <Text style={styles.score}>
            예상 일치도 {recommendation.score}
            <Text style={{ fontSize: 11, fontWeight: '400' }}> / 100</Text>
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        label={`${place.name} ${saved ? '저장 취소' : '저장'}`}
        active={saved}
        onPress={onSave}
      />
    </View>
  );
});
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  main: { flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center' },
  photo: { width: 82, height: 110, borderRadius: 16 },
  category: { fontSize: 10, color: theme.colors.muted, letterSpacing: 0.4 },
  score: { fontSize: 16, color: theme.colors.primary, fontWeight: '700' },
});
