import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Place, Recommendation } from '../../types';
import { PlaceCard } from '../place/PlaceCard';
import { Empty, Icon } from '../common/UI';
import { ui } from '../common/ui.styles';
import { s } from '../../features/recommendations/map-home.styles';
interface Props {
  places: Place[];
  recommendations: Recommendation[];
  selectedId: string | null;
  savedIds: string[];
  title: string;
  subtitle: string;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  onSelect: (id: string) => void;
  onSave: (id: string) => void;
  onOpen: (id: string) => void;
}
export function RecommendationSheet({
  places,
  recommendations,
  selectedId,
  savedIds,
  title,
  subtitle,
  expanded,
  onExpand,
  onSelect,
  onSave,
  onOpen,
}: Props) {
  const { width, height } = useWindowDimensions();
  const cardWidth = width - 64;
  const list = useRef<FlatList<Place>>(null);
  const sheetHeight = useRef(new Animated.Value(244)).current;
  const syncOffset = () => {
    const index = places.findIndex((p) => p.id === selectedId);
    if (index >= 0 && !expanded)
      list.current?.scrollToOffset({ offset: index * (cardWidth + 12), animated: true });
  };
  useEffect(syncOffset, [selectedId, expanded, cardWidth, places]);
  useEffect(() => {
    Animated.timing(sheetHeight, {
      toValue: expanded ? Math.min(height * 0.62, 560) : 244,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [expanded, height, sheetHeight]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (g.dy < -20) onExpand(true);
          if (g.dy > 20) onExpand(false);
        },
      }),
    [onExpand],
  );
  const card = (p: Place, compact = false) => (
    <PlaceCard
      compact={compact}
      place={p}
      recommendation={recommendations.find((r) => r.placeId === p.id)!}
      saved={savedIds.includes(p.id)}
      onSave={() => onSave(p.id)}
      onOpen={() => {
        onSelect(p.id);
        onOpen(p.id);
      }}
    />
  );
  return (
    <Animated.View style={[s.sheet, { height: sheetHeight }]}>
      <View {...pan.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? '추천 목록 축소' : '추천 목록 확장'}
          onPress={() => onExpand(!expanded)}
          style={s.handle}
        >
          <View style={s.handleBar} />
        </Pressable>
      </View>
      <View style={s.sheetHeader}>
        <View>
          <Text style={s.sheetTitle}>{title}</Text>
          <Text style={ui.small}>{subtitle}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? '목록 접기' : '전체 추천 보기'}
          onPress={() => onExpand(!expanded)}
          style={{ padding: 10 }}
        >
          <Icon name={expanded ? 'chevron-down' : 'list-outline'} size={20} />
        </Pressable>
      </View>
      {places.length === 0 ? (
        <Empty
          title="새로운 발견을 기다려요"
          message="다른 취향 필터를 선택하거나 장소를 저장해 주세요."
        />
      ) : expanded ? (
        <FlatList
          key="expanded"
          data={places}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => card(item)}
        />
      ) : (
        <>
          <FlatList
            key="compact"
            ref={list}
            data={places}
            onLayout={syncOffset}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            getItemLayout={(_, i) => ({
              length: cardWidth + 12,
              offset: (cardWidth + 12) * i,
              index: i,
            })}
            keyExtractor={(p) => p.id}
            onMomentumScrollEnd={(event) => {
              const index = Math.max(
                0,
                Math.min(
                  places.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12)),
                ),
              );
              if (places[index] && places[index].id !== selectedId) onSelect(places[index].id);
            }}
            renderItem={({ item }) => <View style={{ width: cardWidth }}>{card(item, true)}</View>}
          />
          <View style={s.footer}>
            <Text style={ui.small}>← 옆으로 넘겨 다음 장소 발견</Text>
            <Text style={ui.badge}>
              {Math.max(1, places.findIndex((p) => p.id === selectedId) + 1)} / {places.length}
            </Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}
