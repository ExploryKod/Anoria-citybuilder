import { describe, test, expect } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

describe('SOCIAL_CATEGORY — single source for the 3 social categories', () => {
  test('declares exactly artisans, merchants, scholars', () => {
    expect(Object.keys(SOCIAL_CATEGORY).sort()).toEqual(['artisans', 'merchants', 'scholars']);
  });

  test('each category has a profession skill and eligible sectors', () => {
    expect(SOCIAL_CATEGORY.artisans).toEqual({ skill: 'fermier', eligibleSectors: [1, 3, 4] });
    expect(SOCIAL_CATEGORY.merchants).toEqual({ skill: 'vente-alimentaire', eligibleSectors: [2] });
    expect(SOCIAL_CATEGORY.scholars).toEqual({ skill: 'stockage-alimentaire', eligibleSectors: [6] });
  });
});
