import { describe, expect, test } from '@jest/globals';
import {
  axialRound,
  axialToPixel,
  hexDistance,
  pixelToAxial,
} from '../../../src/shared/geography/hexCoordinates.js';

describe('hexCoordinates', () => {
  test('round-trips axial through pixel space', () => {
    const hex = { q: 3, r: -5 };
    const pixel = axialToPixel(hex);
    const back = pixelToAxial(pixel.x, pixel.y);
    expect(back).toEqual(hex);
  });

  test('axialRound snaps fractional coords', () => {
    expect(axialRound(0.1, 0.1)).toEqual({ q: 0, r: 0 });
  });

  test('hexDistance is zero for same cell', () => {
    expect(hexDistance({ q: 2, r: 1 }, { q: 2, r: 1 })).toBe(0);
  });

  test('origin hex maps to pixel origin', () => {
    expect(axialToPixel({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });
});
