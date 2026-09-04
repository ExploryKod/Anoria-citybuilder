import { describe, test, expect } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

describe('SOCIAL_CATEGORY — single source for the 3 social categories', () => {
  test('declares exactly artisans, merchants, scholars', () => {
    expect(Object.keys(SOCIAL_CATEGORY).sort()).toEqual(['artisans', 'merchants', 'scholars']);
  });

  test('each category declares eligible sectors and a skill per level', () => {
    expect(SOCIAL_CATEGORY.artisans).toEqual({
      eligibleSectors: [1, 3, 4],
      skillsByLevel: { 1: ['subsistence-forager'], 2: ['fermier'] },
    });
    expect(SOCIAL_CATEGORY.merchants).toEqual({
      eligibleSectors: [2],
      skillsByLevel: { 1: ['subsistence-forager'], 2: ['vente-alimentaire'] },
    });
    expect(SOCIAL_CATEGORY.scholars).toEqual({
      eligibleSectors: [6],
      skillsByLevel: { 1: ['subsistence-forager'], 2: ['stockage-alimentaire'] },
    });
  });
});
