import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { regions } from '../../data/mock/places';
import { theme } from '../../theme';
import type { MapProps } from './types';

const routeColors = [theme.colors.accent, '#355D86', '#996242'];
const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    maxWidth: 150,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: theme.colors.white,
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.white,
    borderWidth: 2,
  },
  number: { fontSize: 12, fontWeight: '800' },
  notice: {
    position: 'absolute',
    top: '32%',
    left: 68,
    right: 68,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
});

const Pin = memo(function Pin({
  place,
  score,
  selected,
  onSelect,
  orderLabel,
}: {
  place: MapProps['places'][number];
  score: number | null;
  selected: boolean;
  onSelect: MapProps['onSelect'];
  orderLabel?: string;
}) {
  const order = orderLabel?.match(/Day (\d+) · (\d+)/);
  const color = routeColors[(Number(order?.[1] ?? 1) - 1) % routeColors.length];
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 240);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={() => onSelect(place.id)}
      accessibilityLabel={`${place.name} 지도 마커`}
      tracksViewChanges={tracking}
      zIndex={selected ? 2 : 1}
      anchor={{ x: 0.5, y: selected ? 0.72 : 0.5 }}
    >
      <View style={styles.marker}>
        {selected && (
          <Text numberOfLines={1} style={styles.label}>
            {place.name}
          </Text>
        )}
        <View style={[styles.dot, { borderColor: color }, selected && styles.selected]}>
          <Text style={[styles.number, { color: selected ? theme.colors.white : color }]}>
            {order?.[2] ?? score ?? '•'}
          </Text>
        </View>
      </View>
    </Marker>
  );
});

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
  const map = useRef<MapView>(null);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [late, setLate] = useState(false);
  const [retry, setRetry] = useState(0);
  const [animation, setAnimation] = useState({ key: '', pins: 0, line: 0 });
  const fitKey = places.map(({ latitude, longitude }) => `${latitude},${longitude}`).join('|');
  const cameraPoints = useMemo(
    () =>
      fitKey
        ? fitKey.split('|').map((point) => {
            const [latitude, longitude] = point.split(',').map(Number);
            return { latitude, longitude };
          })
        : [],
    [fitKey],
  );
  const sequence = `${revealKey}/${places.map(({ id }) => id).join('|')}`;
  const total = places.length;
  const duration = reduce ? 0 : theme.motion.camera;

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setLate(true), 15000);
    return () => clearTimeout(timer);
  }, [ready, retry]);

  useEffect(() => {
    if (!ready || !layout.width) return;
    let active = true;
    if (target?.focusPlace) {
      const point = { latitude: target.latitude, longitude: target.longitude };
      const focus = () => {
        if (active) map.current?.animateCamera({ center: point }, { duration });
      };
      map.current
        ?.pointForCoordinate(point)
        .then(({ x, y }) => {
          if (
            x < 59 ||
            x > layout.width - 59 ||
            y < topInset + 46 ||
            y > layout.height - bottomInset - 12
          )
            focus();
        })
        .catch(focus);
    } else if (target) {
      map.current?.animateToRegion(
        {
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: target.latitudeDelta ?? 0.022,
          longitudeDelta: target.longitudeDelta ?? 0.022,
        },
        duration,
      );
    } else if (cameraPoints.length > 1) {
      map.current?.fitToCoordinates(cameraPoints, {
        edgePadding: { top: 18, right: 58, bottom: 26, left: 44 },
        animated: !reduce,
      });
    } else if (cameraPoints.length === 1) {
      map.current?.animateToRegion(
        { ...cameraPoints[0], latitudeDelta: 0.018, longitudeDelta: 0.018 },
        duration,
      );
    } else map.current?.animateToRegion(regions[region], duration);
    return () => {
      active = false;
    };
  }, [bottomInset, cameraPoints, duration, layout, ready, reduce, region, target, topInset]);

  useEffect(() => {
    if (!ready || reduce || !total) return;
    const groups = Math.min(total, 5);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let index = 0; index < groups; index++) {
      timers.push(
        setTimeout(
          () =>
            setAnimation({
              key: sequence,
              pins: Math.ceil(((index + 1) / groups) * total),
              line: 0,
            }),
          index * theme.motion.markerInterval,
        ),
      );
    }
    for (let step = 1; step <= 5; step++) {
      timers.push(
        setTimeout(
          () => setAnimation({ key: sequence, pins: total, line: step / 5 }),
          125 + step * 34,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [ready, reduce, sequence, total]);

  const visiblePins = reduce ? total : animation.key === sequence ? animation.pins : 0;
  const lineOpacity = reduce ? 1 : animation.key === sequence ? animation.line : 0;
  return (
    <View
      style={styles.map}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) =>
        setLayout((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        )
      }
    >
      <MapView
        key={retry}
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={regions[region]}
        onMapReady={() => {
          setReady(true);
          setLate(false);
        }}
        showsUserLocation={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        mapPadding={{ top: topInset, right: 12, bottom: bottomInset, left: 12 }}
      >
        {lineOpacity > 0 &&
          routes.map((route, index) => {
            if (route.length < 2) return null;
            const day = Number(orderLabels[route[0].id]?.match(/Day (\d+)/)?.[1]) || index + 1;
            const alpha = Math.round(lineOpacity * 255)
              .toString(16)
              .padStart(2, '0');
            return (
              <Polyline
                key={index}
                coordinates={route.map(({ latitude, longitude }) => ({ latitude, longitude }))}
                strokeColor={routeColors[(day - 1) % routeColors.length] + alpha}
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            );
          })}
        {places.slice(0, visiblePins).map((place) => {
          const score = recommendations.find((item) => item.placeId === place.id)?.score ?? null;
          return (
            <Pin
              key={`${place.id}-${score}-${selectedId === place.id}`}
              place={place}
              orderLabel={orderLabels[place.id]}
              score={score}
              selected={selectedId === place.id}
              onSelect={onSelect}
            />
          );
        })}
      </MapView>
      {late && !ready && (
        <Pressable
          accessibilityRole="button"
          style={styles.notice}
          onPress={() => {
            setReady(false);
            setLate(false);
            setRetry((value) => value + 1);
          }}
        >
          <Text>지도가 지연되고 있어요. 탭하여 다시 불러올 수 있어요.</Text>
        </Pressable>
      )}
    </View>
  );
}
