import { describe, test, expect } from '@jest/globals';
import { computeBuildingReach, listPlacedBuildings } from '../../src/shared/building-catalog/buildingReach.js';

/** A city grid with the given placements: [instanceId, type, [[x, y], ...]]. */
function cityWith(placements, size = 30) {
  const tiles = Array.from({ length: size }, () => Array.from({ length: size }, () => ({})));
  for (const [instanceId, type, cells] of placements) {
    for (const [x, y] of cells) Object.assign(tiles[x][y], { buildingId: type, instanceId });
  }
  return { size, tiles };
}

describe('buildingReach — what a building reaches, from the catalog alone', () => {
  test('a raw-material producer reaches the natural resources inside its declared range, and only those', () => {
    const city = cityWith([
      ['lumber', 'Lumberjack', [[10, 10]]],
      ['near', 'Tree-Sapin', [[12, 10]]],
      ['far', 'Tree-Sapin', [[25, 25]]],
    ]);
    const { buildings, roadTiles } = listPlacedBuildings(city);
    const reach = computeBuildingReach(buildings.find((b) => b.instanceId === 'lumber'), buildings, roadTiles);
    expect(reach.buildings.map((b) => [b.instanceId, b.direction])).toEqual([['near', 'in']]);
  });

  test('roads are lit by distance from the footprint, not from the origin tile', () => {
    const city = cityWith([
      ['house', 'House-Blue', [[5, 5], [6, 5], [5, 6], [6, 6]]],
      ['road-a', 'StonePath-001', [[7, 6]]],
      ['road-b', 'StonePath-001', [[20, 20]]],
    ]);
    const { buildings, roadTiles } = listPlacedBuildings(city);
    const reach = computeBuildingReach(buildings.find((b) => b.instanceId === 'house'), buildings, roadTiles);
    // (7, 6) touches the far side of the 2×2 footprint; (20, 20) is out of any reach.
    expect(reach.roads).toEqual([{ x: 7, y: 6 }]);
  });

  test('an unlimited service range reaches every consumer of its category', () => {
    const city = cityWith([
      ['chapel', 'Chapel', [[2, 2], [3, 2], [2, 3], [3, 3]]],
      ['h1', 'House-Blue', [[20, 20]]],
      ['h2', 'House-Red', [[25, 3]]],
    ]);
    const { buildings, roadTiles } = listPlacedBuildings(city);
    const reach = computeBuildingReach(buildings.find((b) => b.instanceId === 'chapel'), buildings, roadTiles);
    expect(reach.buildings.map((b) => b.instanceId).sort()).toEqual(['h1', 'h2']);
    expect(reach.buildings.every((b) => b.direction === 'out')).toBe(true);
  });
});
