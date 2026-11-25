// Expo Web uses OpenStreetMap raster tiles without offline prefetching.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { MapProps } from './types';
import { regions } from '../../data/mock/places';
import { theme } from '../../theme';
import { Reveal } from '../common/Motion';

const project = (lat: number, lon: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const radians = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale,
  };
};
type Point = ReturnType<typeof project>;
const routeColors = [theme.colors.accent, '#355D86', '#996242'];
const homeZoom = 13;
const defaultSize = { width: 390, height: 790 };

const offsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [0.72, -0.72],
  [0.72, 0.72],
  [-0.72, 0.72],
  [-0.72, -0.72],
];

function separateMarkers(
  pins: { id: string; point: Point }[],
  bounds: { left: number; right: number; top: number; bottom: number },
) {
  const placed: Point[] = [];
  const enoughRoom = (point: Point) =>
    placed.every((other) => Math.hypot(point.x - other.x, point.y - other.y) >= 34);
  return new Map(
    pins.map(({ id, point }) => {
      let display = point;
      if (!enoughRoom(point)) {
        const options = [22, 36, 51].flatMap((distance) =>
          offsets.map(([x, y]) => ({
            x: point.x + x * distance,
            y: point.y + y * distance,
          })),
        );
        display =
          options.find(
            (candidate) =>
              candidate.x >= bounds.left &&
              candidate.x <= bounds.right &&
              candidate.y >= bounds.top &&
              candidate.y <= bounds.bottom &&
              enoughRoom(candidate),
          ) ?? point;
      }
      placed.push(display);
      return [id, display];
    }),
  );
}

export default function MapCanvas({
  region,
  places,
  recommendations,
  selectedId,
  onSelect,
  target,
  routes = [],
  orderLabels = {},
  topInset = 75,
  bottomInset = 280,
  revealKey = 0,
}: MapProps) {
  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState(homeZoom);
  const [center, setCenter] = useState(() =>
    project(regions[region].latitude, regions[region].longitude, homeZoom),
  );
  const [size, setSize] = useState(defaultSize);
  const [tileError, setTileError] = useState(false);
  const dragOrigin = useRef(center);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const frame = useRef<number | null>(null);
  const fitKey = places.map(({ latitude, longitude }) => `${latitude},${longitude}`).join('|');
  const fittedPlaces = useMemo(
    () =>
      fitKey
        ? fitKey.split('|').map((point) => {
            const [latitude, longitude] = point.split(',').map(Number);
            return { latitude, longitude };
          })
        : [],
    [fitKey],
  );

  const stopCamera = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const updateCenter = useCallback((point: Point) => {
    centerRef.current = point;
    setCenter(point);
  }, []);
  const moveCamera = useCallback(
    (point: Point, nextZoom: number) => {
      stopCamera();
      const previousZoom = zoomRef.current;
      const previous = centerRef.current;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (previousZoom !== nextZoom) setTileError(false);
      const ratio = 2 ** (nextZoom - previousZoom);
      const origin = { x: previous.x * ratio, y: previous.y * ratio };
      if (
        reduce ||
        Math.hypot(point.x - origin.x, point.y - origin.y) >
          Math.max(size.width, size.height) * 1.25
      ) {
        updateCenter(point);
        return;
      }
      updateCenter(origin);
      let start: number | undefined;
      const animate = (now: number) => {
        start ??= now;
        const elapsed = Math.min(1, (now - start) / theme.motion.camera);
        const progress = 1 - (1 - elapsed) ** 3;
        updateCenter({
          x: origin.x + (point.x - origin.x) * progress,
          y: origin.y + (point.y - origin.y) * progress,
        });
        frame.current = elapsed < 1 ? requestAnimationFrame(animate) : null;
      };
      frame.current = requestAnimationFrame(animate);
    },
    [reduce, size, stopCamera, updateCenter],
  );

  useEffect(() => {
    const offsetY = (bottomInset - topInset) / 2;
    if (target) {
      const level = target.longitudeDelta ? homeZoom : zoomRef.current;
      const point = project(target.latitude, target.longitude, level);
      if (target.focusPlace) {
        const active = centerRef.current;
        const x = point.x - active.x + size.width / 2;
        const y = point.y - active.y + size.height / 2;
        const inside =
          x >= 59 &&
          x <= size.width - 59 &&
          y >= topInset + 46 &&
          y <= size.height - bottomInset - 12;
        if (inside) return stopCamera;
      }
      moveCamera({ ...point, y: point.y + offsetY }, level);
    } else if (fittedPlaces.length) {
      const initial = fittedPlaces.map(({ latitude, longitude }) =>
        project(latitude, longitude, homeZoom),
      );
      const xs = initial.map(({ x }) => x);
      const ys = initial.map(({ y }) => y);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs);
      const minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const ratio = Math.min(
        Math.max(95, size.width - 126) / Math.max(1, maxX - minX),
        Math.max(88, size.height - topInset - bottomInset - 44) / Math.max(1, maxY - minY),
      );
      const level = Math.max(10, Math.min(15, homeZoom + Math.floor(Math.log2(ratio))));
      const scale = 2 ** (level - homeZoom);
      moveCamera(
        { x: ((minX + maxX) / 2) * scale, y: ((minY + maxY) / 2) * scale + offsetY },
        level,
      );
    } else {
      const point = project(regions[region].latitude, regions[region].longitude, homeZoom);
      moveCamera({ ...point, y: point.y + offsetY }, homeZoom);
    }
    return stopCamera;
  }, [bottomInset, fittedPlaces, moveCamera, region, size, stopCamera, target, topInset]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
        onPanResponderGrant: () => {
          stopCamera();
          dragOrigin.current = centerRef.current;
        },
        onPanResponderMove: (_, gesture) =>
          updateCenter({
            x: dragOrigin.current.x - gesture.dx,
            y: dragOrigin.current.y - gesture.dy,
          }),
      }),
    [stopCamera, updateCenter],
  );
  const layout = ({
    nativeEvent: {
      layout: { width, height },
    },
  }: LayoutChangeEvent) =>
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  const changeZoom = (delta: number) => {
    const next = Math.max(10, Math.min(17, zoom + delta));
    if (next === zoom) return;
    const ratio = 2 ** (next - zoom);
    const offsetY = (bottomInset - topInset) / 2;
    moveCamera({ x: center.x * ratio, y: (center.y - offsetY) * ratio + offsetY }, next);
  };
  const tiles = [];
  const left = center.x - size.width / 2;
  const top = center.y - size.height / 2;
  for (let x = Math.floor(left / 256); x <= Math.floor((left + size.width) / 256); x++)
    for (let y = Math.floor(top / 256); y <= Math.floor((top + size.height) / 256); y++)
      tiles.push({ x, y });
  const routeKey = routes.map((route) => route.map(({ id }) => id).join('|')).join('/');
  const pinDelay = (index: number) => Math.min(index, 4) * theme.motion.markerInterval;
  const pins = places.map((place) => {
    const source = project(place.latitude, place.longitude, zoom);
    return { id: place.id, point: { x: source.x - left, y: source.y - top } };
  });
  const sortedPins = [...pins].sort(
    (a, b) => Number(b.id === selectedId) - Number(a.id === selectedId),
  );
  const display = separateMarkers(sortedPins, {
    left: 34,
    right: size.width - 34,
    top: topInset + 24,
    bottom: size.height - bottomInset,
  });
  return (
    <View style={s.map} onLayout={layout} {...pan.panHandlers}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {tiles.map((tile) => (
          <Image
            key={`${zoom}/${tile.x}/${tile.y}`}
            source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }}
            onError={() => setTileError(true)}
            style={{
              position: 'absolute',
              width: 256,
              height: 256,
              left: tile.x * 256 - left,
              top: tile.y * 256 - top,
            }}
          />
        ))}
      </View>
      <Reveal
        key={`${routeKey}-${revealKey}`}
        delay={places.length > 0 ? 160 : 0}
        distance={0}
        style={StyleSheet.absoluteFill}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {routes.flatMap((route, index) =>
            route.slice(1).map((place, offset) => {
              const a = project(route[offset].latitude, route[offset].longitude, zoom);
              const b = project(place.latitude, place.longitude, zoom);
              const length = Math.hypot(b.x - a.x, b.y - a.y);
              const day = Number(orderLabels[place.id]?.match(/Day (\d+)/)?.[1]) || index + 1;
              return (
                <View
                  key={`${index}-${offset}`}
                  style={{
                    position: 'absolute',
                    left: (a.x + b.x) / 2 - left - length / 2,
                    top: (a.y + b.y) / 2 - top,
                    width: length,
                    height: 2,
                    borderTopWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: routeColors[(day - 1) % routeColors.length],
                    transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
                  }}
                />
              );
            }),
          )}
        </View>
      </Reveal>
      {places.map((place, index) => {
        const original = pins[index].point;
        const { x, y } = display.get(place.id) ?? original;
        const offset = Math.hypot(x - original.x, y - original.y);
        const labelLeft = y < topInset + 100 ? 61 : 8;
        const labelRight = size.width - (y < topInset + 184 ? 64 : 8);
        const selected = place.id === selectedId;
        const order = orderLabels[place.id]?.match(/Day (\d+) · (\d+)/);
        const label =
          order?.[2] ?? recommendations.find((item) => item.placeId === place.id)?.score ?? '•';
        const color = routeColors[(Number(order?.[1] ?? 1) - 1) % routeColors.length];
        // Mount a hit target only when at least some of its visible marker is on screen.
        if (x < -14 || x > size.width + 14 || y < -14 || y > size.height + 14) return null;
        return (
          <Reveal
            key={`${place.id}-${revealKey}`}
            delay={pinDelay(index)}
            distance={7}
            style={[s.pin, { left: x - 22, top: y - 22, zIndex: selected ? 3 : 2 }]}
          >
            {offset > 10 && (
              <View
                pointerEvents="none"
                style={[
                  s.leader,
                  {
                    width: offset,
                    left: 22 + (original.x - x - offset) / 2,
                    top: 22 + (original.y - y) / 2,
                    transform: [{ rotate: `${Math.atan2(original.y - y, original.x - x)}rad` }],
                  },
                ]}
              />
            )}
            <Pressable
              accessibilityRole="button"
              aria-selected={selected}
              accessibilityState={{ selected }}
              accessibilityLabel={`${place.name} 지도 마커`}
              onPress={() => onSelect(place.id)}
              style={s.pinHit}
            >
              <View style={[s.dot, { borderColor: color }, selected && s.dotActive]}>
                <Text style={[s.pinNumber, { color: selected ? theme.colors.white : color }]}>
                  {label}
                </Text>
              </View>
            </Pressable>
            {selected && y > topInset + 41 && y < size.height - bottomInset + 8 && (
              <View
                pointerEvents="none"
                style={[
                  s.pinLabel,
                  { left: Math.max(labelLeft, Math.min(labelRight - 150, x - 75)) - (x - 22) },
                ]}
              >
                <Text numberOfLines={1} style={s.pinLabelText}>
                  {place.name}
                </Text>
              </View>
            )}
          </Reveal>
        );
      })}
      <View style={[s.zoom, { top: topInset + 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지도 확대"
          onPress={() => changeZoom(1)}
          style={s.zoomButton}
        >
          <Text style={s.zoomText}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지도 축소"
          onPress={() => changeZoom(-1)}
          style={s.zoomButton}
        >
          <Text style={s.zoomText}>−</Text>
        </Pressable>
      </View>
      {tileError && (
        <View pointerEvents="none" style={[s.error, { top: topInset }]}>
          <Text style={s.errorText}>일부 지도 타일을 불러오지 못했어요.</Text>
        </View>
      )}
      <Text style={[s.credit, { top: topInset - 9 }]}>© OpenStreetMap contributors</Text>
    </View>
  );
}

const s = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#E6EDE3', overflow: 'hidden' },
  pin: { position: 'absolute', width: 44, height: 44 },
  leader: {
    position: 'absolute',
    height: 1,
    borderTopWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dotted',
  },
  pinHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.white,
    borderWidth: 2,
    width: 33,
    height: 33,
    borderRadius: 17,
  },
  pinNumber: { fontSize: 12, fontWeight: '800' },
  pinLabel: {
    position: 'absolute',
    width: 150,
    top: -23,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  pinLabelText: { color: theme.colors.white, fontSize: 12, fontWeight: '700' },
  zoom: {
    position: 'absolute',
    left: 14,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    zIndex: 4,
    ...theme.shadows.card,
  },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 23, color: theme.colors.primary },
  credit: {
    position: 'absolute',
    left: 15,
    fontSize: 10,
    color: '#29443A',
    backgroundColor: '#FFFFFCE8',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  error: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '58%',
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
  },
  errorText: { color: theme.colors.muted, fontSize: 11 },
});
