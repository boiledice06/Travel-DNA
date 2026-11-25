import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place, Recommendation } from '../../types';
import { IconButton, Photo } from '../common/UI';
import { ui } from '../common/ui.styles';
import { theme as t } from '../../theme';

interface Props {
  place: Place;
  recommendation?: Recommendation;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  compact?: boolean;
  orderLabel?: string;
}

export const PlaceCard = memo(function PlaceCard({
  place,
  recommendation,
  saved,
  onSave,
  onOpen,
  compact,
  orderLabel,
}: Props) {
  const source = place.source === 'api' ? place.sourceName : '데모';
  return (
    <View style={[s.card, compact && s.compact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${place.name} 상세 보기`}
        onPress={onOpen}
        style={({ pressed }) => [compact && s.compactMain, { opacity: pressed ? 0.78 : 1 }]}
      >
        <Photo
          uri={place.image}
          category={place.category}
          style={compact ? s.thumbnail : s.cover}
        />
        <View style={compact ? s.compactCopy : s.copy}>
          <Text numberOfLines={1} style={s.category}>
            {orderLabel ? `${orderLabel}  ·  ` : ''}
            {place.category}
          </Text>
          <Text style={compact ? s.compactTitle : s.title} numberOfLines={2}>
            {place.name}
          </Text>
          {!!place.district && (
            <Text style={ui.small} numberOfLines={1}>
              {place.district}
            </Text>
          )}
          {recommendation?.score != null ? (
            <Text style={s.source}>예상 일치도 {recommendation.score} / 100</Text>
          ) : (
            <Text style={s.source} numberOfLines={1}>
              {place.image && place.source === 'api' ? '사진 · 한국관광공사' : source}
            </Text>
          )}
          {!compact && place.source !== 'api' && !!recommendation?.reason && (
            <Text style={ui.small} numberOfLines={2}>
              {recommendation.reason}
            </Text>
          )}
        </View>
      </Pressable>
      <View style={compact ? s.saveCompact : s.saveCover}>
        <IconButton
          icon={saved ? 'bookmark' : 'bookmark-outline'}
          label={`${place.name} ${saved ? '저장 취소' : '저장'}`}
          active={saved}
          onPress={onSave}
        />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  compact: { backgroundColor: t.colors.background },
  compactMain: { minHeight: 92, flexDirection: 'row', alignItems: 'stretch' },
  copy: { padding: 16, gap: 5 },
  compactCopy: {
    flex: 1,
    justifyContent: 'center',
    paddingStart: 10,
    paddingEnd: 53,
    paddingVertical: 6,
    gap: 2,
  },
  cover: { width: '100%', aspectRatio: 2.25 },
  thumbnail: { width: '31%', minHeight: 92 },
  title: {
    color: t.colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  compactTitle: {
    color: t.colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  category: { fontSize: 11, color: t.colors.accent, fontWeight: '700' },
  source: { fontSize: 11, color: t.colors.muted, fontWeight: '500', flexShrink: 1 },
  saveCover: { position: 'absolute', top: 10, right: 10 },
  saveCompact: { position: 'absolute', top: 7, right: 6 },
});
