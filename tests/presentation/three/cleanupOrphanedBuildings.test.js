import {
  findOrphanedBuildingIds,
} from '../../../src/presentation/three/sync/cleanupOrphanedBuildings.js';

function makeCity(size = 2) {
  const tiles = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ buildingId: undefined, instanceId: undefined }))
  );
  return { size, tiles };
}

describe('findOrphanedBuildingIds', () => {
  test('keeps rows whose tile still claims the instanceId', () => {
    const city = makeCity();
    city.tiles[0][0] = { buildingId: 'House-Blue', instanceId: 'uuid-1' };
    const buildings = [
      [{ userData: { type: 'House-Blue', instanceId: 'uuid-1' } }, undefined],
      [undefined, undefined],
    ];
    const orphans = findOrphanedBuildingIds(
      [{ instanceId: 'uuid-1', type: 'House-Blue', x: 0, y: 0 }],
      { city, buildings }
    );
    expect(orphans).toEqual([]);
  });

  test('flags rows missing from tiles and mismatched mesh', () => {
    const city = makeCity();
    const buildings = [
      [undefined, undefined],
      [undefined, undefined],
    ];
    const orphans = findOrphanedBuildingIds(
      [{ instanceId: 'uuid-ghost', type: 'House-Blue', x: 0, y: 0 }],
      { city, buildings }
    );
    expect(orphans).toEqual(['uuid-ghost']);
  });

  test('flags out-of-bounds coordinates', () => {
    const city = makeCity();
    const orphans = findOrphanedBuildingIds(
      [{ instanceId: 'uuid-oob', type: 'House-Blue', x: 99, y: 99 }],
      { city, buildings: [] }
    );
    expect(orphans).toEqual(['uuid-oob']);
  });
});
