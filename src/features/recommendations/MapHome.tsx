import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { getCurrentCoordinates } from '../../utils/location';
import MapCanvas from '../../components/map/MapCanvas';
import { MapBoundary } from '../../components/map/MapBoundary';
import type { MapProps } from '../../components/map/types';
import { Button, Chip, Icon, IconButton } from '../../components/common/UI';
import { RecommendationSheet } from '../../components/map/RecommendationSheet';
import { ui } from '../../components/common/ui.styles';
import { useTravel } from '../../hooks/useTravel';
import { attributeLabels, regions } from '../../data/mock/places';
import type { Attribute } from '../../types';
import { s } from './map-home.styles';
import { createItinerary } from '../../services/itinerary';
const filters: Attribute[] = [
  'walk',
  'nature',
  'architecture',
  'food',
  'quiet',
  'night',
  'culture',
  'local',
  'shopping',
  'activity',
];
export default function MapHome() {
  const {
    data,
    recommendations,
    toggleSave,
    dna,
    activePlaces,
    allPlaces,
    recommendationOrigin,
    recommendationStatus,
    recommendationError,
    requestRecommendations,
  } = useTravel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [filter, setFilter] = useState<Attribute | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<MapProps['target']>(null);
  const [sheetState, setSheetState] = useState<'collapsed' | 'compact' | 'expanded'>('compact');
  const [conditionsModal, setConditionsModal] = useState(false);
  const [budget, setBudget] = useState('');
  const [availableTime, setAvailableTime] = useState('');
  const [companions, setCompanions] = useState('');
  const [purpose, setPurpose] = useState('');
  const request = () => {
    setConditionsModal(false);
    requestRecommendations({
      region: 'seoul',
      ...(budget.trim() && { budget: budget.trim() }),
      ...(availableTime.trim() && { availableTime: availableTime.trim() }),
      ...(companions.trim() && { companions: companions.trim() }),
      ...(purpose.trim() && { purpose: purpose.trim() }),
    });
  };
  const [notice, setNotice] = useState('');
  const [locating, setLocating] = useState(false);
  const regionPlaces = useMemo(
    () => (savedOnly ? allPlaces : activePlaces).filter((p) => p.region === 'seoul'),
    [activePlaces, allPlaces, data.region, savedOnly],
  );
  const candidates = useMemo(
    () =>
      recommendations.flatMap((r) => {
        const p = regionPlaces.find((p) => p.id === r.placeId);
        return p &&
          (!filter || (p.positiveAttributes[filter] ?? 0) >= 0.5) &&
          (!savedOnly || data.savedIds.includes(p.id))
          ? [p]
          : [];
      }),
    [recommendations, regionPlaces, filter, savedOnly, data.savedIds],
  );
  const itinerary = useMemo(() => createItinerary(candidates), [candidates]);
  const orderLabels = Object.fromEntries(
    itinerary.flatMap((route, d) => route.map((p, i) => [p.id, `Day ${d + 1} · ${i + 1}`])),
  );
  const visible = day === null ? itinerary.flat() : itinerary[day];
  const result = regionPlaces
    .filter((p) => `${p.name} ${p.category} ${p.district}`.includes(query.trim()))
    .slice(0, 5);
  const select = useCallback(
    (id: string) => {
      const p = regionPlaces.find((p) => p.id === id);
      if (!p) return;
      setSelected(id);
      setTarget({ latitude: p.latitude, longitude: p.longitude, token: Date.now() });
    },
    [regionPlaces],
  );
  useEffect(() => {
    if (!visible.some((p) => p.id === selected)) {
      if (visible[0]) select(visible[0].id);
      else setSelected(null);
    }
  }, [visible, selected, select]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const open = (id: string) => router.push({ pathname: '/place/[id]', params: { id } });
  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setNotice('위치 권한이 없어요. 지역 선택으로 지도를 이동할 수 있어요.');
        return;
      }
      const position = await getCurrentCoordinates();
      setTarget({ ...position.coords, token: Date.now() });
      setNotice('내 위치로 이동했어요. 추천 장소는 선택한 지역 기준입니다.');
    } catch {
      setNotice('현재 위치를 찾지 못했어요. 위치 서비스와 브라우저 권한을 확인해 주세요.');
    } finally {
      setLocating(false);
    }
  };
  return (
    <View style={s.root}>
      <MapBoundary>
        <MapCanvas
          region="seoul"
          places={visible}
          recommendations={recommendations}
          selectedId={selected}
          onSelect={select}
          target={target}
          routes={day === null ? itinerary : [itinerary[day]]}
          orderLabels={orderLabels}
        />
      </MapBoundary>
      <View pointerEvents="box-none" style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={ui.between}>
          <View>
            <Text style={ui.eyebrow}>TRAVEL DNA</Text>
            <Text style={s.heading}>나의 취향이 닿는 곳</Text>
          </View>
          <IconButton
            icon="finger-print-outline"
            label="나의 Travel DNA 보기"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </View>
        <View style={ui.wrap}>
          {(['전체', 'Day 1', 'Day 2', 'Day 3'] as const).map((label, i) => (
            <Chip
              key={label}
              label={label}
              selected={day === (i ? i - 1 : null)}
              onPress={() => setDay(i ? i - 1 : null)}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConditionsModal(true)}
          style={s.search}
        >
          <Text style={ui.small}>
            여행 조건 입력 · 추천 요청 {recommendationStatus === 'loading' ? '(불러오는 중)' : '›'}
          </Text>
        </Pressable>
        {(recommendationStatus === 'error' || recommendationStatus === 'empty') && (
          <Pressable accessibilityRole="button" onPress={request} style={s.search}>
            <Text style={ui.small}>
              {recommendationError ?? '추천 결과가 없습니다.'} · 탭하여 재시도
            </Text>
          </Pressable>
        )}
        <View style={s.search}>
          <Icon name="search-outline" size={20} />
          <TextInput
            accessibilityLabel="여행지 검색"
            placeholder={`${regions.seoul.name}, 어디로 떠나볼까요?`}
            placeholderTextColor="#84929E"
            value={query}
            onChangeText={setQuery}
            style={s.input}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              accessibilityLabel="검색 지우기"
              onPress={() => setQuery('')}
              style={{ padding: 8 }}
            >
              <Icon name="close" size={18} />
            </Pressable>
          ) : (
            <Text style={[ui.small, { color: '#174A7E', fontWeight: '700' }]}>서울</Text>
          )}
        </View>
        {query.trim() ? (
          <View style={s.resultBox}>
            {result.length ? (
              result.map((p) => (
                <Pressable
                  accessibilityRole="button"
                  key={p.id}
                  style={s.result}
                  onPress={() => {
                    setFilter(null);
                    setSavedOnly(false);
                    setQuery('');
                    select(p.id);
                    setSheetState('compact');
                  }}
                >
                  <Icon name="location-outline" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#16263A', fontWeight: '600' }}>{p.name}</Text>
                    <Text style={ui.small}>{p.district}</Text>
                  </View>
                  <Icon name="arrow-up-outline" size={16} />
                </Pressable>
              ))
            ) : (
              <Text style={{ padding: 16 }}>이 지역에서 검색 결과가 없어요.</Text>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            <Chip label="✦ 나의 추천" selected={!filter} onPress={() => setFilter(null)} />
            {filters.map((k) => (
              <Chip
                key={k}
                label={attributeLabels[k]}
                selected={filter === k}
                onPress={() => setFilter(filter === k ? null : k)}
              />
            ))}
          </ScrollView>
        )}
      </View>
      <View
        style={[
          s.floats,
          {
            bottom:
              sheetState === 'expanded'
                ? Math.min(height * 0.62, 560) + 30
                : sheetState === 'collapsed'
                  ? 90
                  : 278,
          },
        ]}
      >
        {sheetState !== 'expanded' && (
          <IconButton
            icon={locating ? 'hourglass-outline' : 'locate-outline'}
            label="현재 위치로 이동"
            onPress={locate}
          />
        )}
        <IconButton
          icon={savedOnly ? 'bookmark' : 'bookmark-outline'}
          label="지도에서 저장 장소 필터"
          active={savedOnly}
          onPress={() => setSavedOnly((v) => !v)}
        />
        {sheetState !== 'expanded' && (
          <IconButton
            icon="expand-outline"
            label="선택 지역 지도 초기화"
            onPress={() => {
              setTarget({ ...regions.seoul, token: Date.now() });
              setNotice(`${regions.seoul.name} 전체 지도로 이동했어요.`);
            }}
          />
        )}
      </View>
      <RecommendationSheet
        places={visible}
        orderLabels={orderLabels}
        recommendations={recommendations}
        selectedId={selected}
        savedIds={data.savedIds}
        title={savedOnly ? '저장한 발견' : data.nickname + '님을 위한 발견'}
        subtitle={
          visible.length +
          '곳 · 직선 연결 (실제 이동 경로 아님) · ' +
          (savedOnly
            ? '저장된 장소 · 출처는 카드와 상세 참고'
            : recommendationOrigin === 'api'
              ? '서버 추천 · 출처는 상세 참고'
              : '데모 장소 · 규칙 기반 예상 일치도')
        }
        state={sheetState}
        onStateChange={setSheetState}
        onSelect={select}
        onSave={toggleSave}
        onOpen={open}
      />
      {!!notice && (
        <View style={s.toast}>
          <Text style={ui.small}>{notice}</Text>
        </View>
      )}
      <Modal
        transparent
        visible={conditionsModal}
        animationType="slide"
        onRequestClose={() => setConditionsModal(false)}
      >
        <View style={s.scrim}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.modal, { paddingBottom: insets.bottom + 24 }]}
          >
            <Text style={ui.title}>이번 여행 조건</Text>
            <Text style={ui.body}>지역: 서울 (변경 불가) · 여행 기간: 3일</Text>
            {(
              [
                ['전체 여행 예산', budget, setBudget],
                ['인원', availableTime, setAvailableTime],
                ['동행 형태', companions, setCompanions],
                ['여행 목적', purpose, setPurpose],
              ] as const
            ).map(([label, value, change]) => (
              <TextInput
                key={label}
                accessibilityLabel={label}
                placeholder={label + ' (선택)'}
                value={value}
                onChangeText={change}
                style={s.search}
              />
            ))}
            <Text style={ui.small}>
              데모 추천과 일정은 추가 조건을 반영하지 않습니다. 서버는 아직 3일 여행을 지원하지
              않습니다.
            </Text>
            <Button
              title="추천 요청"
              onPress={request}
              disabled={recommendationStatus === 'loading'}
            />
            <Button title="닫기" secondary onPress={() => setConditionsModal(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
