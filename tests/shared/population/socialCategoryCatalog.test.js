import { describe, test, expect } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

const CUMULATIVE_REQUIREMENTS = (min) => {
  const base = [
    { kind: 'roadAccess' },
    { kind: 'population', min },
    { kind: 'serviceCoverage', category: 'faith' },
  ];
  if (min < 4) return base;
  const withDoctor = [
    ...base,
    { kind: 'demandMet' },
    { kind: 'serviceCoverage', category: 'doctor' },
  ];
  if (min < 8) return withDoctor;
  const withBathAndPub = [
    ...withDoctor,
    { kind: 'serviceCoverage', category: 'publicBath' },
    { kind: 'serviceCoverage', category: 'pub' },
  ];
  if (min < 12) return withBathAndPub;
  return [
    ...withBathAndPub,
    { kind: 'serviceCoverage', category: 'school' },
    { kind: 'serviceCoverage', category: 'cinema' },
    { kind: 'goodsVariety', min: 2 },
  ];
};

describe('SOCIAL_CATEGORY — single source for the 3 social categories', () => {
  test('declares exactly artisans, merchants, scholars', () => {
    expect(Object.keys(SOCIAL_CATEGORY).sort()).toEqual(['artisans', 'merchants', 'scholars']);
  });

  test('each category declares eligible sectors and a 5-tier ladder with skills', () => {
    expect(SOCIAL_CATEGORY.artisans).toEqual({
      eligibleSectors: [1, 3, 4],
      tiers: {
        1: { requirements: [], skills: { 'subsistence-forager': 1, spiritual: 1 } },
        2: { requirements: CUMULATIVE_REQUIREMENTS(1), skills: { fermier: 1, artisanat: 1 } },
        3: { requirements: CUMULATIVE_REQUIREMENTS(4), skills: {} },
        4: { requirements: CUMULATIVE_REQUIREMENTS(8), skills: {} },
        5: { requirements: CUMULATIVE_REQUIREMENTS(12), skills: {} },
      },
    });
    expect(SOCIAL_CATEGORY.merchants).toEqual({
      eligibleSectors: [2],
      tiers: {
        1: { requirements: [], skills: { 'subsistence-forager': 1, spiritual: 1 } },
        2: { requirements: CUMULATIVE_REQUIREMENTS(1), skills: { 'vente-alimentaire': 1 } },
        3: { requirements: CUMULATIVE_REQUIREMENTS(4), skills: {} },
        4: { requirements: CUMULATIVE_REQUIREMENTS(8), skills: {} },
        5: { requirements: CUMULATIVE_REQUIREMENTS(12), skills: {} },
      },
    });
  });

  test('all 3 categories share the exact same tier ladder (identical requirements shape; skills diverge per group)', () => {
    const scholars = SOCIAL_CATEGORY.scholars;
    expect(scholars.eligibleSectors).toEqual([6]);
    expect(scholars.tiers[1]).toEqual({
      requirements: [],
      skills: { 'subsistence-forager': 1, spiritual: 1 },
    });
    for (const tier of [2, 3, 4, 5]) {
      expect(scholars.tiers[tier].requirements).toEqual(
        CUMULATIVE_REQUIREMENTS([1, 4, 8, 12][tier - 2])
      );
    }
    expect(scholars.tiers[2].skills).toEqual({ 'stockage-alimentaire': 1, medical: 1 });
    expect(scholars.tiers[3].skills).toEqual({ hygiene: 1, hospitality: 1 });
    expect(scholars.tiers[4].skills).toEqual({ education: 1, entertainment: 1 });
    expect(scholars.tiers[5].skills).toEqual({ medical: 2, entertainment: 2, education: 2 });
  });

  test('each requirement kind from an earlier tier is repeated in every later tier (cumulative, not inherited)', () => {
    for (const category of Object.values(SOCIAL_CATEGORY)) {
      const tier2Kinds = category.tiers[2].requirements.map((r) => r.kind);
      for (const tier of [3, 4, 5]) {
        const laterKinds = category.tiers[tier].requirements.map((r) => r.kind);
        for (const kind of tier2Kinds) {
          expect(laterKinds).toContain(kind);
        }
      }
    }
  });

  test('each category owns its own requirements list, so one can diverge without touching the others', () => {
    const [artisans, merchants, scholars] = ['artisans', 'merchants', 'scholars'].map(
      (key) => SOCIAL_CATEGORY[key]
    );
    expect(artisans.tiers[2].requirements).not.toBe(merchants.tiers[2].requirements);
    expect(merchants.tiers[2].requirements).not.toBe(scholars.tiers[2].requirements);
  });

  test('tier 1 never requires anything — it is the starting tier', () => {
    for (const facts of Object.values(SOCIAL_CATEGORY)) {
      expect(facts.tiers[1].requirements).toEqual([]);
    }
  });

  test('tier 5 requires 2 distinct food categories in the same period (goodsVariety)', () => {
    for (const facts of Object.values(SOCIAL_CATEGORY)) {
      expect(facts.tiers[5].requirements).toContainEqual({ kind: 'goodsVariety', min: 2 });
    }
  });
});
