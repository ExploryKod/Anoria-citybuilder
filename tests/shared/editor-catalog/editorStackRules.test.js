import { describe, expect, test } from '@jest/globals';
import {
  canPlaceEditorToolOnParent,
  canStackCategoryOnParent,
  getCategoryAcceptsOnTop,
} from '../../../src/shared/editor-catalog/editorStackRules.js';

describe('editorStackRules', () => {
  test('most terrain categories accept any stack on top', () => {
    expect(getCategoryAcceptsOnTop('editorGround')).toEqual(['*']);
    expect(getCategoryAcceptsOnTop('editorCliffRock')).toEqual(['*']);
    expect(canStackCategoryOnParent('editorGround', 'editorTrees')).toBe(true);
    expect(canStackCategoryOnParent('editorPlatform', 'editorCliffStone')).toBe(true);
  });

  test('trees only accept small props on top', () => {
    expect(canStackCategoryOnParent('editorTrees', 'editorPlants')).toBe(true);
    expect(canStackCategoryOnParent('editorTrees', 'editorDetails')).toBe(true);
    expect(canStackCategoryOnParent('editorTrees', 'editorGround')).toBe(false);
    expect(canStackCategoryOnParent('editorTrees', 'editorRockSmall')).toBe(false);
  });

  test('details reject stacking', () => {
    expect(canStackCategoryOnParent('editorDetails', 'editorPlants')).toBe(false);
    expect(canPlaceEditorToolOnParent('nature-prop:plant_bush', 'editorDetails')).toBe(false);
  });

  test('sea accepts everything', () => {
    expect(canPlaceEditorToolOnParent('nature:ground_grass', 'editorSea')).toBe(true);
    expect(canPlaceEditorToolOnParent('nature-prop:tree_simple', 'editorSea')).toBe(true);
  });
});
