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
  test('level 1 (the village) houses hold the trades its first needs call for: farming, food sale and storage, water and medicine', () => {
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'artisans' })).toEqual(['fermier']);
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'merchants' })).toEqual([
      'vente-alimentaire',
      'stockage-alimentaire',
    ]);
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'scholars' })).toEqual(['hydraulique', 'medical']);
  });

  test('nobody holds a foraging skill any more', () => {
    for (const residentialGroup of ['artisans', 'merchants', 'scholars']) {
      expect(getCitizenSkillsForHouse({ level: 6, residentialGroup })).not.toContain('subsistence-forager');
    }
  });

  test('level 2 artisans gain artisanat + energy on top of the village trade', () => {
    expect(getCitizenSkillsForHouse({ level: 2, residentialGroup: 'artisans' })).toEqual([
      'fermier',
      'artisanat',
      'energie',
    ]);
  });

  test('houseCitizenHasSkill respects level', () => {
    expect(houseCitizenHasSkill({ level: 1, residentialGroup: 'artisans' }, 'fermier')).toBe(true);
    expect(houseCitizenHasSkill({ level: 1, residentialGroup: 'artisans' }, 'artisanat')).toBe(false);
    expect(houseCitizenHasSkill({ level: 2, residentialGroup: 'artisans' }, 'artisanat')).toBe(true);
  });

  test('skill levels raise cumulatively across tiers (medical 1 at tier 1, 2 at tier 3)', () => {
    expect(getCitizenSkillLevel({ level: 1, residentialGroup: 'scholars' }, 'medical')).toBe(1);
    expect(getCitizenSkillLevel({ level: 2, residentialGroup: 'scholars' }, 'medical')).toBe(1);
    expect(getCitizenSkillLevel({ level: 3, residentialGroup: 'scholars' }, 'medical')).toBe(2);
  });

  test('houseCitizenHasSkillAtLevel: a higher-level citizen also satisfies a lower-level job', () => {
    expect(houseCitizenHasSkillAtLevel({ level: 3, residentialGroup: 'scholars' }, 'medical', 2)).toBe(true);
    expect(houseCitizenHasSkillAtLevel({ level: 3, residentialGroup: 'scholars' }, 'medical', 1)).toBe(true);
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
  test('a level 2 blue house skill counts include vente alimentaire, from its village tier', () => {
    const { skills } = computeHouseCitizenComposition({
      level: 2,
      pop: 4,
      buildingType: 'House-Blue',
      residentialGroup: 'merchants',
    });

    expect(skills['subsistence-forager']).toBeUndefined();
    expect(skills['vente-alimentaire']).toBe(4);
  });
});
