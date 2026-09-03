import { describe, expect, test } from '@jest/globals';
import { resolveTileByInstanceId } from '../../../src/shared/gameplay/resolveTileByInstanceId.js';

function cityWithTiles(size, stamped) {
  const tiles = Array.from({ length: size }, () => Array.from({ length: size }, () => ({})));
  for (const { x, y, instanceId } of stamped) {
    tiles[x][y] = { instanceId };
  }
  return { size, tiles };
}

describe('resolveTileByInstanceId', () => {
  test('finds the tile holding the given instance id', () => {
    const city = cityWithTiles(4, [{ x: 2, y: 3, instanceId: 'house-1' }]);
    expect(resolveTileByInstanceId(city, 'house-1')).toEqual({ x: 2, y: 3 });
  });

  test('returns null when no tile has that instance id', () => {
    const city = cityWithTiles(4, [{ x: 2, y: 3, instanceId: 'house-1' }]);
    expect(resolveTileByInstanceId(city, 'house-2')).toBeNull();
  });

  test('returns null for a missing instanceId or city', () => {
    const city = cityWithTiles(2, []);
    expect(resolveTileByInstanceId(city, undefined)).toBeNull();
    expect(resolveTileByInstanceId(null, 'house-1')).toBeNull();
  });
});
