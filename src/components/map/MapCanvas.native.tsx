import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { regions } from '../../data/mock/places';
import { theme } from '../../theme';
import type { MapProps } from './types';
const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
    ...theme.shadows.card,
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.accent },
  text: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  notice: {
    position: 'absolute',
    top: '45%',
    left: 22,
    right: 22,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
});
const Pin = memo(function Pin({
  place,
  score,
  selected,
  onSelect,
}: {
  place: MapProps['places'][number];
  score: number;
  selected: boolean;
  onSelect: MapProps['onSelect'];
}) {
  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={() => onSelect(place.id)}
      tracksViewChanges={selected}
      title={place.name}
      description={`예상 일치도 ${score}점`}
    >
      <View style={[styles.marker, selected && styles.selected]}>
        <Text style={[styles.text, selected && { color: '#fff' }]}>
          {selected ? `${place.name}  ` : ''}
          {score}
        </Text>
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
}: MapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [late, setLate] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), 15000);
    return () => clearTimeout(timer);
  }, [retry]);
  useEffect(() => {
    if (ready) map.current?.animateToRegion(regions[region], 500);
  }, [region, ready]);
  useEffect(() => {
    if (ready && target)
      map.current?.animateToRegion(
        {
          ...target,
          latitudeDelta: target.latitudeDelta ?? 0.025,
          longitudeDelta: target.longitudeDelta ?? 0.025,
        },
        450,
      );
  }, [target, ready]);
  return (
    <View style={styles.map}>
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
        mapPadding={{ top: 190, right: 20, bottom: 250, left: 20 }}
      >
        {places.map((p) => (
          <Pin
            key={`${p.id}-${recommendations.find((r) => r.placeId === p.id)?.score ?? 50}-${selectedId === p.id}`}
            place={p}
            score={recommendations.find((r) => r.placeId === p.id)?.score ?? 50}
            selected={selectedId === p.id}
            onSelect={onSelect}
          />
        ))}
      </MapView>
      {late && !ready && (
        <Pressable
          style={styles.notice}
          onPress={() => {
            setReady(false);
            setLate(false);
            setRetry((v) => v + 1);
          }}
        >
          <Text>지도가 지연되고 있어요. 아래 추천 목록은 계속 사용할 수 있어요. 탭하여 재시도</Text>
        </Pressable>
      )}
    </View>
  );
}
