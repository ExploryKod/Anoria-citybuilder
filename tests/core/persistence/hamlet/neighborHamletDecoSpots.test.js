import { describe, expect, test } from '@jest/globals';
import {
  NEIGHBOR_DECO_HAMLET_IDS,
  buildNeighborHamletDecoSpots,
  isNeighborDecoHamletId,
} from '../../../../src/core/persistence/hamlet/neighborHamletDecoSpots.js';
import { PROTO_HAMLETS } from '../../../../src/core/persistence/hamlet/hamletSession.js';

describe('neighborHamletDecoSpots', () => {
  test('defines one fixed spot per non-starting proto hamlet', () => {
    const expectedIds = PROTO_HAMLETS.filter((h) => h.id !== 'eraanurbs').map((h) => h.id);
    expect(NEIGHBOR_DECO_HAMLET_IDS).toEqual(expectedIds);
    expect(buildNeighborHamletDecoSpots(16)).toHaveLength(expectedIds.length);
  });

  test('spots stay outside the playable grid', () => {
    const citySize = 16;
    const spots = buildNeighborHamletDecoSpots(citySize);

    for (const spot of spots) {
      const coords = [
        ...spot.houses.map((o) => [spot.centerX + o.offsetX, spot.centerZ + o.offsetZ]),
        ...spot.trees.map((o) => [spot.centerX + o.offsetX, spot.centerZ + o.offsetZ]),
        [spot.centerX, spot.centerZ],
      ];

      for (const [x, z] of coords) {
        const outside = x < 0 || x > citySize || z < 0 || z > citySize;
        expect(outside).toBe(true);
      }
    }
  });

  test('isNeighborDecoHamletId excludes the starting hamlet', () => {
    expect(isNeighborDecoHamletId('eraanurbs')).toBe(false);
    expect(isNeighborDecoHamletId('clairiere')).toBe(true);
  });
});
