import { describe, test, expect } from '@jest/globals';
import {
  GROUP_LEVEL2_SKILL,
  getCitizenSkillsForHouse,
  houseCitizenHasSkill,
} from '../../../src/contexts/housing/domain/policies/GroupLevel2SkillPolicy.js';
import {
  GROUP_LEVEL2_UNLOCKED_BUILDINGS,
  evaluateGroupLevel2UnlockStatus,
  unlockGroupForBuilding,
} from '../../../src/contexts/housing/domain/policies/GroupLevel2PlacementUnlockPolicy.js';
import { computeHouseCitizenComposition } from '../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';

describe('Housing — GroupLevel2SkillPolicy', () => {
  test('level 1 houses only have chasse-cueillette', () => {
    expect(getCitizenSkillsForHouse({ level: 1, residentialGroup: 'commercants' })).toEqual([
      'subsistence-forager',
    ]);
  });

  test('level 2 artisans gain fermier cumulatively', () => {
    expect(getCitizenSkillsForHouse({ level: 2, residentialGroup: 'artisans-ouvriers' })).toEqual([
      'subsistence-forager',
      'fermier',
    ]);
  });

  test('houseCitizenHasSkill respects level', () => {
    expect(houseCitizenHasSkill({ level: 2, residentialGroup: 'savants' }, 'stockage-alimentaire')).toBe(true);
    expect(houseCitizenHasSkill({ level: 1, residentialGroup: 'savants' }, 'stockage-alimentaire')).toBe(false);
  });
});

describe('Housing — GroupLevel2PlacementUnlockPolicy', () => {
  test('evaluates unlock per group at level 2', () => {
    const status = evaluateGroupLevel2UnlockStatus([
      { type: 'House-Red', level: 2 },
      { type: 'House-Blue', level: 1 },
    ]);

    expect(status['artisans-ouvriers']).toBe(true);
    expect(status.commercants).toBe(false);
  });

  test('maps buildings to unlock groups', () => {
    expect(unlockGroupForBuilding('Farm-Wheat')).toBe('artisans-ouvriers');
    expect(unlockGroupForBuilding('Market-Stall-Red')).toBe('commercants');
    expect(unlockGroupForBuilding('Barn-001')).toBeNull();
  });

  test('unlock lists align with skill keys', () => {
    for (const group of Object.keys(GROUP_LEVEL2_UNLOCKED_BUILDINGS)) {
      expect(GROUP_LEVEL2_SKILL[group]).toBeTruthy();
    }
  });
});

describe('Housing — HouseCitizenCompositionPolicy', () => {
  test('level 2 blue house skill counts include vente alimentaire', () => {
    const { skills } = computeHouseCitizenComposition({
      level: 2,
      pop: 4,
      buildingType: 'House-Blue',
      residentialGroup: 'commercants',
    });

    expect(skills['subsistence-forager']).toBe(4);
    expect(skills['vente-alimentaire']).toBe(4);
  });
});
