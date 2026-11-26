import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { presentationPhotoUrl } from '../../services/presentation/demo';
import { reviewedSeoulPhoto } from '../../services/photos/seoul';
import { theme as t } from '../../theme';
import type { Place } from '../../types';

type Shape = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius: number;
  angle: number;
};
const ink = '#2D5D5A';
const jade = '#76AF9C';
const stone = '#AFCDC0';
const paper = '#F2F5E9';
const bronze = '#BA7963';
const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 0,
  angle = 0,
): Shape => ({ x, y, w, h, fill, radius, angle });
const line = (
  x: number,
  y: number,
  endX: number,
  endY: number,
  fill = ink,
  weight = 1.8,
): Shape => {
  const w = Math.hypot(endX - x, endY - y);
  return box(
    (x + endX - w) / 2,
    (y + endY - weight) / 2,
    w,
    weight,
    fill,
    weight / 2,
    (Math.atan2(endY - y, endX - x) * 180) / Math.PI,
  );
};
const scenes = {
  art: [
    box(43, 17, 74, 58, ink, 5),
    box(48, 22, 64, 48, paper, 3),
    box(72, 26, 21, 21, bronze, 11),
    box(58, 47, 36, 11, jade, 5, -25),
    box(79, 53, 24, 10, stone, 5, 28),
    line(39, 80, 120, 80, ink),
  ],
  museum: [
    box(37, 36, 86, 7, ink, 2),
    box(42, 74, 76, 6, ink, 2),
    line(40, 36, 80, 16),
    line(80, 16, 120, 36),
    box(76, 25, 8, 8, bronze, 4),
    ...[49, 67, 86, 104].map((x) => box(x, 44, 7, 30, jade, 1)),
  ],
  park: [
    box(117, 14, 17, 17, bronze, 9),
    box(43, 28, 30, 32, jade, 16),
    box(82, 19, 30, 40, stone, 16),
    line(58, 49, 58, 71, ink, 3),
    line(96, 46, 96, 71, ink, 3),
    line(33, 72, 127, 72, ink),
    line(67, 73, 85, 80, ink),
    line(85, 80, 72, 85, ink),
  ],
  cafe: [
    box(94, 41, 23, 22, ink, 11),
    box(100, 46, 12, 12, paper, 6),
    box(51, 37, 50, 34, ink, 10),
    box(56, 40, 40, 24, jade, 7),
    box(48, 73, 61, 5, bronze, 3),
    line(65, 20, 70, 28),
    line(70, 28, 65, 34),
    line(80, 14, 84, 22),
    line(84, 22, 79, 29),
  ],
  food: [
    box(48, 42, 66, 33, jade, 15),
    box(46, 41, 70, 5, ink, 2),
    box(65, 73, 31, 5, ink, 2),
    line(55, 39, 105, 18, bronze, 3),
    line(62, 39, 113, 22, bronze, 3),
    box(68, 51, 4, 4, ink, 2),
    box(79, 51, 4, 4, ink, 2),
    box(90, 51, 4, 4, ink, 2),
  ],
  building: [
    box(48, 29, 41, 45, jade, 2),
    box(85, 16, 33, 58, ink, 2),
    ...[35, 46, 57].flatMap((y) => [box(55, y, 11, 5, paper, 1), box(72, y, 9, 5, paper, 1)]),
    ...[24, 35, 46, 57].map((y) => box(93, y, 17, 5, stone, 1)),
    box(105, 67, 9, 7, bronze, 1),
    line(39, 76, 124, 76),
  ],
  street: [
    box(32, 27, 24, 41, jade, 1),
    box(53, 34, 18, 26, stone, 1),
    box(103, 25, 25, 43, ink, 1),
    box(90, 35, 14, 24, jade, 1),
    box(37, 35, 12, 6, paper, 1),
    box(110, 33, 11, 6, paper, 1),
    box(41, 48, 9, 20, bronze, 1),
    box(113, 49, 9, 19, stone, 1),
    line(68, 61, 46, 82),
    line(92, 61, 114, 82),
    line(80, 65, 80, 72, bronze),
  ],
};

function typeOf(place: Place): keyof typeof scenes {
  const text = place.name + ' ' + place.category;
  if (/박물관|기념관|역사관|museum/i.test(text)) return 'museum';
  if (/미술|전시|갤러리|gallery/i.test(text)) return 'art';
  if (/카페|커피|찻집|cafe/i.test(text)) return 'cafe';
  if (/음식|식당|맛집|레스토랑|식사|restaurant/i.test(text)) return 'food';
  if (/공원|정원|숲|호수|산책|수목원|park/i.test(text)) return 'park';
  if (/거리|시장|골목|길$|street/i.test(text)) return 'street';
  return 'building';
}

export function PlaceMedia({
  place,
  style,
  label = true,
}: {
  place: Place;
  style?: StyleProp<ViewStyle>;
  label?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failedUrl, setFailedUrl] = useState('');
  const reviewed = reviewedSeoulPhoto(place);
  const photo = reviewed?.photo ?? place.photo;
  const sourceKey = photo?.url;
  const photoUrl = !reviewed && sourceKey ? presentationPhotoUrl(sourceKey) : undefined;
  const source =
    sourceKey !== failedUrl
      ? (reviewed?.asset ?? (photoUrl ? { uri: photoUrl } : undefined))
      : undefined;
  const scale = Math.min(size.width / 160, size.height / (label ? 108 : 88));
  const type = typeOf(place);
  const artHeight = label ? 97 : 88;

  return (
    <View
      style={[s.frame, style]}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) =>
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        )
      }
    >
      {source ? (
        <Image
          source={source}
          resizeMode="contain"
          style={s.photo}
          accessibilityLabel={`${place.name} 실제 사진`}
          onError={() => setFailedUrl(sourceKey ?? '')}
        />
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${place.category} 카테고리 일러스트`}
          style={s.plate}
        >
          <View
            pointerEvents="none"
            style={[s.figure, { width: 160 * scale, height: artHeight * scale }]}
          >
            {scenes[type].map(({ x, y, w, h, fill, radius, angle }, index) => (
              <View
                key={index}
                style={[
                  s.shape,
                  {
                    left: x * scale,
                    top: y * scale,
                    width: w * scale,
                    height: h * scale,
                    borderRadius: radius * scale,
                    backgroundColor: fill,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            ))}
          </View>
          {label && (
            <Text style={s.caption} numberOfLines={1}>
              일러스트
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#E0EAE2' },
  photo: { width: '100%', height: '100%', backgroundColor: '#DFE7DF' },
  plate: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  figure: { position: 'relative' },
  shape: { position: 'absolute' },
  caption: { fontSize: 10, color: t.colors.muted, lineHeight: 13 },
});
