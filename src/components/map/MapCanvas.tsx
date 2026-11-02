// Browser preview only. Native builds resolve MapCanvas.native.tsx (react-native-maps).
// OSM raster tiles use the standard Web Mercator projection; never prefetch/cache for offline use.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MapProps } from './types';
import { regions } from '../../data/mock/places';
import { theme } from '../../theme';
const project = (lat: number, lon: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const radians = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale,
  };
};
export default function MapCanvas({
  region,
  places,
  recommendations,
  selectedId,
  onSelect,
  target,
}: MapProps) {
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState(() =>
    project(regions[region].latitude, regions[region].longitude, 13),
  );
  const [size, setSize] = useState({ width: 400, height: 800 });
  const [tileError, setTileError] = useState(false);
  const dragOrigin = useRef(center);
  const centerRef = useRef(center);
  centerRef.current = center;
  useEffect(() => {
    setCenter(project(regions[region].latitude, regions[region].longitude, zoom));
    setTileError(false);
  }, [region]);
  useEffect(() => {
    if (target) setCenter(project(target.latitude, target.longitude, zoom));
  }, [target]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderGrant: () => {
          dragOrigin.current = centerRef.current;
        },
        onPanResponderMove: (_, g) =>
          setCenter({ x: dragOrigin.current.x - g.dx, y: dragOrigin.current.y - g.dy }),
      }),
    [],
  );
  const tiles = [];
  const left = center.x - size.width / 2,
    top = center.y - size.height / 2;
  for (let x = Math.floor(left / 256); x <= Math.floor((left + size.width) / 256); x++)
    for (let y = Math.floor(top / 256); y <= Math.floor((top + size.height) / 256); y++)
      tiles.push({ x, y });
  const changeZoom = (delta: number) => {
    const next = Math.max(10, Math.min(17, zoom + delta));
    setCenter((c) => ({ x: c.x * 2 ** (next - zoom), y: c.y * 2 ** (next - zoom) }));
    setZoom(next);
  };
  return (
    <View style={s.map} onLayout={(e) => setSize(e.nativeEvent.layout)} {...pan.panHandlers}>
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
      {places.map((place) => {
        const p = project(place.latitude, place.longitude, zoom);
        const selected = place.id === selectedId;
        return (
          <Pressable
            key={place.id}
            accessibilityRole="button"
            accessibilityLabel={`${place.name} 지도 마커`}
            onPress={() => onSelect(place.id)}
            style={[
              s.pin,
              {
                left: p.x - left - 24,
                top: p.y - top - 16,
                backgroundColor: selected ? theme.colors.primary : '#fff',
                borderColor: selected ? theme.colors.accent : '#fff',
                zIndex: selected ? 3 : 2,
              },
            ]}
          >
            <Text
              style={{
                color: selected ? '#fff' : theme.colors.primary,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {selected ? `${place.name}  ` : ''}
              {recommendations.find((r) => r.placeId === place.id)?.score ?? 50}
            </Text>
          </Pressable>
        );
      })}
      <View style={s.zoom}>
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
        <View style={s.error}>
          <Text style={{ fontSize: 12 }}>
            지도 이미지 연결을 확인해 주세요. 마커와 추천 목록은 이용할 수 있어요.
          </Text>
        </View>
      )}
      <Text style={s.credit}>© OpenStreetMap contributors · 웹 미리보기</Text>
    </View>
  );
}
const s = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#E8EEE9', overflow: 'hidden' },
  pin: {
    position: 'absolute',
    padding: 8,
    borderRadius: 18,
    borderWidth: 2,
    ...theme.shadows.card,
  },
  zoom: {
    position: 'absolute',
    left: 20,
    top: '43%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...theme.shadows.card,
  },
  zoomButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 24, color: theme.colors.primary },
  credit: {
    position: 'absolute',
    left: 8,
    bottom: 3,
    fontSize: 9,
    color: '#41534A',
    backgroundColor: '#ffffffdd',
  },
  error: {
    position: 'absolute',
    top: '40%',
    left: 70,
    right: 70,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
