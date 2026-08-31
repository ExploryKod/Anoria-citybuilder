import { describe, expect, test } from '@jest/globals';
import {
  getColumnTopLocalY,
  resolveEditorStackPlacement,
} from '../../../src/shared/editor-catalog/editorStackPlacement.js';

describe('editorStackPlacement', () => {
  test('stacked props accumulate column height', () => {
    const stackObjects = [
      {
        id: 'stack-1',
        assetId: 'nature-prop:rock_smallA',
        x: 2,
        y: 3,
        rotationY: 0,
        baseLocalY: -0.03,
        parentId: null,
        anchor: 'terrain',
      },
    ];
    const placement = resolveEditorStackPlacement(
      { kind: 'terrain', x: 2, y: 3, categoryId: 'editorGround', terrainId: 'nature:ground_grass' },
      'nature-prop:tree_simple',
      stackObjects
    );
    expect(placement.ok).toBe(true);
    expect(placement.baseLocalY).toBeGreaterThan(-0.03);

    const top = getColumnTopLocalY(stackObjects, 2, 3, 'nature:ground_grass');
    expect(top).toBe(placement.baseLocalY);
  });

  test('placing on a picked stack parent uses that object top', () => {
    const stackObjects = [
      {
        id: 'stack-1',
        assetId: 'nature:cliff_block_stone',
        x: 1,
        y: 1,
        rotationY: 0,
        baseLocalY: 0.2,
        parentId: null,
        anchor: 'terrain',
      },
      {
        id: 'stack-2',
        assetId: 'nature-prop:rock_smallA',
        x: 1,
        y: 1,
        rotationY: 0,
        baseLocalY: 1.5,
        parentId: 'stack-1',
        anchor: 'stack',
      },
    ];
    const placement = resolveEditorStackPlacement(
      { kind: 'stack', stackId: 'stack-1', x: 1, y: 1, categoryId: 'editorCliffRock' },
      'nature:platform_stone',
      stackObjects
    );
    expect(placement.ok).toBe(true);
    expect(placement.parentId).toBe('stack-1');
    expect(placement.baseLocalY).toBeLessThan(1.5);
  });
});
