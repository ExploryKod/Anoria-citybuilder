import { describe, test, expect } from '@jest/globals';
import {
  getCitizenSkillLevel,
  getCitizenSkillsForHouse,
  houseCitizenHasSkill,
  houseCitizenHasSkillAtLevel,
  residentialGroupForHouseType,
} from '../../../src/contexts/housing/domain/policies/GroupSkillPolicy.js';
import { computeHouseCitizenComposition } from '../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';

describe('Housing — GroupSkillPolicy', () => {
  test('level 1 houses have chasse-cueillette AND spiritual (Chapel bootstrap skill)', () => {
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'merchants' })).toEqual([
      'subsistence-forager',
      'spiritual',
    ]);
  });

  test('level 2 artisans gain fermier + artisanat + manutention cumulatively', () => {
    expect(getCitizenSkillsForHouse({ level: 2, residentialGroup: 'artisans' })).toEqual([
      'subsistence-forager',
      'spiritual',
      'fermier',
      'artisanat',
      'manutention',
    ]);
  });

  test('houseCitizenHasSkill respects level', () => {
    expect(houseCitizenHasSkill({ level: 2, residentialGroup: 'scholars' }, 'stockage-alimentaire')).toBe(true);
    expect(houseCitizenHasSkill({ level: 1, residentialGroup: 'scholars' }, 'stockage-alimentaire')).toBe(false);
  });

  test('skill levels raise cumulatively across tiers (medical 1 at tier 2, 2 at tier 5)', () => {
    expect(getCitizenSkillLevel({ level: 2, residentialGroup: 'scholars' }, 'medical')).toBe(1);
    expect(getCitizenSkillLevel({ level: 4, residentialGroup: 'scholars' }, 'medical')).toBe(1);
    expect(getCitizenSkillLevel({ level: 5, residentialGroup: 'scholars' }, 'medical')).toBe(2);
  });

  test('houseCitizenHasSkillAtLevel: a higher-level citizen also satisfies a lower-level job', () => {
    expect(houseCitizenHasSkillAtLevel({ level: 5, residentialGroup: 'scholars' }, 'medical', 2)).toBe(true);
    expect(houseCitizenHasSkillAtLevel({ level: 5, residentialGroup: 'scholars' }, 'medical', 1)).toBe(true);
    expect(houseCitizenHasSkillAtLevel({ level: 2, residentialGroup: 'scholars' }, 'medical', 2)).toBe(false);
    expect(houseCitizenHasSkillAtLevel({ level: 2, residentialGroup: 'scholars' }, 'medical', 1)).toBe(true);
  });

  test('resolves residential group from house type', () => {
    expect(residentialGroupForHouseType('House-Blue')).toBe('merchants');
    expect(residentialGroupForHouseType('House-Red')).toBe('artisans');
    expect(residentialGroupForHouseType('Barn-001')).toBeNull();
  });
});

describe('Housing — HouseCitizenCompositionPolicy', () => {
  test('level 2 blue house skill counts include vente alimentaire', () => {
    const { skills } = computeHouseCitizenComposition({
      level: 2,
      pop: 4,
      buildingType: 'House-Blue',
      residentialGroup: 'merchants',
    });

    expect(skills['subsistence-forager']).toBe(4);
    expect(skills['vente-alimentaire']).toBe(4);
  });
});
