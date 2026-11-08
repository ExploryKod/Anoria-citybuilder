import { describe, test, expect } from '@jest/globals';
import { casualtiesAmong, collapseChanceOf, kindHasSolidity, solidityAfterMonth, solidityOf, solidityStatusOf } from '../../src/shared/solidity/SolidityPolicy.js';
import { MAX_MONTHLY_COLLAPSE_CHANCE, MONTHLY_WEAR, RISK_BELOW, WARNING_BELOW } from '../../src/shared/solidity/SolidityCatalog.js';
import { loadPrefab } from '../../src/shared/prefabs/prefabCatalog.js';

const prefab = await loadPrefab('anoria-tour-107');

// The solidity of a building (docs/gameplay/PLAN_COLLAPSE.md): paid upkeep keeps it, an unpaid one wears it, the risk comes only when it is low.
describe('the solidity of a building', () => {
  test('a paid upkeep cancels the month\'s wear, an unpaid one lets it down to 0', () => {
    expect(solidityAfterMonth({ solidity: 80, upkeepPaid: true })).toBe(80);
    expect(solidityAfterMonth({ solidity: 80, upkeepPaid: false })).toBe(80 - MONTHLY_WEAR);
    expect(solidityAfterMonth({ solidity: 2, upkeepPaid: false })).toBe(0);
  });

  test('the alert shows before the risk begins, and the chance of collapse grows as the bar falls', () => {
    expect(solidityStatusOf(WARNING_BELOW)).toBe('sound');
    expect(solidityStatusOf(WARNING_BELOW - 1)).toBe('warning');
    expect(solidityStatusOf(RISK_BELOW - 1)).toBe('at-risk');
    expect(collapseChanceOf(RISK_BELOW)).toBe(0);
    expect(collapseChanceOf(RISK_BELOW / 2)).toBeCloseTo(MAX_MONTHLY_COLLAPSE_CHANCE / 2);
    expect(collapseChanceOf(0)).toBe(MAX_MONTHLY_COLLAPSE_CHANCE);
  });

  test('a collapse kills a share of the people present; a missing bar is a defect, not a full one', () => {
    const people = ['a', 'b', 'c'];
    expect(casualtiesAmong({ people: [], random: () => 0 })).toEqual([]);
    expect(casualtiesAmong({ people, random: () => 0 })).toEqual(people);
    expect(casualtiesAmong({ people, random: () => 0.99 })).toEqual([]);
    expect(() => solidityOf({ kind: 'house', type: 'House-Blue' })).toThrow(/solidity/);
    expect(solidityOf({ kind: 'road', type: 'StonePath-001' })).toBeNull();
  });

  test('every building of the starter city that has a bar carries one', () => {
    const buildings = prefab.city.buildings;
    expect(buildings.length).toBeGreaterThan(0);
    for (const building of buildings) {
      if (kindHasSolidity(building.kind)) expect(solidityOf(building)).not.toBeNull();
    }
  });
});
