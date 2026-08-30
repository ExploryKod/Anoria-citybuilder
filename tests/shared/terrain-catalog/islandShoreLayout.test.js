import { describe, expect, test } from '@jest/globals';
import {
  classifyShoreCell,
  isOrganicIslandLand,
  isOrganicShoreline,
} from '../../../src/shared/terrain-catalog/islandOrganicMask.js';
import {
  buildIslandShoreLayout,
  getShoreRingIndex,
} from '../../../src/shared/terrain-catalog/islandShoreLayout.js';

describe('islandOrganicMask', () => {
  test('playable grid is always land', () => {
    expect(isOrganicIslandLand(0, 0, 8)).toBe(true);
    expect(isOrganicIslandLand(7, 7, 8)).toBe(true);
  });

  test('coastline is not a perfect square ring', () => {
    const citySize = 12;
    const options = { padding: 4, seed: 42 };
    let shorelineCount = 0;
    let missingCorner = false;

    for (let x = -4; x < citySize + 4; x += 1) {
      for (let y = -4; y < citySize + 4; y += 1) {
        if (isOrganicShoreline(x, y, citySize, options)) {
          shorelineCount += 1;
        }
        if (x === -4 && y === -4 && !isOrganicIslandLand(x, y, citySize, options)) {
          missingCorner = true;
        }
      }
    }

    expect(shorelineCount).toBeGreaterThan(40);
    expect(missingCorner).toBe(true);
  });
});

describe('buildIslandShoreLayout', () => {
  test('uses varied cliff and coast assets instead of one beach tile', () => {
    const tiles = buildIslandShoreLayout(12, { padding: 4, seed: 42 });
    const terrainIds = new Set(tiles.map((t) => t.terrainId));

    expect(terrainIds.has('nature:cliff_block_stone')).toBe(true);
    expect(tiles.some((t) => t.role === 'coast')).toBe(true);
    expect(tiles.some((t) => t.role === 'grass_ext')).toBe(true);
    expect(tiles.length).toBeGreaterThan(80);
  });

  test('shore tiles are decorative (non-pickable)', () => {
    const tiles = buildIslandShoreLayout(8, { padding: 4, seed: 42 });
    expect(tiles.every((t) => t.decorative)).toBe(true);
  });

  test('ring index still uses chebyshev distance from playable box', () => {
    expect(getShoreRingIndex(-1, -1, 16)).toBe(1);
    expect(getShoreRingIndex(-2, 5, 16)).toBe(2);
    expect(getShoreRingIndex(1, 1, 16)).toBe(0);
  });

  test('classifies cliff rim adjacent to playable grid', () => {
    expect(classifyShoreCell(-1, 5, 12, { padding: 4, seed: 42 })).toBe('cliff');
  });
});
