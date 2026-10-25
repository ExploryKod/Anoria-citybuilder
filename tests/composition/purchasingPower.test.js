import { describe, expect, test } from '@jest/globals';
import { purchasingPowerOf } from '../../src/composition/purchasingPower.js';

const basket = (houseId, pop, cost, unitPrice = 1) => ({ houseId, pop, cost, needs: [{ totalKey: 'food', unitPrice }] });
const household = (id, type, income, mandatory) => ({ id, type, savings: 100, income, mandatory, goodsBought: 5 });

describe('the purchasing power of the houses', () => {
  test('each kind of house gets its living margin (income less what is imposed) against the cost of its basket, and says how many houses fall short', () => {
    const [kind] = purchasingPowerOf({
      households: [household('a', 'House-Blue', 40, 10), household('b', 'House-Blue', 20, 15)],
      baskets: [basket('a', 4, 20), basket('b', 2, 10)],
    });

    expect(kind.houses).toBe(2);
    expect(kind.residents).toBe(6);
    expect(kind.perHouse).toMatchObject({ income: 30, mandatory: 12.5, livingMargin: 17.5, basket: 15 });
    expect(kind.coverage).toBeCloseTo(1.17, 2);
    // House b keeps 5 of income for a basket of 10.
    expect(kind.housesShort).toBe(1);
  });

  test('a house the supply does not know throws, and a need no market prices is told apart, never given a price', () => {
    expect(() => purchasingPowerOf({ households: [household('a', 'House-Blue', 1, 0)], baskets: [] })).toThrow('has no basket');
    const [kind] = purchasingPowerOf({ households: [household('a', 'House-Blue', 1, 0)], baskets: [basket('a', 1, 0, null)] });
    expect(kind.unpriced).toEqual(['food']);
    expect(kind.coverage).toBeNull();
  });
});

describe('the session API', () => {
  test('exposes the purchasing power on the supply side, joined from the accounting and the supply (regression: it was wired where `accounting` did not exist)', async () => {
    const { assembleSessionApi } = await import('../../src/composition/sessionApi.js');
    const accounting = { getHouseholdBudgets: async () => ({ ready: true, year: 1, months: 12, households: [household('a', 'House-Blue', 40, 10)] }) };
    const supply = { describeResidentBasket: async () => [basket('a', 4, 20)] };

    const api = assembleSessionApi({ construction: {}, accounting, supply });
    const power = await api.supply.describePurchasingPower();

    expect(power).toMatchObject({ ready: true, year: 1, months: 12 });
    expect(power.kinds[0]).toMatchObject({ type: 'House-Blue', houses: 1 });
  });
});

describe('the economy in the session API', () => {
  test('joins the accounting\'s reading of the hamlet with the markets\' baskets, on the supply side', async () => {
    const { assembleSessionApi } = await import('../../src/composition/sessionApi.js');
    const publicDebt = { gross: 50, net: 40, loans: 50, domesticLoans: 50 };
    const accounting = { getHamletEconomy: async () => ({ ready: true, population: 10, gdp: 200, gni: 200, publicDebt, privateDebt: { total: 0 }, householdSavings: 0 }) };
    const supply = { describeResidentBasket: async () => [{ needs: [{ unitPrice: 1, cost: 10, referenceCost: 10 }] }] };

    const economy = await assembleSessionApi({ construction: {}, accounting, supply }).supply.describeEconomy();

    expect(economy).toMatchObject({ parity: 1, gdpPpp: 200 });
  });
});
