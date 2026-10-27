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

  test('the water tank and every other public/service building requires a skill too', () => {
    expect(getRequiredSkillForBuilding('WaterTank')).toBe('hydraulique');
    expect(getRequiredSkillForBuilding('FireStation')).toBe('incendie');
    expect(getRequiredSkillForBuilding('PoliceStation')).toBe('securite');
    expect(getRequiredSkillForBuilding('CoalPlant')).toBe('energie');
    expect(getRequiredSkillForBuilding('PetrolPlant')).toBe('energie');
    expect(getRequiredSkillForBuilding('Market-Stall-Red')).toBe('vente-alimentaire');
    expect(getRequiredSkillForBuilding('Factory-Plate')).toBe('artisanat');
    expect(getRequiredSkillForBuilding('Doctor')).toBe('medecine-proximite');
    expect(getRequiredSkillForBuilding('Hospital')).toBe('medecine-hospitaliere');
  });

  test('a skill has one level: every workplace asks level 1, and an advanced trade is a skill of its own', () => {
    expect(getRequiredSkillLevelForBuilding('WaterTank')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Doctor')).toBe(1);
    // A more advanced trade is a skill of its own, never a higher level of the same one.
    expect(getRequiredSkillLevelForBuilding('Hospital')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Cinema')).toBe(1);
    expect(getRequiredSkillLevelForBuilding('Theatre')).toBe(1);
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
