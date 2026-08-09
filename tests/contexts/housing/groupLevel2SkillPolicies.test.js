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
  residentialGroupForHouseType,
} from '../../../src/contexts/housing/domain/policies/GroupLevel2PlacementUnlockPolicy.js';
import { computeHouseCitizenComposition } from '../../../src/contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';
import { resolveHouseLevel } from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';

describe('Housing — GroupLevel2SkillPolicy', () => {
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
});

describe('Housing — GroupLevel2PlacementUnlockPolicy', () => {
  test('House-Blue catalog group matches merchants unlock key', () => {
    expect(residentialGroupForHouseType('House-Blue')).toBe('merchants');
  });

  test('evaluates unlock per group at level 2', () => {
    const status = evaluateGroupLevel2UnlockStatus([
      { type: 'House-Red', level: 2 },
      { type: 'House-Blue', level: 1 },
    ]);

    expect(status['artisans']).toBe(true);
    expect(status.merchants).toBe(false);
  });

  test('road + pop on House-Blue unlocks markets via level 2', () => {
    const level = resolveHouseLevel({ level: 1, pop: 2, roadCount: 1 });
    expect(level.targetLevel).toBe(2);

    const status = evaluateGroupLevel2UnlockStatus([
      { type: 'House-Blue', level: level.targetLevel },
    ]);
    expect(status.merchants).toBe(true);
    expect(unlockGroupForBuilding('Market-Stall-Blue')).toBe('merchants');
    expect(
      getCitizenSkillsForHouse({
        level: 2,
        residentialGroup: residentialGroupForHouseType('House-Blue'),
      }),
    ).toContain('vente-alimentaire');
  });

  test('maps buildings to unlock groups', () => {
    expect(unlockGroupForBuilding('Farm-Wheat')).toBe('artisans');
    expect(unlockGroupForBuilding('Market-Stall-Red')).toBe('merchants');
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
      residentialGroup: 'merchants',
    });

    expect(skills['subsistence-forager']).toBe(4);
    expect(skills['vente-alimentaire']).toBe(4);
  });
});
