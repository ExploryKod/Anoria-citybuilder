import { describe, test, expect } from '@jest/globals';
import {
  WORKPLACE_REQUIRED_SKILL,
  getRequiredSkillForBuilding,
} from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';

describe('Employment — WorkplaceSkillRequirementPolicy', () => {
  test('maps early workplaces to profession skills', () => {
    expect(getRequiredSkillForBuilding('Farm-Wheat')).toBe('fermier');
    expect(getRequiredSkillForBuilding('Market-Stall-Red')).toBe('vente-alimentaire');
    expect(getRequiredSkillForBuilding('Windmill-001')).toBe('stockage-alimentaire');
    expect(getRequiredSkillForBuilding('Barn-001')).toBeNull();
  });

  test('workplace skills use Housing profession skill vocabulary (contract)', () => {
    const housingSkillValues = new Set(
      Object.values(SOCIAL_CATEGORY).flatMap((facts) =>
        Object.values(facts.tiers).flatMap((tier) => tier.skills)
      )
    );
    for (const skill of Object.values(WORKPLACE_REQUIRED_SKILL)) {
      expect(housingSkillValues.has(skill)).toBe(true);
    }
  });
});
