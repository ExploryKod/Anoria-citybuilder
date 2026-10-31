import { describe, expect, test } from '@jest/globals';
import {
  getColumnTopLocalY,
  getGroundElevation,
  getGroundSurface,
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

  test('a building stands on its ground: no lift on flat grass, lifted by a plateau, not by a tree', () => {
    const piece = (assetId, baseLocalY) => ({ id: assetId, assetId, x: 4, y: 4, rotationY: 0, baseLocalY, parentId: null, anchor: 'terrain' });

    expect(getGroundElevation([], 4, 4, 'grass')).toBe(0);
    expect(getGroundElevation([piece('nature-prop:tree_simple', 0)], 4, 4, 'grass')).toBe(0);
    expect(getGroundElevation([piece('nature:cliff_blockHalf_rock', 0)], 4, 4, 'grass')).toBeGreaterThan(0.3);
    // Another tile's plateau does not lift this one
    expect(getGroundElevation([piece('nature:cliff_blockHalf_rock', 0)], 5, 4, 'grass')).toBe(0);
  });

  test('only the pieces listed as flat take a building; the sea takes none', () => {
    const piece = (assetId) => ({ id: assetId, assetId, x: 1, y: 1, rotationY: 0, baseLocalY: 0, parentId: null, anchor: 'terrain' });
    const flatOn = (assetId) => getGroundSurface([piece(assetId)], 1, 1, 'grass').flat;

    expect(getGroundSurface([], 1, 1, 'grass').flat).toBe(true);
    expect(flatOn('nature:cliff_blockHalf_rock')).toBe(true);
    expect(flatOn('nature:path_stoneCircle')).toBe(true);
    // A cliff face (`cliff_half_rock`) is not in the list
    expect(flatOn('nature:cliff_half_rock')).toBe(false);
    expect(getGroundSurface([], 1, 1, 'editor:sea').flat).toBe(false);
  });

  test('a slope rises toward where its +z axis points once turned, and its middle is halfway up', () => {
    const slopePiece = (rotationY) => ({
      id: 's', assetId: 'nature:cliff_blockSlope_rock', x: 1, y: 1, rotationY, baseLocalY: 0, parentId: null, anchor: 'terrain',
    });
    const unturned = getGroundSurface([slopePiece(0)], 1, 1, 'grass');
    expect(unturned.flat).toBe(false);
    expect(unturned.slope).toMatchObject({ dx: 0, dy: 1 });
    expect(unturned.slope.rise).toBeCloseTo(1, 5);
    // A quarter turn moves the high side to the next side
    expect(getGroundSurface([slopePiece(Math.PI / 2)], 1, 1, 'grass').slope).toMatchObject({ dx: 1, dy: 0 });

    expect(getGroundElevation([slopePiece(0)], 1, 1, 'grass')).toBeCloseTo(unturned.elevation - 0.5, 5);

    // `cliff_half` covers only part of its tile: it is a cliff, not a slope, and takes neither a road nor a building
    const half = getGroundSurface([{ ...slopePiece(0), assetId: 'nature:cliff_half_rock' }], 1, 1, 'grass');
    expect(half.slope).toBeNull();
    expect(half.flat).toBe(false);
  });

  test('a tree, a rock or a bush is in the way of a building; a flower is not', () => {
    const piece = (assetId) => ({ id: assetId, assetId, x: 1, y: 1, rotationY: 0, baseLocalY: 0, parentId: null, anchor: 'terrain' });
    const obstacleOf = (assetId) => getGroundSurface([piece(assetId)], 1, 1, 'grass').obstacle;

    expect(getGroundSurface([], 1, 1, 'grass').obstacle).toBe(false);
    expect(obstacleOf('nature-prop:tree_blocks_fall')).toBe(true);
    expect(obstacleOf('nature-prop:rock_smallA')).toBe(true);
    expect(obstacleOf('nature-prop:plant_bush')).toBe(true);
    expect(obstacleOf('nature-prop:flower_purpleC')).toBe(false);
  });

  test('propGroupWorldY offsets mesh origin so feet sit on surface', () => {
    const y = propGroupWorldY('nature-prop:tree_simple', 0.5);
    expect(y).toBeGreaterThan(0.5);
  });
});
