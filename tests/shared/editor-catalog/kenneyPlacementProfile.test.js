import { describe, expect, test } from '@jest/globals';
import {
  getColumnTopLocalY,
  getKenneyStackTopLocalY,
  getTerrainTopLocalY,
  propGroupWorldY,
} from '../../../src/shared/editor-catalog/kenneyPlacementProfile.js';

describe('kenneyPlacementProfile', () => {
  test('terrain top uses catalog surfaceY plus baked bbox maxY', () => {
    const top = getTerrainTopLocalY('nature:ground_grass');
    expect(top).toBeCloseTo(-0.03, 2);
  });

  test('stacked props accumulate column height', () => {
    const stackObjects = [
      {
        id: 'nature-1',
        assetId: 'nature-prop:rock_smallA',
        x: 2,
        y: 3,
        rotationY: 0,
        baseLocalY: -0.03,
        parentId: null,
        anchor: 'terrain',
      },
    ];
    const nextBase = getColumnTopLocalY(stackObjects, 2, 3, 'nature:ground_grass');
    expect(nextBase).toBeGreaterThan(-0.03);

    const top = getColumnTopLocalY(stackObjects, 2, 3, 'nature:ground_grass');
    expect(top).toBe(nextBase);
  });

  test('flat terrain tiles still step up when stacked', () => {
    const firstTop = getKenneyStackTopLocalY('nature:ground_grass', -0.03);
    const secondBase = getKenneyStackTopLocalY('nature:ground_pathStraight', firstTop);
    expect(secondBase).toBeGreaterThan(firstTop);
  });

  test('propGroupWorldY offsets mesh origin so feet sit on surface', () => {
    const y = propGroupWorldY('nature-prop:tree_simple', 0.5);
    expect(y).toBeGreaterThan(0.5);
  });
});
