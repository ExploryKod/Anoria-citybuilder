import { describe, test, expect } from '@jest/globals';
import { hungerRiskOfHouse, splitUnfedByCause } from '../../../src/contexts/housing/domain/policies/HungerCausePolicy.js';
import { getQuantityConsumerEntry, getTotalKeyForCategory } from '../../../src/shared/building-catalog/resourceRoleQueries.js';

// The hungry are told apart: the house could not pay the food on sale (disette) or there was nothing to buy (pénurie).
describe('the hungry of a house, told apart by cause', () => {
  const houseType = 'House-Blue';
  const entry = getQuantityConsumerEntry(houseType);
  const totalKey = entry.totalKey ?? getTotalKeyForCategory(entry.categories[0]);
  const shortfall = (unpaid, shortage) => ({ current: { year: 1, monthIndex: 4, byNeed: { [totalKey]: { unpaid, shortage } } }, previous: null });
  const split = (unfed, supplyShortfall) => splitUnfedByCause({ unfed, houseType, lastConsumption: { month: 4 }, supplyShortfall });

  test('nothing unpaid, or no seller reached the house: all pénurie', () => {
    expect(split(6, null)).toEqual({ disette: 0, penurie: 6 });
    expect(split(6, shortfall(0, 9))).toEqual({ disette: 0, penurie: 6 });
  });

  test('only unpaid food: all disette; a mix is shared in the same proportion', () => {
    expect(split(6, shortfall(9, 0))).toEqual({ disette: 6, penurie: 0 });
    expect(split(6, shortfall(2, 4))).toEqual({ disette: 2, penurie: 4 });
  });

  test('the risk of hunger is what the day left unmet, by cause, never more than the inhabitants', () => {
    const day = (dayUnpaid, dayShortage) => ({ current: { year: 1, monthIndex: 4, byNeed: { [totalKey]: { unpaid: 9, shortage: 9, dayUnpaid, dayShortage } } }, previous: null });
    const risk = (pop, supplyShortfall) => hungerRiskOfHouse({ pop, houseType, supplyShortfall });
    expect(risk(6, null)).toEqual({ disette: 0, penurie: 0 });
    expect(risk(6, day(2, 3))).toEqual({ disette: 2, penurie: 3 });
    expect(risk(4, day(3, 3))).toEqual({ disette: 3, penurie: 1 });
  });

  test('the record of another month says nothing of this consumption', () => {
    expect(split(6, { current: { year: 1, monthIndex: 5, byNeed: { [totalKey]: { unpaid: 9, shortage: 0 } } }, previous: null })).toEqual({ disette: 0, penurie: 6 });
  });
});
