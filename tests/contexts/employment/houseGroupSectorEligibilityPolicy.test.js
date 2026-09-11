/**
 * Behavior tests — Employment: HouseGroupSectorEligibilityPolicy's skill/tab
 * derivation (2026-09-10) — the precise, catalog-derived replacement for the
 * coarse `eligibleSectors` field, backing the work panel's per-group tabs.
 */
import { describe, test, expect } from '@jest/globals';
import {
  allPriorityTabs,
  exclusiveSkillsForGroup,
  groupsForSkill,
  sharedWorkplaceSkills,
  skillsForTab,
  tabForSkill,
  SHARED_SKILL_TAB_ID,
} from '../../../src/contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import { allWorkplaceEmploymentSkills } from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';

describe('Employment — HouseGroupSectorEligibilityPolicy (skill/tab derivation)', () => {
  describe('groupsForSkill', () => {
    test('a group-exclusive skill resolves to exactly its one owning group', () => {
      expect(groupsForSkill('fermier')).toEqual(['artisans']);
      expect(groupsForSkill('vente-alimentaire')).toEqual(['merchants']);
      expect(groupsForSkill('stockage-alimentaire')).toEqual(['scholars']);
    });

    test('spiritual (Chapel) is granted by every group — the cold-start bootstrap skill', () => {
      expect(groupsForSkill('spiritual').sort()).toEqual(['artisans', 'merchants', 'scholars']);
    });
  });

  describe('exclusiveSkillsForGroup', () => {
    test('artisans get fermier + artisanat, never a shared or another group\'s skill', () => {
      const skills = exclusiveSkillsForGroup('artisans');
      expect(skills).toEqual(expect.arrayContaining(['fermier', 'artisanat']));
      expect(skills).not.toContain('spiritual');
      expect(skills).not.toContain('vente-alimentaire');
    });

    test('scholars own every public-service skill except the shared one', () => {
      const skills = exclusiveSkillsForGroup('scholars');
      for (const skill of ['stockage-alimentaire', 'medical', 'education', 'hygiene', 'entertainment', 'hospitality']) {
        expect(skills).toContain(skill);
      }
      expect(skills).not.toContain('spiritual');
    });
  });

  describe('sharedWorkplaceSkills', () => {
    test('is exactly the skills more than one group grants (today: spiritual only)', () => {
      expect(sharedWorkplaceSkills()).toEqual(['spiritual']);
    });
  });

  describe('allPriorityTabs / skillsForTab', () => {
    test('one tab per social group plus the shared tab', () => {
      expect(allPriorityTabs().sort()).toEqual(['artisans', 'merchants', 'scholars', SHARED_SKILL_TAB_ID].sort());
    });

    test('every workplace-relevant skill appears in exactly one tab', () => {
      const seen = new Map();
      for (const tabId of allPriorityTabs()) {
        for (const skillId of skillsForTab(tabId)) {
          expect(seen.has(skillId)).toBe(false); // no duplicate across tabs
          seen.set(skillId, tabId);
        }
      }
      for (const skillId of allWorkplaceEmploymentSkills()) {
        expect(seen.has(skillId)).toBe(true); // nothing falls through the cracks
      }
    });

    test('the shared tab holds exactly the shared skills', () => {
      expect(skillsForTab(SHARED_SKILL_TAB_ID)).toEqual(sharedWorkplaceSkills());
    });
  });

  describe('tabForSkill', () => {
    test('resolves a group-exclusive skill to its own group\'s tab', () => {
      expect(tabForSkill('fermier')).toBe('artisans');
      expect(tabForSkill('vente-alimentaire')).toBe('merchants');
    });

    test('resolves a shared skill to the shared tab', () => {
      expect(tabForSkill('spiritual')).toBe(SHARED_SKILL_TAB_ID);
    });

    test('is the exact inverse of skillsForTab', () => {
      for (const tabId of allPriorityTabs()) {
        for (const skillId of skillsForTab(tabId)) {
          expect(tabForSkill(skillId)).toBe(tabId);
        }
      }
    });
  });
});
