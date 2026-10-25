import { describe, expect, test } from '@jest/globals';
import { chainVerdictOf, declaredCalendarOf, declaredYearlyYield, neverCollected, supplyBalanceOf, yearlyDemandOf } from '../../../src/contexts/supply/domain/policies/SupplyBalancePolicy.js';
import { monthsWithoutStock } from '../../../src/shared/resource-catalog/CropCalendarPolicy.js';

describe('SupplyBalancePolicy — how many producers a city is missing', () => {
  test('62 inhabitants eat 744 units a year: a farm makes 288, so 3 are needed and 1 more is missing with 2 working', () => {
    const categories = ['wheat', 'carrot', 'cabbage'];
    const demand = yearlyDemandOf([{ type: 'House-Blue', pop: 62 }], categories);
    const yieldPerBuilding = declaredYearlyYield(categories);

    expect(demand).toBe(744);
    expect(yieldPerBuilding).toBe(288);
    expect(supplyBalanceOf({ demand, capacity: 2 * yieldPerBuilding, yieldPerBuilding })).toMatchObject({ judged: true, shortfall: 168, buildingsMissing: 1, surplus: 0 });
    expect(supplyBalanceOf({ demand, capacity: 0, yieldPerBuilding }).buildingsMissing).toBe(3);
  });

  test('nothing is judged while there is no one to supply, and a surplus is not a shortfall', () => {
    expect(supplyBalanceOf({ demand: 0, capacity: 288, yieldPerBuilding: 288 })).toMatchObject({ judged: false, buildingsMissing: 0 });
    expect(supplyBalanceOf({ demand: 100, capacity: 288, yieldPerBuilding: 288 })).toMatchObject({ judged: true, shortfall: 0, buildingsMissing: 0, surplus: 188 });
  });

  test('a good with working producers that nobody bought in a year is a leak, though the theory is enough', () => {
    const cabbage = { neverCollected: neverCollected({ working: 2, collected: 0, months: 12 }), spoiled: 576 };
    const wheat = { neverCollected: neverCollected({ working: 2, collected: 576, months: 12 }), spoiled: 0 };

    expect(cabbage.neverCollected).toBe(true);
    expect(wheat.neverCollected).toBe(false);
    // Before a year of history a harvest may simply not have come yet.
    expect(neverCollected({ working: 2, collected: 0, months: 8 })).toBe(false);
    expect(chainVerdictOf({ judged: true, buildingsMissing: 0, goods: [wheat, cabbage] })).toBe('leaking');
    expect(chainVerdictOf({ judged: true, buildingsMissing: 0, goods: [wheat] })).toBe('ok');
    expect(chainVerdictOf({ judged: true, buildingsMissing: 1, goods: [wheat, cabbage] })).toBe('missing');
    expect(chainVerdictOf({ judged: false, buildingsMissing: 0, goods: [] })).toBe('idle');
  });

  test('the calendar of a seasonal good is what the catalog declares: the cabbage is harvested in autumn, sold in October, keeps two months', () => {
    expect(declaredCalendarOf('cabbage')).toEqual({ harvest: { unit: 'season', values: ['autumn'] }, sale: { unit: 'month', values: ['october'] }, keepsMonths: 2, keepsInStoreMonths: 8 });
    // A good made every month has no calendar to tell.
    expect(declaredCalendarOf('pot')).toBeNull();
  });

  test('a crop that does not last until the next purchase is gone from its store for the months in between', () => {
    // Harvested in September, sold the next December (15 months later): the granary keeps the wheat 24 months, the carrot 12, the cabbage 8 (sold in October: 13 months).
    expect(monthsWithoutStock({ keepsInStoreMonths: 24, monthsToNextSale: 15 })).toBe(0);
    expect(monthsWithoutStock({ keepsInStoreMonths: 12, monthsToNextSale: 15 })).toBe(3);
    expect(monthsWithoutStock({ keepsInStoreMonths: 8, monthsToNextSale: 13 })).toBe(5);
    expect(monthsWithoutStock({ keepsInStoreMonths: null, monthsToNextSale: 15 })).toBe(0);
  });
});
