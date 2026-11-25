import { useEffect, useRef } from 'react';
import { FlatList, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Place, Recommendation } from '../../types';
import { theme } from '../../theme';
import { PlaceCard } from '../place/PlaceCard';
import { Empty, Icon } from '../common/UI';
import { ui } from '../common/ui.styles';
import { s } from '../../features/recommendations/map-home.styles';
import { sheetHeights, snapSheet, type SheetState } from './sheetSnap';

interface Props {
  places: Place[];
  day: number | null;
  onDayChange: (day: number | null) => void;
  recommendations: Recommendation[];
  selectedId: string | null;
  savedIds: string[];
  orderLabels?: Record<string, string>;
  title: string;
  subtitle: string;
  availableHeight: number;
  revealKey: number;
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  onSelect: (id: string) => void;
  onSave: (id: string) => void;
  onOpen: (id: string) => void;
}

export function RecommendationSheet({
  places,
  day,
  onDayChange,
  recommendations,
  selectedId,
  savedIds,
  title,
  orderLabels = {},
  subtitle,
  availableHeight,
  revealKey,
  state,
  onStateChange,
  onSelect,
  onSave,
  onOpen,
}: Props) {
  const expanded = state === 'expanded';
  const collapsed = state === 'collapsed';
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(380, width - 53);
  const interval = cardWidth + 10;
  const list = useRef<FlatList<Place>>(null);
  const webScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();
  const heights = sheetHeights(availableHeight);
  const restingHeight = heights[state];
  const height = useSharedValue(restingHeight);
  const destination = useSharedValue(restingHeight);
  const dragOrigin = useSharedValue(restingHeight);
  const entrance = useSharedValue(1);
  const suppressTap = useRef(false);
  const selectedIndex = places.findIndex((place) => place.id === selectedId);

  useEffect(() => {
    if (destination.value === restingHeight) return;
    destination.value = restingHeight;
    height.value = reduce ? restingHeight : withSpring(restingHeight, theme.motion.spring);
  }, [destination, height, reduce, restingHeight]);
  useEffect(() => {
    if (!revealKey || reduce) return;
    entrance.value = 0;
    entrance.value = withDelay(195, withTiming(1, { duration: theme.motion.reveal }));
    return () => cancelAnimation(entrance);
  }, [entrance, reduce, revealKey]);
  useEffect(() => () => cancelAnimation(height), [height]);

  const onDragStart = () => {
    suppressTap.current = true;
  };
  const onDragEnd = (next: SheetState) => {
    onStateChange(next);
    // The mouse-up can also produce a click on web. Clear after the event dispatch.
    requestAnimationFrame(() => {
      suppressTap.current = false;
    });
  };
  const pan = usePanGesture({
    activeOffsetY: [-5, 5],
    failOffsetX: [-18, 18],
    maxPointers: 1,
    shouldCancelWhenOutside: false,
    onActivate: () => {
      'worklet';
      cancelAnimation(height);
      dragOrigin.value = height.value;
      scheduleOnRN(onDragStart);
    },
    onUpdate: ({ translationY }) => {
      'worklet';
      height.value = Math.max(
        heights.collapsed,
        Math.min(heights.expanded, dragOrigin.value - translationY),
      );
    },
    onDeactivate: ({ velocityY, canceled }) => {
      'worklet';
      const next = canceled ? state : snapSheet(heights, height.value, velocityY);
      destination.value = heights[next];
      height.value = reduce
        ? heights[next]
        : withSpring(heights[next], {
            ...theme.motion.spring,
            velocity: canceled ? 0 : -velocityY,
          });
      scheduleOnRN(onDragEnd, next);
    },
  });
  const position = useAnimatedStyle(() => ({
    height: height.value,
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 28 }],
  }));

  useEffect(() => {
    if (webScrollTimer.current) clearTimeout(webScrollTimer.current);
    if (selectedIndex < 0 || expanded || collapsed) return;
    list.current?.scrollToOffset({ offset: selectedIndex * interval, animated: !reduce });
  }, [selectedIndex, interval, expanded, collapsed, reduce]);

  useEffect(
    () => () => {
      if (webScrollTimer.current) clearTimeout(webScrollTimer.current);
    },
    [places, expanded, collapsed],
  );

  const selectFromOffset = (offset: number) => {
    const index = Math.max(0, Math.min(places.length - 1, Math.round(offset / interval)));
    const place = places[index];
    if (place && place.id !== selectedId) onSelect(place.id);
    return index;
  };

  const card = (place: Place, compact = false) => (
    <PlaceCard
      compact={compact}
      orderLabel={orderLabels[place.id]}
      place={place}
      recommendation={recommendations.find((item) => item.placeId === place.id)}
      saved={savedIds.includes(place.id)}
      onSave={() => onSave(place.id)}
      onOpen={() => {
        onSelect(place.id);
        onOpen(place.id);
      }}
    />
  );

  return (
    <Animated.View style={[s.sheet, position]}>
      <GestureDetector gesture={pan} touchAction="none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? '추천 장소 보기' : '추천 목록 접기'}
          accessibilityHint="위아래로 끌어 추천 패널 높이를 바꿀 수 있어요"
          onPress={() => {
            if (!suppressTap.current) onStateChange(state === 'compact' ? 'collapsed' : 'compact');
          }}
          style={s.handle}
        >
          <View style={s.handleBar} />
          {collapsed && <Text style={s.handleLabel}>추천 장소 보기</Text>}
        </Pressable>
      </GestureDetector>
      <View
        style={s.sheetBody}
        pointerEvents={collapsed ? 'none' : 'auto'}
        aria-hidden={collapsed}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      >
        <View accessibilityRole="tablist" style={s.days}>
          {(['전체', 'Day 1', 'Day 2', 'Day 3'] as const).map((label, index) => {
            const value = index ? index - 1 : null;
            const selected = day === value;
            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                aria-selected={selected}
                accessibilityState={{ selected }}
                onPress={() => onDayChange(value)}
                style={[s.day, selected && s.dayActive]}
              >
                <Text style={[s.dayText, selected && s.dayTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.sheetHeader}>
          <View style={s.sheetCopy}>
            <Text numberOfLines={1} style={s.sheetTitle}>
              {title}
            </Text>
            <Text numberOfLines={2} style={s.sheetSubtitle}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? '목록 접기' : '전체 추천 보기'}
            onPress={() => onStateChange(expanded ? 'compact' : 'expanded')}
            style={s.sheetAction}
          >
            <Icon name={expanded ? 'chevron-down' : 'list-outline'} size={22} />
          </Pressable>
        </View>
        {places.length === 0 ? (
          <Empty title="표시할 장소가 없어요" message="다른 날짜 또는 필터를 선택해 보세요." />
        ) : expanded ? (
          <FlatList
            key="expanded"
            data={places}
            keyExtractor={(place) => place.id}
            contentContainerStyle={s.list}
            renderItem={({ item }) => card(item)}
          />
        ) : (
          <>
            <FlatList
              key="compact"
              ref={list}
              data={places}
              onLayout={() => {
                if (selectedIndex > 0)
                  list.current?.scrollToOffset({
                    offset: selectedIndex * interval,
                    animated: false,
                  });
              }}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={interval}
              decelerationRate="fast"
              contentContainerStyle={[
                s.carousel,
                { paddingRight: Math.max(18, width - cardWidth - 18) },
              ]}
              getItemLayout={(_, index) => ({ length: interval, offset: interval * index, index })}
              keyExtractor={(place) => place.id}
              scrollEventThrottle={Platform.OS === 'web' ? 32 : undefined}
              onScroll={
                Platform.OS === 'web'
                  ? (event) => {
                      const offset = event.nativeEvent.contentOffset.x;
                      if (webScrollTimer.current) clearTimeout(webScrollTimer.current);
                      webScrollTimer.current = setTimeout(() => {
                        const index = selectFromOffset(offset);
                        if (Math.abs(offset - index * interval) > 2)
                          list.current?.scrollToOffset({
                            offset: index * interval,
                            animated: !reduce,
                          });
                      }, 115);
                    }
                  : undefined
              }
              onMomentumScrollEnd={(event) => selectFromOffset(event.nativeEvent.contentOffset.x)}
              renderItem={({ item }) => (
                <View style={{ width: cardWidth }}>{card(item, true)}</View>
              )}
            />
            <View style={s.footer}>
              <Text style={ui.small}>
                장소 {Math.max(1, selectedIndex + 1)} / {places.length}
              </Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}
