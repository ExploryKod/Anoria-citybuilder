import { describe, test, expect } from '@jest/globals';
import {
  getCitizenSkillsForHouse,
  houseCitizenHasSkill,
  residentialGroupForHouseType,
} from '../../../src/contexts/housing/domain/policies/GroupSkillPolicy.js';
import { computeHouseCitizenComposition } from '../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';

describe('Housing — GroupSkillPolicy', () => {
  test('level 1 houses only have chasse-cueillette', () => {
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'merchants' })).toEqual([
      'subsistence-forager',
    ]);
  });

  test('level 2 artisans gain fermier cumulatively', () => {
    expect(getCitizenSkillsForHouse({ level: 2, residentialGroup: 'artisans' })).toEqual([
      'subsistence-forager',
      'fermier',
    ]);
  });

  test('houseCitizenHasSkill respects level', () => {
    expect(houseCitizenHasSkill({ level: 2, residentialGroup: 'scholars' }, 'stockage-alimentaire')).toBe(true);
    expect(houseCitizenHasSkill({ level: 1, residentialGroup: 'scholars' }, 'stockage-alimentaire')).toBe(false);
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
