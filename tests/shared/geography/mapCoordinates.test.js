import { describe, expect, test } from '@jest/globals';
import {
  MAP_COORDINATE_MAX,
  fromMapPixels,
  fromPercentCoords,
  toMapPixels,
  toPercentCoords,
} from '../../../src/shared/geography/mapCoordinates.js';

describe('mapCoordinates', () => {
  test('round-trips normalized and percent coordinates', () => {
    const norm = { x: 0.5, y: 0.347 };
    const percent = toPercentCoords(norm);
    expect(percent.x).toBe(50);
    expect(percent.y).toBeCloseTo(34.7);

    const back = fromPercentCoords(percent);
    expect(back.x).toBeCloseTo(norm.x);
    expect(back.y).toBeCloseTo(norm.y);
  });

  test('converts pixels using MAP_COORDINATE_MAX', () => {
    expect(toMapPixels(1)).toBe(MAP_COORDINATE_MAX);
    expect(fromMapPixels(MAP_COORDINATE_MAX)).toBe(1);
  });
});
