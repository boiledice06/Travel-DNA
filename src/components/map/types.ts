import type { Place, Recommendation, RegionId } from '../../types';
export interface MapProps {
  region: RegionId;
  places: Place[];
  routes?: Place[][];
  orderLabels?: Record<string, string>;
  topInset?: number;
  bottomInset?: number;
  revealKey?: number;
  recommendations: Recommendation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  target: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
    token: number;
    focusPlace?: boolean;
  } | null;
}
