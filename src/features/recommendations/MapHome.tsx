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
import { attributeLabels, places, regions } from '../../data/mock/places';
import type { Attribute, RegionId } from '../../types';
import { s } from './map-home.styles';
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
    setRegion,
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
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<MapProps['target']>(null);
  const [expanded, setExpanded] = useState(false);
  const [regionModal, setRegionModal] = useState(false);
  const [conditionsModal, setConditionsModal] = useState(false);
  const [budget, setBudget] = useState('');
  const [availableTime, setAvailableTime] = useState('');
  const [companions, setCompanions] = useState('');
  const [purpose, setPurpose] = useState('');
  const request = () => {
    setConditionsModal(false);
    requestRecommendations({
      region: data.region,
      ...(budget.trim() && { budget: budget.trim() }),
      ...(availableTime.trim() && { availableTime: availableTime.trim() }),
      ...(companions.trim() && { companions: companions.trim() }),
      ...(purpose.trim() && { purpose: purpose.trim() }),
    });
  };
  const [notice, setNotice] = useState('');
  const [locating, setLocating] = useState(false);
  const regionPlaces = useMemo(
    () => (savedOnly ? allPlaces : activePlaces).filter((p) => p.region === data.region),
    [activePlaces, allPlaces, data.region, savedOnly],
  );
  const visible = useMemo(
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
  const changeRegion = (id: RegionId) => {
    setRegion(id);
    setFilter(null);
    setQuery('');
    setSavedOnly(false);
    setSelected(null);
    setTarget({ ...regions[id], token: Date.now() });
    setRegionModal(false);
  };
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
          region={data.region}
          places={visible}
          recommendations={recommendations}
          selectedId={selected}
          onSelect={select}
          target={target}
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
            placeholder={`${regions[data.region].name}, 어디로 떠나볼까요?`}
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
            <Pressable
              accessibilityRole="button"
              onPress={() => setRegionModal(true)}
              style={ui.row}
            >
              <Text style={[ui.small, { color: '#174A7E', fontWeight: '700' }]}>
                {regions[data.region].name}
              </Text>
              <Icon name="chevron-down" size={15} />
            </Pressable>
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
                    setExpanded(false);
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
      <View style={[s.floats, { bottom: expanded ? Math.min(height * 0.62, 560) + 30 : 278 }]}>
        {!expanded && (
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
        {!expanded && (
          <IconButton
            icon="expand-outline"
            label="선택 지역 지도 초기화"
            onPress={() => {
              setTarget({ ...regions[data.region], token: Date.now() });
              setNotice(`${regions[data.region].name} 전체 지도로 이동했어요.`);
            }}
          />
        )}
      </View>
      <RecommendationSheet
        places={visible}
        recommendations={recommendations}
        selectedId={selected}
        savedIds={data.savedIds}
        title={savedOnly ? '저장한 발견' : data.nickname + '님을 위한 발견'}
        subtitle={
          visible.length +
          '곳 · ' +
          (savedOnly
            ? '저장된 장소 · 출처는 카드와 상세 참고'
            : recommendationOrigin === 'api'
              ? '서버 추천 · 출처는 상세 참고'
              : '데모 장소 · 규칙 기반 예상 일치도')
        }
        expanded={expanded}
        onExpand={setExpanded}
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
            <Text style={ui.body}>
              지역: {regions[data.region].name} · 다른 조건은 선택 사항입니다.
            </Text>
            {(
              [
                ['예산', budget, setBudget],
                ['가용 시간', availableTime, setAvailableTime],
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
              과거 메모의 단어와 취향 점수, 위 조건이 설정된 서버로 전송됩니다. 데모 추천은 추가
              조건을 반영하지 않습니다.
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
      <Modal
        transparent
        visible={regionModal}
        animationType="slide"
        onRequestClose={() => setRegionModal(false)}
      >
        <Pressable style={s.scrim} onPress={() => setRegionModal(false)}>
          <Pressable
            style={[s.modal, { paddingBottom: insets.bottom + 24 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={ui.eyebrow}>YOUR NEXT CHAPTER</Text>
            <Text style={ui.title}>어디를 발견할까요?</Text>
            <Text style={ui.body}>선택한 도시의 장소만 지도에 표시됩니다.</Text>
            {(Object.keys(regions) as RegionId[]).map((id) => (
              <Button
                key={id}
                title={`${regions[id].name}  ·  ${places.filter((p) => p.region === id).length}개의 장소`}
                secondary={data.region !== id}
                onPress={() => changeRegion(id)}
              />
            ))}
            <Button title="닫기" secondary onPress={() => setRegionModal(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
