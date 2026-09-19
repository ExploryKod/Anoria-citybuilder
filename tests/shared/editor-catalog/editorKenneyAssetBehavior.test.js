import { describe, expect, test } from '@jest/globals';
import {
  canMountAssetOnVerticalFace,
  cliffAssetExposesVerticalFaces,
  isEditorRiverAsset,
  resolveRiverMountFromRotationStep,
} from '../../../src/shared/editor-catalog/editorKenneyAssetBehavior.js';
import { resolveEditorStackPlacement, buildVerticalRiverGhostPreview } from '../../../src/shared/editor-catalog/editorStackPlacement.js';

describe('editorKenneyAssetBehavior', () => {
  test('river assets support vertical face mount', () => {
    expect(isEditorRiverAsset('nature:ground_riverStraight')).toBe(true);
    expect(isEditorRiverAsset('nature:cliff_rock')).toBe(false);
  });

  test('full and half cliffs expose vertical faces, not quarter', () => {
    expect(cliffAssetExposesVerticalFaces('nature:cliff_block_rock')).toBe(true);
    expect(cliffAssetExposesVerticalFaces('nature:cliff_half_rock')).toBe(true);
    expect(cliffAssetExposesVerticalFaces('nature:cliff_blockQuarter_rock')).toBe(false);
  });

  test('river rotation steps 0-3 are surface, 4-7 are vertical faces', () => {
    expect(resolveRiverMountFromRotationStep(2).mountMode).toBe('surface');
    expect(resolveRiverMountFromRotationStep(5).mountMode).toBe('verticalFace');
    expect(resolveRiverMountFromRotationStep(5).faceDirection).toBe('east');
  });

  test('canMountAssetOnVerticalFace allows river on large cliff only', () => {
    expect(canMountAssetOnVerticalFace('nature:ground_riverTile', 'nature:cliff_rock')).toBe(true);
    expect(canMountAssetOnVerticalFace('nature:ground_riverTile', 'nature:cliff_blockQuarter_rock')).toBe(false);
    expect(canMountAssetOnVerticalFace('nature-prop:tree_simple', 'nature:cliff_rock')).toBe(false);
  });
});

describe('editorStackPlacement vertical face', () => {
  test('grafts river on cliff stack at same tile', () => {
    const stackObjects = [
      {
        id: 'stack-1',
        assetId: 'nature:cliff_block_rock',
        x: 4,
        y: 4,
        rotationY: 0,
        baseLocalY: 0,
        parentId: null,
        anchor: 'terrain',
        mountMode: 'surface',
        faceDirection: null,
        hostAssetId: null,
      },
    ];

    const placement = resolveEditorStackPlacement(
      { kind: 'stack', stackId: 'stack-1', x: 4, y: 4, categoryId: 'editorCliffRock' },
      'nature:ground_riverStraight',
      stackObjects,
      { mountMode: 'verticalFace', faceDirection: 'north', citySize: 16 }
    );

    expect(placement.ok).toBe(true);
    if (!placement.ok) return;
    expect(placement.mountMode).toBe('verticalFace');
    expect(placement.parentId).toBe('stack-1');
    expect(placement.x).toBe(4);
    expect(placement.y).toBe(5);
    expect(placement.hostX).toBe(4);
    expect(placement.hostY).toBe(4);
    expect(placement.hostAssetId).toBe('nature:cliff_block_rock');
    expect(placement.placedAssetId).toBe('nature:cliff_waterfall_rock');
  });

  test('grafts river when clicking the neighbor tile north of the cliff', () => {
    const stackObjects = [
      {
        id: 'stack-1',
        assetId: 'nature:cliff_block_rock',
        x: 4,
        y: 4,
        rotationY: 0,
        baseLocalY: 0,
        parentId: null,
        anchor: 'terrain',
        mountMode: 'surface',
        faceDirection: null,
        hostAssetId: null,
      },
    ];

    const placement = resolveEditorStackPlacement(
      { kind: 'terrain', x: 4, y: 5, categoryId: 'editorGround', terrainId: 'grass' },
      'nature:ground_riverStraight',
      stackObjects,
      { rotationStep: 4, citySize: 16, getTerrainIdAt: () => 'grass' }
    );

    expect(placement.ok).toBe(true);
    if (!placement.ok) return;
    expect(placement.x).toBe(4);
    expect(placement.y).toBe(5);
    expect(placement.placedAssetId).toBe('nature:cliff_waterfall_rock');
  });

  test('grafts river on terrain cliff tile without stack', () => {
    const placement = resolveEditorStackPlacement(
      {
        kind: 'terrain',
        x: 2,
        y: 3,
        categoryId: 'editorCliffRock',
        terrainId: 'nature:cliff_rock',
      },
      'nature:ground_riverStraight',
      [],
      { rotationStep: 5, citySize: 16 }
    );

    expect(placement.ok).toBe(true);
    if (!placement.ok) return;
    expect(placement.mountMode).toBe('verticalFace');
    expect(placement.faceDirection).toBe('east');
    expect(placement.hostAssetId).toBe('nature:cliff_rock');
    expect(placement.anchor).toBe('terrain');
    expect(placement.x).toBe(3);
    expect(placement.y).toBe(3);
    expect(placement.placedAssetId).toBe('nature:cliff_waterfall_rock');
  });

  test('ghost preview still targets neighbor tile when placement was out of bounds', () => {
    const stackObjects = [
      {
        id: 'stack-1',
        assetId: 'nature:cliff_block_rock',
        x: 4,
        y: 4,
        rotationY: 0,
        baseLocalY: 0,
        parentId: null,
        anchor: 'terrain',
        mountMode: 'surface',
        faceDirection: null,
        hostAssetId: null,
      },
    ];

    const preview = buildVerticalRiverGhostPreview(
      4,
      4,
      'grass',
      stackObjects,
      'north',
      16,
      () => 'grass',
      { ok: false, reason: 'out_of_bounds' }
    );

    expect(preview.mountMode).toBe('verticalFace');
    expect(preview.x).toBe(4);
    expect(preview.y).toBe(5);
    expect(preview.hostAssetId).toBe('nature:cliff_block_rock');
  });
});
