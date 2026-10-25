/**
 * A skill's "level" the player reads is the house level it came with, the same number the workplaces of that skill show on their card: fire-fighting comes with a house
 * of level 2 and staffs the fire station, shown "niv. 2"; it used to read "niv. 1" on the house (the skill's own scale), against "niv. 2" on the card.
 */
import { describe, expect, test } from '@jest/globals';
import { houseSkillTier, lowestHouseTierForWorkers } from '../../../src/shared/population/workforceQueries.js';
import { getRequiredSkillForBuilding, getRequiredSkillLevelForBuilding } from '../../../src/contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';

const cardTierOf = (buildingType) => lowestHouseTierForWorkers(getRequiredSkillForBuilding(buildingType), getRequiredSkillLevelForBuilding(buildingType));

describe('the level of a skill is the house level it came with', () => {
  test('a house shows, for each skill it holds, the level a workplace of that skill shows on its card', () => {
    // A savants' house (House-Purple) of level 4 holds all of them.
    expect(houseSkillTier('House-Purple', 4, 'incendie')).toBe(cardTierOf('FireStation'));
    expect(houseSkillTier('House-Purple', 4, 'education')).toBe(cardTierOf('School'));
    expect(houseSkillTier('House-Purple', 4, 'medecine-hospitaliere')).toBe(cardTierOf('Hospital'));
    expect(houseSkillTier('House-Purple', 4, 'medecine-proximite')).toBe(cardTierOf('Doctor'));
    expect(houseSkillTier('House-Purple', 4, 'instruction')).toBe(cardTierOf('PrimarySchool'));
  });

  test('a skill comes with the house level that grants it, and a skill not held yet is 0', () => {
    // Local medicine with the first house level, hospital medicine with the third.
    expect(houseSkillTier('House-Purple', 2, 'medecine-proximite')).toBe(1);
    expect(houseSkillTier('House-Purple', 3, 'medecine-proximite')).toBe(1);
    expect(houseSkillTier('House-Purple', 3, 'medecine-hospitaliere')).toBe(3);
    expect(houseSkillTier('House-Purple', 2, 'medecine-hospitaliere')).toBe(0);
    expect(houseSkillTier('House-Purple', 1, 'incendie')).toBe(0);
  });
});
