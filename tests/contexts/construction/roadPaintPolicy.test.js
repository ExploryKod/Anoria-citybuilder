import { describe, test, expect } from '@jest/globals';
import { listRoadPaintCells } from '../../../src/contexts/construction/domain/policies/RoadPaintPolicy.js';

describe('RoadPaintPolicy', () => {
  test('same cell returns only that cell', () => {
    expect(listRoadPaintCells(2, 3, 2, 3)).toEqual([{ x: 2, y: 3 }]);
  });

  test('horizontal line skips start and includes end', () => {
    expect(listRoadPaintCells(0, 0, 3, 0)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  test('vertical line skips start and includes end', () => {
    expect(listRoadPaintCells(1, 1, 1, 4)).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 1, y: 4 },
    ]);
  });

  test('fills diagonal gaps with bresenham', () => {
    const cells = listRoadPaintCells(0, 0, 2, 2);
    expect(cells).toContainEqual({ x: 2, y: 2 });
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });
});
