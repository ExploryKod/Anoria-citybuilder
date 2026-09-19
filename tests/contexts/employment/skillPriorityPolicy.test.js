/**
 * Behavior tests — Employment: SkillPriorityPolicy
 *
 * Same Caesar 3-style "no duplicate rank" swap as the retired
 * SectorPriorityPolicy.js, now scoped to one tab's skill list instead of a
 * fixed 1-6 range — see HouseGroupSectorEligibilityPolicy.skillsForTab.
 */
import { describe, test, expect } from '@jest/globals';
import {
  resolveSkillPriorityValue,
  mergeTabPriorities,
  swapSkillPriority,
} from '../../../src/contexts/employment/domain/policies/SkillPriorityPolicy.js';

const ARTISANS_TAB = ['fermier', 'artisanat'];
const SCHOLARS_TAB = ['stockage-alimentaire', 'medical', 'hygiene', 'hospitality', 'education', 'entertainment'];

describe('Employment — SkillPriorityPolicy', () => {
  describe('resolveSkillPriorityValue', () => {
    test('a stored override wins', () => {
      expect(resolveSkillPriorityValue('fermier', { fermier: 2 }, ARTISANS_TAB)).toBe(2);
    });

    test('default is the skill\'s own position within its tab (1-based)', () => {
      expect(resolveSkillPriorityValue('fermier', {}, ARTISANS_TAB)).toBe(1);
      expect(resolveSkillPriorityValue('artisanat', {}, ARTISANS_TAB)).toBe(2);
    });

    test('a skill id absent from the tab falls back past the tab\'s own length', () => {
      expect(resolveSkillPriorityValue('unrelated-skill', {}, ARTISANS_TAB)).toBe(ARTISANS_TAB.length + 1);
    });

    test('an empty/falsy skill id is always lowest priority', () => {
      expect(resolveSkillPriorityValue('', {}, ARTISANS_TAB)).toBe(99);
      expect(resolveSkillPriorityValue(null, {}, ARTISANS_TAB)).toBe(99);
    });
  });

  describe('mergeTabPriorities', () => {
    test('fills every skill in the tab, defaults where unset', () => {
      const merged = mergeTabPriorities({ fermier: 2 }, ARTISANS_TAB);
      expect(merged).toEqual({ fermier: 2, artisanat: 2 });
    });

    test('two different tabs can each have a rank-1 skill — no cross-tab uniqueness', () => {
      const artisansMerged = mergeTabPriorities({ fermier: 1 }, ARTISANS_TAB);
      const scholarsMerged = mergeTabPriorities({ medical: 1 }, SCHOLARS_TAB);
      expect(artisansMerged.fermier).toBe(1);
      expect(scholarsMerged.medical).toBe(1);
    });
  });

  describe('swapSkillPriority', () => {
    test('swaps ranks within the tab (Caesar 3-style), leaving other tabs\' entries untouched', () => {
      const stored = { fermier: 1, artisanat: 2, medical: 1 };
      const updated = swapSkillPriority('artisanat', 1, stored, ARTISANS_TAB);

      expect(updated.artisanat).toBe(1);
      expect(updated.fermier).toBe(2); // swapped with whichever held rank 1
      expect(updated.medical).toBe(1); // scholars tab, untouched
    });

    test('clamps to [1, tab length]', () => {
      const updated = swapSkillPriority('fermier', 99, {}, ARTISANS_TAB);
      expect(updated.fermier).toBe(ARTISANS_TAB.length);
    });

    test('no-op when the skill already holds that rank', () => {
      const stored = { fermier: 1, artisanat: 2 };
      const updated = swapSkillPriority('fermier', 1, stored, ARTISANS_TAB);
      expect(updated).toEqual(stored);
    });

    test('a single-skill tab clamps to rank 1 always', () => {
      const tab = ['vente-alimentaire'];
      const updated = swapSkillPriority('vente-alimentaire', 5, {}, tab);
      // Effective rank, not the raw key: rank 1 is already this skill's default
      // in a one-skill tab, so the swap is a no-op and stores nothing.
      expect(resolveSkillPriorityValue('vente-alimentaire', updated, tab)).toBe(1);
      expect(updated).toEqual({});
    });
  });
});
