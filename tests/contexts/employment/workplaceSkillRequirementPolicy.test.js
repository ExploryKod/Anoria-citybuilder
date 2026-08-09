import { describe, test, expect } from '@jest/globals';
import {
  WORKPLACE_REQUIRED_SKILL,
  getRequiredSkillForBuilding,
  residentialGroupForSkill,
} from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';
import { GROUP_LEVEL2_SKILL } from '../../../src/contexts/housing/domain/policies/GroupLevel2SkillPolicy.js';

describe('Employment — WorkplaceSkillRequirementPolicy', () => {
  test('maps early workplaces to profession skills', () => {
    expect(getRequiredSkillForBuilding('Farm-Wheat')).toBe('fermier');
    expect(getRequiredSkillForBuilding('Market-Stall-Red')).toBe('vente-alimentaire');
    expect(getRequiredSkillForBuilding('Windmill-001')).toBe('stockage-alimentaire');
    expect(getRequiredSkillForBuilding('Barn-001')).toBeNull();
  });

  test('skill keys resolve back to residential groups', () => {
    expect(residentialGroupForSkill('fermier')).toBe('artisans');
    expect(residentialGroupForSkill('vente-alimentaire')).toBe('merchants');
    expect(residentialGroupForSkill('stockage-alimentaire')).toBe('scholars');
  });

  test('workplace skills use Housing profession skill vocabulary (contract)', () => {
    const employmentSkillValues = new Set(Object.values(WORKPLACE_REQUIRED_SKILL));
    const housingSkillValues = new Set(Object.values(GROUP_LEVEL2_SKILL));
    for (const skill of employmentSkillValues) {
      expect(housingSkillValues.has(skill)).toBe(true);
    }
  });
});
