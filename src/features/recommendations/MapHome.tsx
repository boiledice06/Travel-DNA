import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Reveal } from '../../components/common/Motion';
import { sheetHeights, type SheetState } from '../../components/map/sheetSnap';
import { recommendationServerUrl } from '../../services/presentation/demo';
import { theme } from '../../theme';
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
import { TripFlow } from '../trip/TripFlow';
import { filterItinerary } from './mapFilters';
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
    activePlaces,
    recommendationOrigin,
    recommendationStatus,
    recommendationError,
    requestRecommendations,
    applyServerResult,
    serverTrip,
  } = useTravel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const viewport = useWindowDimensions();
  const [mapHeight, setMapHeight] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [filter, setFilter] = useState<Attribute | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<MapProps['target']>(null);
  const [sheetState, setSheetState] = useState<SheetState>('compact');
  const seenTrip = useRef(serverTrip);
  useEffect(() => {
    if (!serverTrip || seenTrip.current === serverTrip) return;
    seenTrip.current = serverTrip;
    setFilter(null);
    setSavedOnly(false);
    setDay(0);
    setTarget(null);
    setSelected(null);
    setSheetState('compact');
    setRevealKey((key) => key + 1);
  }, [serverTrip]);
  const [conditionsModal, setConditionsModal] = useState(false);
  const [tripVisible, setTripVisible] = useState(false);
  const availableHeight = mapHeight || viewport.height - insets.bottom - 58;
  const sheetInset =
    sheetHeights(availableHeight)[sheetState === 'expanded' ? 'compact' : sheetState];
  const serverConfigured = !!recommendationServerUrl?.trim();
  const openPlan = () => {
    Keyboard.dismiss();
    setOptionsOpen(false);
    if (serverConfigured) setTripVisible(true);
    else setConditionsModal(true);
  };
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
    () => activePlaces.filter((p) => p.region === 'seoul'),
    [activePlaces],
  );
  const candidates = useMemo(
    () =>
      recommendations.flatMap((r) => {
        const p = regionPlaces.find((p) => p.id === r.placeId);
        return p ? [p] : [];
      }),
    [recommendations, regionPlaces],
  );
  const itinerary = useMemo(() => createItinerary(candidates), [candidates]);
  const filteredItinerary = useMemo(
    () => filterItinerary(itinerary, filter, savedOnly, data.savedIds),
    [itinerary, filter, savedOnly, data.savedIds],
  );
  const orderLabels = useMemo(
    () =>
      Object.fromEntries(
        itinerary.flatMap((route, d) => route.map((p, i) => [p.id, `Day ${d + 1} · ${i + 1}`])),
      ),
    [itinerary],
  );
  const routes = useMemo(
    () => (day === null ? filteredItinerary : [filteredItinerary[day]]),
    [day, filteredItinerary],
  );
  const visible = useMemo(() => routes.flat(), [routes]);
  const expandedPlaces = useMemo(() => {
    if (sheetState !== 'expanded' || day !== null) return visible;
    const scheduled = new Set(itinerary.flat().map((place) => place.id));
    const unscheduled = candidates.filter((place) => !scheduled.has(place.id));
    const [extra] = filterItinerary([unscheduled], filter, savedOnly, data.savedIds);
    return [...visible, ...extra];
  }, [candidates, day, filter, itinerary, savedOnly, data.savedIds, sheetState, visible]);
  const changeDay = (next: number | null) => {
    if (next === day) return;
    setDay(next);
    setTarget(null);
  };
  const result = regionPlaces
    .filter((p) => `${p.name} ${p.category} ${p.district}`.includes(query.trim()))
    .slice(0, 5);
  const select = useCallback(
    (id: string) => {
      const p = regionPlaces.find((p) => p.id === id);
      if (!p) return;
      setSelected(id);
      setTarget({
        latitude: p.latitude,
        longitude: p.longitude,
        token: Date.now(),
        focusPlace: true,
      });
    },
    [regionPlaces],
  );
  useEffect(() => {
    if (!visible.some((p) => p.id === selected)) {
      setSelected(visible[0]?.id ?? null);
    }
  }, [visible, selected]);
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
    <View style={s.root} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <MapBoundary>
        <MapCanvas
          region="seoul"
          places={visible}
          recommendations={recommendations}
          selectedId={selected}
          onSelect={(id) => {
            setOptionsOpen(false);
            select(id);
          }}
          target={target}
          routes={routes}
          topInset={insets.top + 77}
          bottomInset={sheetInset + 24}
          revealKey={revealKey}
          orderLabels={orderLabels}
        />
      </MapBoundary>
      <View pointerEvents="box-none" style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.toolbar}>
          <View style={s.search}>
            <Icon name="search-outline" size={20} />
            <TextInput
              accessibilityLabel="여행지 검색"
              placeholder="서울 장소 검색"
              placeholderTextColor={theme.colors.muted}
              value={query}
              onChangeText={setQuery}
              style={s.input}
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="검색 지우기"
                onPress={() => setQuery('')}
                style={s.searchClear}
              >
                <Icon name="close" size={18} />
              </Pressable>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={openPlan} style={s.plan}>
            <Icon name="calendar-outline" size={16} color={theme.colors.white} />
            <Text style={s.planLabel}>여행 설계</Text>
          </Pressable>
          <IconButton
            icon={optionsOpen ? 'close' : 'options-outline'}
            label={optionsOpen ? '지도 옵션 닫기' : '지도 옵션 열기'}
            active={optionsOpen}
            onPress={() => setOptionsOpen(!optionsOpen)}
          />
        </View>
        {optionsOpen && (
          <Reveal style={s.options}>
            {(recommendationStatus === 'error' || recommendationStatus === 'empty') && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOptionsOpen(false);
                  serverConfigured ? setTripVisible(true) : request();
                }}
                style={s.optionAction}
              >
                <Text style={ui.small}>
                  {recommendationError ?? '추천 결과가 없습니다.'} · 다시 시도
                </Text>
              </Pressable>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              <Chip
                label="취향 필터 전체"
                selected={!filter}
                onPress={() => {
                  setFilter(null);
                  setTarget(null);
                }}
              />
              {filters.map((k) => (
                <Chip
                  key={k}
                  label={attributeLabels[k]}
                  selected={filter === k}
                  onPress={() => {
                    setFilter(filter === k ? null : k);
                    setTarget(null);
                  }}
                />
              ))}
            </ScrollView>
          </Reveal>
        )}
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
                    Keyboard.dismiss();
                    setDay(null);
                    select(p.id);
                    setSheetState('compact');
                  }}
                >
                  <Icon name="location-outline" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultTitle}>{p.name}</Text>
                    <Text style={ui.small}>{p.district}</Text>
                  </View>
                  <Icon name="arrow-up-outline" size={16} />
                </Pressable>
              ))
            ) : (
              <Text style={{ padding: 16 }}>이 지역에서 검색 결과가 없어요.</Text>
            )}
          </View>
        ) : null}
      </View>
      {sheetState !== 'expanded' && !optionsOpen && !query.trim() && (
        <View style={[s.floats, { top: insets.top + 76 }]}>
          <IconButton
            icon={locating ? 'hourglass-outline' : 'locate-outline'}
            label="현재 위치로 이동"
            onPress={locate}
          />
          <IconButton
            icon={savedOnly ? 'bookmark' : 'bookmark-outline'}
            label="지도에서 저장 장소 필터"
            active={savedOnly}
            onPress={() => {
              setSavedOnly((v) => !v);
              setTarget(null);
            }}
          />
          <IconButton
            icon="expand-outline"
            label="선택 지역 지도 초기화"
            onPress={() => {
              setTarget({ ...regions.seoul, token: Date.now() });
              setNotice(`${regions.seoul.name} 전체 지도로 이동했어요.`);
            }}
          />
        </View>
      )}
      <RecommendationSheet
        places={expandedPlaces}
        day={day}
        onDayChange={changeDay}
        availableHeight={availableHeight}
        revealKey={revealKey}
        orderLabels={orderLabels}
        recommendations={recommendations}
        selectedId={selected}
        savedIds={data.savedIds}
        title={
          savedOnly
            ? '저장한 장소'
            : day === null
              ? '서울에서 만날 장소'
              : `서울 여행 · Day ${day + 1}`
        }
        subtitle={`${visible.length}곳 · ${recommendationOrigin === 'api' ? '서버 추천' : '데모 추천'} · 직선 연결은 실제 이동 경로가 아니에요.`}
        state={sheetState}
        onStateChange={setSheetState}
        onSelect={(id) => {
          if (selected !== id) select(id);
        }}
        onSave={toggleSave}
        onOpen={open}
      />
      {!!notice && (
        <View style={s.toast}>
          <Text style={ui.small}>{notice}</Text>
        </View>
      )}
      <TripFlow
        visible={tripVisible}
        previousTrip={serverTrip}
        onClose={() => setTripVisible(false)}
        onResult={applyServerResult}
      />
      <Modal
        transparent
        visible={conditionsModal}
        animationType={reduce ? 'none' : 'fade'}
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
                style={[ui.input, s.modalInput]}
              />
            ))}
            <Text style={ui.small}>
              데모 추천과 일정은 추가 조건을 반영하지 않습니다. 실제 분석에는 서버 주소 설정이
              필요합니다.
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
