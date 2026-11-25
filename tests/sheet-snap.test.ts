import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetHeights, snapSheet } from '../src/components/map/sheetSnap.ts';

test('sheet has distinct, ordered snap points on supported screen sizes', () => {
  for (const height of [250, 758, 790, 878, 1200]) {
    const points = sheetHeights(height);
    assert(points.collapsed < points.compact);
    assert(points.compact < points.expanded);
    assert(points.expanded <= height);
  }
});

test('sheet snaps to the nearest state for slow drags and projects faster releases', () => {
  const points = sheetHeights(790);
  assert.equal(snapSheet(points, points.collapsed, 0), 'collapsed');
  assert.equal(snapSheet(points, points.compact, 0), 'compact');
  assert.equal(snapSheet(points, points.expanded, 0), 'expanded');
  assert.equal(snapSheet(points, points.compact + 80, -850), 'expanded');
  assert.equal(snapSheet(points, points.compact - 40, 950), 'collapsed');
});
