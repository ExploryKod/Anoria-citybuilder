import { describe, expect, test } from '@jest/globals';
import {
  classifyKenneyGlbName,
  humanizeKenneyGlbName,
  kenneyGlbToToolId,
  KENNEY_EDITOR_CATEGORY_DEFS,
  KENNEY_EDITOR_NATURE_CATEGORY_DEFS,
  KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS,
} from '../../../src/shared/editor-catalog/classifyKenneyNatureAsset.js';
import {
  EDITOR_NATURE_TOOL_IDS,
  EDITOR_TERRAIN_TOOL_IDS,
  EDITOR_TOOL_META,
  EDITOR_TOOLS_BY_CATEGORY,
} from '../../../src/shared/editor-catalog/editorKenneyCatalog.js';
import {
  KENNEY_NATURE_ASSETS,
  KENNEY_NATURE_KIT_GLB_COUNT,
  KENNEY_NATURE_PROP_COUNT,
  KENNEY_NATURE_TERRAIN_COUNT,
} from '../../../src/shared/editor-catalog/kenneyNatureKitManifest.generated.js';
import { NATURE_PROP_CATALOG } from '../../../src/shared/editor-catalog/naturePropCatalog.js';
import { TERRAIN_CATALOG } from '../../../src/shared/terrain-catalog/terrainCatalog.js';

describe('classifyKenneyNatureAsset', () => {
  test('maps filename prefixes to categories and layers', () => {
    expect(classifyKenneyGlbName('ground_grass')).toEqual({
      categoryId: 'editorGround',
      layer: 'terrain',
    });
    expect(classifyKenneyGlbName('ground_pathStraight')).toEqual({
      categoryId: 'editorPath',
      layer: 'terrain',
    });
    expect(classifyKenneyGlbName('ground_riverStraight')).toEqual({
      categoryId: 'editorRiver',
      layer: 'terrain',
    });
    expect(classifyKenneyGlbName('platform_beach')).toEqual({
      categoryId: 'editorPlatform',
      layer: 'terrain',
    });
    expect(classifyKenneyGlbName('cliff_block_stone')).toEqual({
      categoryId: 'editorCliff',
      layer: 'terrain',
    });
    expect(classifyKenneyGlbName('tree_simple')).toEqual({
      categoryId: 'editorTrees',
      layer: 'prop',
    });
    expect(classifyKenneyGlbName('bridge_wood')).toEqual({
      categoryId: 'editorStructures',
      layer: 'prop',
    });
  });

  test('builds tool ids from layer', () => {
    expect(kenneyGlbToToolId('terrain', 'ground_grass')).toBe('nature:ground_grass');
    expect(kenneyGlbToToolId('prop', 'tree_simple')).toBe('nature-prop:tree_simple');
  });

  test('humanizes glb names for labels', () => {
    expect(humanizeKenneyGlbName('tree_pineDefaultA')).toBe('Tree Pine Default A');
  });
});

describe('kenneyNatureKitManifest', () => {
  test('indexes every glb in the pack', () => {
    expect(KENNEY_NATURE_KIT_GLB_COUNT).toBe(329);
    expect(KENNEY_NATURE_ASSETS).toHaveLength(329);
    expect(KENNEY_NATURE_TERRAIN_COUNT + KENNEY_NATURE_PROP_COUNT).toBe(329);
  });

  test('exposes all assets in editor catalogs', () => {
    expect(EDITOR_TERRAIN_TOOL_IDS).toHaveLength(KENNEY_NATURE_TERRAIN_COUNT);
    expect(EDITOR_NATURE_TOOL_IDS).toHaveLength(KENNEY_NATURE_PROP_COUNT);
    expect(Object.keys(EDITOR_TOOL_META)).toHaveLength(329);
    expect(Object.keys(NATURE_PROP_CATALOG)).toHaveLength(KENNEY_NATURE_PROP_COUNT);
    expect(Object.keys(TERRAIN_CATALOG).length).toBeGreaterThanOrEqual(KENNEY_NATURE_TERRAIN_COUNT);
  });

  test('organizes tools into emoji category carousels', () => {
    expect(KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS).toHaveLength(5);
    expect(KENNEY_EDITOR_NATURE_CATEGORY_DEFS).toHaveLength(5);

    for (const category of KENNEY_EDITOR_CATEGORY_DEFS) {
      const ids = EDITOR_TOOLS_BY_CATEGORY[category.id];
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(category.icon).toBeTruthy();
      expect(category.tooltip).toBeTruthy();
      for (const toolId of ids) {
        expect(EDITOR_TOOL_META[toolId]?.categoryId).toBe(category.id);
      }
    }

    const categorized = KENNEY_EDITOR_CATEGORY_DEFS.flatMap(
      (category) => EDITOR_TOOLS_BY_CATEGORY[category.id]
    );
    expect(categorized).toHaveLength(329);
  });
});
