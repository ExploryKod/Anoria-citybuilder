import { describe, test, expect } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

const ROAD_AND_POPULATION_TIER2 = {
  requirements: [{ kind: 'roadAccess' }, { kind: 'population', min: 1 }],
};

describe('SOCIAL_CATEGORY — single source for the 3 social categories', () => {
  test('declares exactly artisans, merchants, scholars', () => {
    expect(Object.keys(SOCIAL_CATEGORY).sort()).toEqual(['artisans', 'merchants', 'scholars']);
  });

  test('each category declares eligible sectors and a tier ladder with skills', () => {
    expect(SOCIAL_CATEGORY.artisans).toEqual({
      eligibleSectors: [1, 3, 4],
      tiers: {
        1: { requirements: [], skills: ['subsistence-forager'] },
        2: { ...ROAD_AND_POPULATION_TIER2, skills: ['fermier'] },
      },
    });
    expect(SOCIAL_CATEGORY.merchants).toEqual({
      eligibleSectors: [2],
      tiers: {
        1: { requirements: [], skills: ['subsistence-forager'] },
        2: { ...ROAD_AND_POPULATION_TIER2, skills: ['vente-alimentaire'] },
      },
    });
    expect(SOCIAL_CATEGORY.scholars).toEqual({
      eligibleSectors: [6],
      tiers: {
        1: { requirements: [], skills: ['subsistence-forager'] },
        2: { ...ROAD_AND_POPULATION_TIER2, skills: ['stockage-alimentaire'] },
      },
    });
  });

  test('tier 1 never requires anything — it is the starting tier', () => {
    for (const facts of Object.values(SOCIAL_CATEGORY)) {
      expect(facts.tiers[1].requirements).toEqual([]);
    }
  });
});
