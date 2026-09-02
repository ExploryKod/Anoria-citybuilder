import { describe, expect, test } from '@jest/globals';
import {
  classifyRockStoneCategoryId,
  compareRockStoneCarouselGlbs,
  KENNEY_ROCK_STONE_CATEGORY_IDS,
} from '../../../src/shared/editor-catalog/classifyKenneyRockStone.js';
import { classifyKenneyGlbName } from '../../../src/shared/editor-catalog/classifyKenneyNatureAsset.js';
import { EDITOR_TOOLS_BY_CATEGORY } from '../../../src/shared/editor-catalog/editorKenneyCatalog.js';

describe('classifyKenneyRockStone', () => {
  test('routes rock and stone props into size × material carousels', () => {
    expect(classifyRockStoneCategoryId('rock_smallA')).toBe('editorRockSmall');
    expect(classifyRockStoneCategoryId('rock_smallFlatB')).toBe('editorRockSmall');
    expect(classifyRockStoneCategoryId('rock_largeC')).toBe('editorRockLarge');
    expect(classifyRockStoneCategoryId('rock_tallD')).toBe('editorRockTall');

    expect(classifyRockStoneCategoryId('stone_smallA')).toBe('editorStoneSmall');
    expect(classifyRockStoneCategoryId('stone_smallTopB')).toBe('editorStoneSmall');
    expect(classifyRockStoneCategoryId('stone_largeC')).toBe('editorStoneLarge');
    expect(classifyRockStoneCategoryId('stone_tallD')).toBe('editorStoneTall');

    expect(classifyRockStoneCategoryId('stump_round')).toBe('editorStumps');
  });

  test('orders shape variants within a size carousel', () => {
    expect(compareRockStoneCarouselGlbs('rock_smallA', 'rock_smallFlatA')).toBeLessThan(0);
    expect(compareRockStoneCarouselGlbs('rock_smallFlatA', 'rock_smallTopA')).toBeLessThan(0);
    expect(compareRockStoneCarouselGlbs('rock_smallTopA', 'rock_smallTopB')).toBeLessThan(0);
  });
});

describe('rock/stone editor carousels', () => {
  test('expose seven nature pill groups with sorted tools', () => {
    const byCategory = Object.fromEntries(
      KENNEY_ROCK_STONE_CATEGORY_IDS.map((id) => [id, EDITOR_TOOLS_BY_CATEGORY[id]])
    );

    expect(byCategory.editorRockSmall.length).toBe(14);
    expect(byCategory.editorRockLarge.length).toBe(6);
    expect(byCategory.editorRockTall.length).toBe(10);
    expect(byCategory.editorStoneSmall.length).toBe(14);
    expect(byCategory.editorStoneLarge.length).toBe(6);
    expect(byCategory.editorStoneTall.length).toBe(10);
    expect(byCategory.editorStumps.length).toBe(7);

    const total = KENNEY_ROCK_STONE_CATEGORY_IDS.reduce(
      (sum, id) => sum + EDITOR_TOOLS_BY_CATEGORY[id].length,
      0
    );
    expect(total).toBe(67);

    for (const categoryId of KENNEY_ROCK_STONE_CATEGORY_IDS) {
      for (const toolId of EDITOR_TOOLS_BY_CATEGORY[categoryId]) {
        expect(classifyKenneyGlbName(toolId.replace('nature-prop:', '')).categoryId).toBe(
          categoryId
        );
      }
    }

    expect(byCategory.editorRockSmall[0]).toBe('nature-prop:rock_smallA');
    expect(byCategory.editorRockSmall.indexOf('nature-prop:rock_smallFlatA')).toBeGreaterThan(
      byCategory.editorRockSmall.indexOf('nature-prop:rock_smallF')
    );
    expect(byCategory.editorStoneLarge[0]).toBe('nature-prop:stone_largeA');
  });
});
