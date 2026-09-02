import { describe, expect, test } from '@jest/globals';
import { buildKenneyNatureKitSections, resolveKenneyNatureFilterGroup } from '../../../../src/presentation/pages/assets/kenneyNatureAssetsCatalog.js';
import { KENNEY_NATURE_KIT_GLB_COUNT, KENNEY_NATURE_ASSETS } from '../../../../src/shared/editor-catalog/kenneyNatureKitManifest.generated.js';
import { buildAssetsPageSections, countAssetsInSections } from '../../../../src/presentation/pages/assets/buildAssetsPageCatalog.js';
import { countAssetsByFilter } from '../../../../src/presentation/pages/assets/assetsPageFilters.js';

describe('kenneyNatureAssetsCatalog', () => {
  test('includes every nature kit GLB with an Isometric preview', () => {
    const sections = buildKenneyNatureKitSections();
    const items = sections.flatMap((section) => section.items);

    expect(items.length).toBe(KENNEY_NATURE_KIT_GLB_COUNT);
    expect(items.length).toBe(KENNEY_NATURE_ASSETS.length);

    for (const item of items) {
      expect(item.previewUrl).toMatch(/\/Isometric\/[^/]+_NE\.png$/);
      expect(item.kenneyGlbPath).toMatch(/\.glb$/);
    }
  });

  test('groups assets into editor sub-sections', () => {
    const sections = buildKenneyNatureKitSections();
    expect(sections.length).toBeGreaterThan(10);
    expect(sections.some((section) => section.sectionId === 'editorTrees')).toBe(true);
    expect(sections.some((section) => section.sectionId === 'editorGround')).toBe(true);
  });

  test('maps cliffs to terrains and props to nature or decoration', () => {
    expect(resolveKenneyNatureFilterGroup({
      categoryId: 'editorCliffRock',
      layer: 'terrain',
      glbName: 'cliff_block_rock',
    })).toBe('terrains');

    expect(resolveKenneyNatureFilterGroup({
      categoryId: 'editorTrees',
      layer: 'prop',
      glbName: 'tree_oak',
    })).toBe('nature');

    expect(resolveKenneyNatureFilterGroup({
      categoryId: 'editorDetails',
      layer: 'prop',
      glbName: 'pot_large',
    })).toBe('decoration');

    expect(resolveKenneyNatureFilterGroup({
      categoryId: 'editorStructures',
      layer: 'prop',
      glbName: 'tent_smallOpen',
    })).toBe('buildings');
  });
});

describe('buildAssetsPageCatalog', () => {
  test('merges nature kit with playable assets and filter counts', () => {
    const sections = buildAssetsPageSections();
    const total = countAssetsInSections(sections);
    const counts = countAssetsByFilter(sections);

    expect(total).toBeGreaterThan(KENNEY_NATURE_KIT_GLB_COUNT);
    expect(counts.all).toBe(total);
    expect(counts.terrains).toBeGreaterThan(0);
    expect(counts.nature).toBeGreaterThan(0);
    expect(counts.buildings).toBeGreaterThan(0);
    expect(counts.decoration).toBeGreaterThan(0);
    expect(counts.people).toBe(0);
  });
});
