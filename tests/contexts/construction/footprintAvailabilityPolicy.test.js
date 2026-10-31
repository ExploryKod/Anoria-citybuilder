import {
  canPlaceBuildingAtTile,
  clearBuildingFootprint,
  findFootprintAnchor,
  groundRefusal,
  isAreaAvailableForBuilding,
  isRoadBuildingType,
  resolveFootprintDimensions,
  resolveGridSize,
  stampBuildingFootprint,
} from '../../../src/contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';

function makeCity(size = 3) {
  const tiles = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ buildingId: undefined, instanceId: undefined }))
  );
  return { size, tiles };
}

describe('FootprintAvailabilityPolicy', () => {
  test('isRoadBuildingType recognizes roads and StonePath', () => {
    expect(isRoadBuildingType('roads')).toBe(true);
    expect(isRoadBuildingType('StonePath-001')).toBe(true);
    expect(isRoadBuildingType('House-Blue')).toBe(false);
  });

  test('isAreaAvailableForBuilding rejects occupied or OOB footprints', () => {
    const city = makeCity(2);
    city.tiles[0][0].buildingId = 'House-Blue';
    expect(isAreaAvailableForBuilding(city, 0, 0, 1)).toBe(false);
    expect(isAreaAvailableForBuilding(city, 1, 1, 1)).toBe(true);
    expect(isAreaAvailableForBuilding(city, 1, 1, 2)).toBe(false);
  });

  test('the relief of the map: flat ground of one level only takes a building', () => {
    const city = makeCity(3);
    // A plateau (flat, level 0.5) of two tiles, a lower flat tile, a tile with no relief (plain grass), and a cliff face
    city.tiles[0][0].relief = { elevation: 0.5, flat: true };
    city.tiles[1][0].relief = { elevation: 0.5, flat: true };
    city.tiles[2][0].relief = { elevation: 0, flat: true };
    city.tiles[0][1].relief = { elevation: 0.5, flat: false };

    expect(groundRefusal(city, 0, 0, 2, 1)).toBeNull();
    // Two levels side by side: refused, whichever the way round
    expect(groundRefusal(city, 1, 0, 2, 1)).toBe('ground_not_level');
    // A cliff face takes no building
    expect(groundRefusal(city, 0, 1, 1, 1)).toBe('ground_not_flat');
    // Plain grass has no relief: flat, level 0
    expect(groundRefusal(city, 1, 2, 1, 1)).toBeNull();
    expect(groundRefusal(city, 0, 0, 1, 3)).toBe('ground_not_flat');
    // A slope takes a road, never a building
    city.tiles[1][2].relief = { elevation: 1, flat: false, obstacle: false, slope: { dx: 0, dy: 1, rise: 1 } };
    expect(groundRefusal(city, 1, 2, 1, 1)).toBe('ground_not_flat');
    expect(groundRefusal(city, 1, 2, 1, 1, { allowSlope: true })).toBeNull();
    // A tree in the footprint is in the way
    city.tiles[2][2].relief = { elevation: 0, flat: true, obstacle: true };
    expect(groundRefusal(city, 2, 2, 1, 1)).toBe('ground_obstructed');

    const assetCatalog = { 'House-Red': { gridSize: 2 } };
    const refused = canPlaceBuildingAtTile({ city, x: 1, y: 0, buildingType: 'House-Red', assetCatalog });
    expect(refused).toMatchObject({ ok: false, reason: 'ground_not_level' });
  });

  test('clear and stamp square footprint', () => {
    const city = makeCity(2);
    stampBuildingFootprint(city, 0, 0, 2, 'Church-002', 'uuid-1');
    expect(city.tiles[0][0].buildingId).toBe('Church-002');
    expect(city.tiles[1][1].instanceId).toBe('uuid-1');
    clearBuildingFootprint(city, 0, 0, 2);
    expect(city.tiles[0][0].buildingId).toBeUndefined();
    expect(city.tiles[1][1].instanceId).toBeUndefined();
  });

  test('stamp rectangular footprint (1×2)', () => {
    const city = makeCity(3);
    stampBuildingFootprint(city, 1, 1, 1, 'Kenney-Commercial-building-c', 'rect-1', {
      footprintHeight: 2,
    });
    expect(city.tiles[1][1].buildingId).toBe('Kenney-Commercial-building-c');
    expect(city.tiles[1][2].buildingId).toBe('Kenney-Commercial-building-c');
    expect(city.tiles[2][1].buildingId).toBeUndefined();
  });

  test('resolveGridSize falls back to 1', () => {
    expect(resolveGridSize({ 'Church-002': { gridSize: 3 } }, 'Church-002')).toBe(3);
    expect(resolveGridSize({ 'Barn-001': { gridSize: 2 } }, 'Barn-001')).toBe(2);
    expect(resolveGridSize({}, 'House-Blue')).toBe(1);
  });

  test('resolveFootprintDimensions swaps on rotation', () => {
    const catalog = {
      'Kenney-Commercial-building-c': {
        gridSize: 2,
        footprintWidth: 1,
        footprintDepth: 2,
      },
    };
    expect(resolveFootprintDimensions(catalog, 'Kenney-Commercial-building-c', 0)).toEqual({
      width: 1,
      height: 2,
      gridSize: 2,
    });
    expect(resolveFootprintDimensions(catalog, 'Kenney-Commercial-building-c', 1)).toEqual({
      width: 2,
      height: 1,
      gridSize: 2,
    });
  });

  test('findFootprintAnchor returns min tile of the instance footprint', () => {
    const city = makeCity(3);
    stampBuildingFootprint(city, 1, 1, 2, 'Barn-001', 'barn-uuid');
    expect(findFootprintAnchor(city, 2, 2, 'barn-uuid')).toEqual({ x: 1, y: 1 });
    expect(findFootprintAnchor(city, 1, 2, 'barn-uuid')).toEqual({ x: 1, y: 1 });
    expect(findFootprintAnchor(city, 0, 0, null)).toEqual({ x: 0, y: 0 });
  });
});
