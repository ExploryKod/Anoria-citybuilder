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
  groupsProvidingSkill,
  sharedWorkplaceSkills,
  skillsForTab,
  tabForSkill,
} from '../../../src/contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import { allWorkplaceEmploymentSkills } from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';

describe('Employment — HouseGroupSectorEligibilityPolicy (skill/tab derivation)', () => {
  describe('groupsForSkill', () => {
    test('a group-exclusive skill resolves to exactly its one owning group', () => {
      expect(groupsForSkill('fermier')).toEqual(['artisans']);
      expect(groupsForSkill('vente-alimentaire')).toEqual(['merchants']);
      expect(groupsForSkill('stockage-alimentaire')).toEqual(['merchants']);
    });

    test('each trade of the new ladder belongs to one group: water and fire to the scholars, energy to the artisans', () => {
      expect(groupsForSkill('hydraulique')).toEqual(['scholars']);
      expect(groupsForSkill('incendie')).toEqual(['scholars']);
      expect(groupsForSkill('energie')).toEqual(['artisans']);
      expect(groupsForSkill('hospitality')).toEqual(['merchants']);
    });
  });

  describe('exclusiveSkillsForGroup', () => {
    test('artisans get fermier + artisanat + energie, never another group\'s skill', () => {
      const skills = exclusiveSkillsForGroup('artisans');
      expect(skills).toEqual(expect.arrayContaining(['fermier', 'artisanat', 'energie']));
      expect(skills).not.toContain('vente-alimentaire');
    });

    test('scholars own every public-service skill', () => {
      const skills = exclusiveSkillsForGroup('scholars');
      for (const skill of ['hydraulique', 'medical', 'incendie', 'securite', 'education', 'entertainment']) {
        expect(skills).toContain(skill);
      }
    });
  });

  describe('sharedWorkplaceSkills', () => {
    test('is exactly the skills more than one group grants (none today: each trade has one group)', () => {
      expect(sharedWorkplaceSkills()).toEqual([]);
    });
  });

  describe('allPriorityTabs / skillsForTab', () => {
    test('one tab per social group, and no shared tab while no skill is shared', () => {
      expect(allPriorityTabs().sort()).toEqual(['administrators', 'artisans', 'merchants', 'scholars']);
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

  });

  describe('tabForSkill', () => {
    test('resolves a group-exclusive skill to its own group\'s tab', () => {
      expect(tabForSkill('fermier')).toBe('artisans');
      expect(tabForSkill('vente-alimentaire')).toBe('merchants');
    });

    test('is the exact inverse of skillsForTab', () => {
      for (const tabId of allPriorityTabs()) {
        for (const skillId of skillsForTab(tabId)) {
          expect(tabForSkill(skillId)).toBe(tabId);
        }
      }
    });
  });

  describe('groupsProvidingSkill — which kind of house fills a workplace', () => {
    test('an exclusive skill names its one group and the house tier that starts providing it', () => {
      expect(groupsProvidingSkill('stockage-alimentaire')).toEqual([{ group: 'merchants', tier: 1 }]);
      expect(groupsProvidingSkill('fermier')).toEqual([{ group: 'artisans', tier: 1 }]);
    });

    test('a higher level is only provided by the groups that reach it, and later', () => {
      const level1 = groupsProvidingSkill('medical', 1);
      const level2 = groupsProvidingSkill('medical', 2);
      expect(level2.length).toBeGreaterThan(0);
      expect(level2[0].tier).toBeGreaterThan(level1[0].tier);
    });

    test('every skill a workplace needs is provided by at least one group', () => {
      for (const skillId of allWorkplaceEmploymentSkills()) {
        expect(groupsProvidingSkill(skillId).length).toBeGreaterThan(0);
      }
    });
  });
});
