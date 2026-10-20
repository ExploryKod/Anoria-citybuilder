import { describe, test, expect } from '@jest/globals';
import { canPlaceBuildingAtTileWithSupplyRules } from '../../src/composition/canPlaceBuildingAtTileWithSupplyRules.js';

// The mayor's house is the city's first building: every other house waits for it, and a hamlet holds only one.
const SIZE = 8;
const assetCatalog = { 'House-Mayor': { gridSize: 2 }, 'House-Red': { gridSize: 2 } };

function cityWith(...placed) {
  const tiles = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({})));
  placed.forEach(({ type, x, y }, index) => {
    for (let dx = 0; dx < 2; dx += 1) {
      for (let dy = 0; dy < 2; dy += 1) tiles[x + dx][y + dy] = { buildingId: type, instanceId: `i${index}` };
    }
  });
  return { size: SIZE, tiles };
}

const canPlace = (city, buildingType, x = 5, y = 5) => canPlaceBuildingAtTileWithSupplyRules({ city, x, y, buildingType, assetCatalog });

describe('the mayor\'s house comes first', () => {
  test('another house is refused until the mayor\'s house stands, then allowed', () => {
    expect(canPlace(cityWith(), 'House-Red')).toMatchObject({ ok: false, reason: 'building_missing' });
    expect(canPlace(cityWith({ type: 'House-Mayor', x: 0, y: 0 }), 'House-Red').ok).toBe(true);
  });

  test('the mayor\'s house itself needs nothing, and a hamlet holds one only', () => {
    expect(canPlace(cityWith(), 'House-Mayor').ok).toBe(true);
    expect(canPlace(cityWith({ type: 'House-Mayor', x: 0, y: 0 }), 'House-Mayor')).toMatchObject({ ok: false, reason: 'building_limit' });
  });
});
