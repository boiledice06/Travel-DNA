export type SheetState = 'collapsed' | 'compact' | 'expanded';

export function sheetHeights(available: number): Record<SheetState, number> {
  return {
    collapsed: 52,
    compact: Math.max(135, Math.min(278, available * 0.54)),
    expanded: Math.max(136, Math.min(570, available * 0.72)),
  };
}

export function snapSheet(
  heights: Record<SheetState, number>,
  height: number,
  velocityY: number,
): SheetState {
  'worklet';
  const projected = height - Math.max(-125, Math.min(125, velocityY * 0.17));
  const lower = (heights.collapsed + heights.compact) / 2;
  const upper = (heights.compact + heights.expanded) / 2;
  if (projected < lower) return 'collapsed';
  if (projected > upper) return 'expanded';
  return 'compact';
}
