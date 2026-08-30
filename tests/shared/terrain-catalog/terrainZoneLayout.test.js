import { describe, expect, test } from '@jest/globals';
import {
  getTerrainZoneCounts,
  resolveTerrainZoneIndex,
} from '../../../src/shared/terrain-catalog/terrainZoneLayout.js';

describe('terrainZoneLayout', () => {
  test('adds padding zones around the playable grid', () => {
    const { numZonesX, numZonesY } = getTerrainZoneCounts(16, 4, 1);
    expect(numZonesX).toBe(6);
    expect(numZonesY).toBe(6);
  });

  test('resolves negative beach coordinates into padded zones', () => {
    expect(resolveTerrainZoneIndex(-1, 8, 16, 4, 1)).toBe(3);
    expect(resolveTerrainZoneIndex(16, -1, 16, 4, 1)).toBe(30);
    expect(resolveTerrainZoneIndex(0, 0, 16, 4, 1)).toBe(7);
  });
});
