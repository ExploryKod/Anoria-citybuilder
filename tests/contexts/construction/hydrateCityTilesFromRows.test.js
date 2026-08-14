import { hydrateCityTilesFromRows } from '../../../src/contexts/construction/application/services/HydrateCityTilesFromBuildings.js';

function makeCity(size = 4) {
  const tiles = Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) => ({
      x,
      y,
      terrainId: 'grass',
      buildingId: undefined,
      instanceId: undefined,
    }))
  );
  return { size, tiles };
}

describe('hydrateCityTilesFromRows', () => {
  test('clears previous tiles then stamps Dexie rows', () => {
    const city = makeCity();
    city.tiles[0][0].buildingId = 'stale';
    city.tiles[0][0].instanceId = 'old';

    hydrateCityTilesFromRows(
      city,
      [
        {
          instanceId: 'uuid-house',
          type: 'House-Blue',
          anchorX: 1,
          anchorY: 2,
          footprintWidth: 1,
        },
        {
          instanceId: 'uuid-path',
          type: 'StonePath-001',
          x: 0,
          y: 0,
        },
      ],
      { 'House-Blue': { gridSize: 1 } }
    );

    expect(city.tiles[0][0].buildingId).toBe('StonePath-001');
    expect(city.tiles[0][0].instanceId).toBe('uuid-path');
    expect(city.tiles[1][2].buildingId).toBe('House-Blue');
    expect(city.tiles[1][2].instanceId).toBe('uuid-house');
    expect(city.tiles[3][3].buildingId).toBeUndefined();
  });

  test('stamps multi-tile footprint from catalog gridSize', () => {
    const city = makeCity();
    hydrateCityTilesFromRows(
      city,
      [{ instanceId: 'uuid-farm', type: 'Farm-001', anchorX: 1, anchorY: 1 }],
      { 'Farm-001': { gridSize: 2 } }
    );

    expect(city.tiles[1][1].instanceId).toBe('uuid-farm');
    expect(city.tiles[2][2].instanceId).toBe('uuid-farm');
    expect(city.tiles[0][0].instanceId).toBeUndefined();
  });
});
