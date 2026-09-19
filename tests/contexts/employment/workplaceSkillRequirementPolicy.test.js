import { describe, test, expect } from '@jest/globals';
import {
  WORKPLACE_REQUIRED_SKILL,
  getRequiredSkillForBuilding,
  getRequiredSkillLevelForBuilding,
} from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

describe('Employment — WorkplaceSkillRequirementPolicy', () => {
  test('maps early workplaces to profession skills', () => {
    expect(getRequiredSkillForBuilding('Farm-Wheat')).toBe('fermier');
    expect(getRequiredSkillForBuilding('Market-Stall-Red')).toBe('vente-alimentaire');
    expect(getRequiredSkillForBuilding('Windmill-001')).toBe('stockage-alimentaire');
    expect(getRequiredSkillForBuilding('Barn-001')).toBeNull();
  });

  test('Chapel and every other public/service building now requires a skill too', () => {
    expect(getRequiredSkillForBuilding('Chapel')).toBe('spiritual');
    expect(getRequiredSkillForBuilding('Market-Stall')).toBe('vente-alimentaire');
    expect(getRequiredSkillForBuilding('Factory-Plate')).toBe('artisanat');
    expect(getRequiredSkillForBuilding('Doctor')).toBe('medical');
    expect(getRequiredSkillForBuilding('Hospital')).toBe('medical');
  });

  test('requiredSkillLevel defaults to 1, and a bigger sibling building can require level 2', () => {
    expect(getRequiredSkillLevelForBuilding('Chapel')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Doctor')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Hospital')).toBe(2);
    expect(getRequiredSkillLevelForBuilding('Cinema')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Theatre')).toBe(2);
  });

  test('workplace skills use Housing profession skill vocabulary (contract)', () => {
    const housingSkillValues = new Set(
      Object.values(SOCIAL_CATEGORY).flatMap((facts) =>
        Object.values(facts.tiers).flatMap((tier) => Object.keys(tier.skills))
      )
    );
    for (const skill of Object.values(WORKPLACE_REQUIRED_SKILL)) {
      expect(housingSkillValues.has(skill)).toBe(true);
    }
  });
});
