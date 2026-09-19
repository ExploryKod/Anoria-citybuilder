import { describe, expect, test } from '@jest/globals';
import {
  classifyCliffCategoryId,
  compareCliffCarouselGlbs,
  isCliffHalfFootprint,
  isCliffQuarterFootprint,
  KENNEY_CLIFF_CATEGORY_IDS,
} from '../../../src/shared/editor-catalog/classifyKenneyCliff.js';
import { classifyKenneyGlbName } from '../../../src/shared/editor-catalog/classifyKenneyNatureAsset.js';
import { EDITOR_TOOLS_BY_CATEGORY } from '../../../src/shared/editor-catalog/editorKenneyCatalog.js';

describe('classifyKenneyCliff', () => {
  test('routes cliff assets into quarter, half, and full carousels by material', () => {
    expect(classifyCliffCategoryId('cliff_blockQuarter_rock')).toBe('editorCliffQuarterRock');
    expect(classifyCliffCategoryId('cliff_blockQuarter_stone')).toBe('editorCliffQuarterStone');

    expect(classifyCliffCategoryId('cliff_half_rock')).toBe('editorCliffHalfRock');
    expect(classifyCliffCategoryId('cliff_halfCorner_stone')).toBe('editorCliffHalfStone');
    expect(classifyCliffCategoryId('cliff_blockHalf_rock')).toBe('editorCliffHalfRock');
    expect(classifyCliffCategoryId('cliff_blockSlopeHalfWalls_stone')).toBe('editorCliffHalfStone');

    expect(classifyCliffCategoryId('cliff_rock')).toBe('editorCliffRock');
    expect(classifyCliffCategoryId('cliff_block_stone')).toBe('editorCliffStone');
    expect(classifyCliffCategoryId('cliff_cornerInnerLarge_rock')).toBe('editorCliffRock');
  });

  test('detects quarter and half footprints', () => {
    expect(isCliffQuarterFootprint('cliff_blockQuarter_rock')).toBe(true);
    expect(isCliffHalfFootprint('cliff_blockQuarter_rock')).toBe(false);
    expect(isCliffHalfFootprint('cliff_half_rock')).toBe(true);
    expect(isCliffHalfFootprint('cliff_blockHalf_stone')).toBe(true);
    expect(isCliffHalfFootprint('cliff_block_stone')).toBe(false);
  });

  test('orders shape families within single-material cliff carousels', () => {
    expect(compareCliffCarouselGlbs('cliff_rock', 'cliff_block_rock')).toBeLessThan(0);
    expect(compareCliffCarouselGlbs('cliff_block_rock', 'cliff_corner_rock')).toBeLessThan(0);
    expect(compareCliffCarouselGlbs('cliff_corner_rock', 'cliff_steps_rock')).toBeLessThan(0);
  });
});

describe('cliff editor carousels', () => {
  test('expose six cliff pill groups (size × material) with sorted tools', () => {
    const byCategory = Object.fromEntries(
      KENNEY_CLIFF_CATEGORY_IDS.map((id) => [id, EDITOR_TOOLS_BY_CATEGORY[id]])
    );

    expect(byCategory.editorCliffQuarterRock).toEqual(['nature:cliff_blockQuarter_rock']);
    expect(byCategory.editorCliffQuarterStone).toEqual(['nature:cliff_blockQuarter_stone']);
    expect(byCategory.editorCliffHalfRock.length).toBe(5);
    expect(byCategory.editorCliffHalfStone.length).toBe(5);
    expect(byCategory.editorCliffRock.length).toBe(22);
    expect(byCategory.editorCliffStone.length).toBe(22);

    const total = KENNEY_CLIFF_CATEGORY_IDS.reduce(
      (sum, id) => sum + EDITOR_TOOLS_BY_CATEGORY[id].length,
      0
    );
    expect(total).toBe(56);

    for (const categoryId of KENNEY_CLIFF_CATEGORY_IDS) {
      for (const toolId of EDITOR_TOOLS_BY_CATEGORY[categoryId]) {
        expect(classifyKenneyGlbName(toolId.replace('nature:', '')).categoryId).toBe(categoryId);
      }
    }

    expect(byCategory.editorCliffRock[0]).toBe('nature:cliff_rock');
    expect(byCategory.editorCliffStone[0]).toBe('nature:cliff_stone');
  });
});
