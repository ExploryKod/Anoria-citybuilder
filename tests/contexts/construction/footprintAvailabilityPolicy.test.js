import {
  clearBuildingFootprint,
  findFootprintAnchor,
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
