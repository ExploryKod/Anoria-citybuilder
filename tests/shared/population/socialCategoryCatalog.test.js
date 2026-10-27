import { describe, test, expect } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

const TIERS = [1, 2, 3, 4, 5, 6];
const kindsOf = (tier) => tier.requirements.map((requirement) => requirement.kind);
const namesOf = (tier) => tier.requirements.map((requirement) => requirement.category).filter(Boolean);

/** Every category but the administrators (the mayor's house, a ladder of its own), which share the 6-tier ladder. */
const WORKING_CLASSES = Object.entries(SOCIAL_CATEGORY).filter(([id]) => id !== 'administrators').map(([, facts]) => facts);

describe('SOCIAL_CATEGORY — single source for the social categories', () => {
  test('declares artisans, merchants, scholars (a 6-tier ladder each) and the administrators (3 tiers)', () => {
    expect(Object.keys(SOCIAL_CATEGORY).sort()).toEqual(['administrators', 'artisans', 'merchants', 'scholars']);
    for (const facts of WORKING_CLASSES) {
      expect(Object.keys(facts.tiers).map(Number)).toEqual(TIERS);
    }
    expect(Object.keys(SOCIAL_CATEGORY.administrators.tiers).map(Number)).toEqual([1, 2, 3]);
  });

  test('the administrators are six at most whatever the tier, and hold their two skills by right from the first tier', () => {
    const { administrators } = SOCIAL_CATEGORY;
    for (const tier of Object.values(administrators.tiers)) expect(tier.maxPopulation).toBe(6);
    expect(administrators.tiers[1].requirements).toEqual([]);
    expect(administrators.tiers[1].skills).toEqual({ proprietaire: 1, perception_ic: 1, perception_ir: 1, perception_tva: 1 });
    expect(administrators.tiers[2].skills).toEqual({ perception_is: 1, perception_douane: 1 });
  });

  test('the ladder is the same for the 3 categories: only the skills they hold differ', () => {
    const { artisans, merchants, scholars } = SOCIAL_CATEGORY;
    for (const tier of TIERS) {
      expect(merchants.tiers[tier].requirements).toEqual(artisans.tiers[tier].requirements);
      expect(scholars.tiers[tier].requirements).toEqual(artisans.tiers[tier].requirements);
    }
  });

  test('tier 1 never requires anything — it is the starting tier', () => {
    for (const facts of Object.values(SOCIAL_CATEGORY)) {
      expect(facts.tiers[1].requirements).toEqual([]);
    }
  });

  test('what a house needs to evolve, level by level: water, food, a dispensary and a primary school; then goods, fire, a warehouse and energy; then a hospital, the police and a café-restaurant', () => {
    const { artisans } = SOCIAL_CATEGORY;
    // Level 1 → 2
    expect(namesOf(artisans.tiers[2])).toEqual(['water', 'doctor', 'primarySchool']);
    expect(kindsOf(artisans.tiers[2])).toContain('demandMet');
    // Level 2 → 3
    expect(namesOf(artisans.tiers[3])).toEqual(['water', 'doctor', 'primarySchool', 'fire', 'energy']);
    expect(kindsOf(artisans.tiers[3])).toEqual(expect.arrayContaining(['goodsVariety', 'activityAccess']));
    expect(artisans.tiers[3].requirements).toContainEqual({ kind: 'goodsVariety', min: 1, outcomeField: 'lastGoodsConsumption' });
    // Level 3 → 4
    expect(namesOf(artisans.tiers[4])).toEqual(expect.arrayContaining(['hospital', 'police', 'pub']));
    expect(artisans.tiers[4].requirements).toContainEqual({ kind: 'goodsVariety', min: 2, outcomeField: 'lastGoodsConsumption' });
  });

  test('the skills of a level staff the buildings its list names: water, local medicine and teaching from the start, then fire, then hospital medicine and police', () => {
    const { scholars, artisans, merchants } = SOCIAL_CATEGORY;
    expect(scholars.tiers[1].skills).toEqual({ hydraulique: 1, 'medecine-proximite': 1, instruction: 1 });
    expect(scholars.tiers[2].skills).toEqual({ incendie: 1 });
    expect(scholars.tiers[3].skills).toEqual({ 'medecine-hospitaliere': 1, securite: 1 });
    expect(artisans.tiers[2].skills).toEqual({ artisanat: 1, energie: 1 });
    expect(artisans.tiers[3].skills).toEqual({ 'artisanat-specialise': 1, telecoms: 1, 'energie-nucleaire': 1 });
    expect(merchants.tiers[2].skills).toMatchObject({ manutention: 1 });
    expect(merchants.tiers[3].skills).toEqual({ hospitality: 1 });
  });

  test('each requirement from an earlier tier is repeated in every later tier (cumulative, not inherited)', () => {
    for (const category of WORKING_CLASSES) {
      for (const tier of [3, 4, 5, 6]) {
        for (const earlier of category.tiers[tier - 1].requirements.filter((requirement) => requirement.kind !== 'population' && requirement.kind !== 'goodsVariety')) {
          expect(category.tiers[tier].requirements).toContainEqual(earlier);
        }
      }
    }
  });

  test('every tier declares a growing population ceiling, defined once and shared by default', () => {
    for (const facts of WORKING_CLASSES) {
      const caps = TIERS.map((level) => facts.tiers[level].maxPopulation);
      expect(caps.every((cap) => Number.isInteger(cap) && cap > 0)).toBe(true);
      expect([...caps].sort((a, b) => a - b)).toEqual(caps);
    }
  });
});

describe('a skill has one level', () => {
  test('every skill the houses grant is granted at level 1: a more advanced trade (hospital medicine, nuclear energy...) is a skill of its own', () => {
    const levels = Object.values(SOCIAL_CATEGORY).flatMap((category) => Object.values(category.tiers).flatMap((tier) => Object.entries(tier.skills)));
    expect(levels.length).toBeGreaterThan(0);
    for (const [skill, level] of levels) expect({ skill, level }).toEqual({ skill, level: 1 });
  });
});
