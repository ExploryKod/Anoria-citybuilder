import { describe, expect, test } from '@jest/globals';
import { freshnessFactor, freshnessFactorOfNthUnit } from '../../../src/contexts/supply/domain/policies/FreshnessPricePolicy.js';
import { purchasesOfDeliveries } from '../../../src/contexts/supply/domain/policies/DeliveryPurchasePolicy.js';
import { shareByExpenditure } from '../../../src/contexts/supply/domain/policies/ExpenditureSharePolicy.js';
import { purchasingPower } from '../../../src/contexts/supply/domain/policies/SupplierCreditPolicy.js';
import { getFreshnessPriceCurve } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';

// The default: full price while more than half the life is left, then a straight line down to 40 % on the day it goes bad.
const curve = getFreshnessPriceCurve('carrot');

describe('the price of a unit follows its freshness', () => {
  test('full price while more than half the life is left, 40 % when it goes bad, a straight line between', () => {
    const at = (remainingTurns) => freshnessFactor({ remainingTurns, lifeTurns: 20, curve });

    expect(at(20)).toBe(1);
    expect(at(10)).toBe(1);
    expect(at(5)).toBeCloseTo(0.7);
    expect(at(0)).toBeCloseTo(0.4);
    expect(freshnessFactor({ remainingTurns: 3, lifeTurns: Infinity, curve })).toBe(1);
  });

  test('the units of a stock are priced oldest first: the stale batch is cheaper than the fresh one', () => {
    const ages = [[0, 4], [18, 6]];
    const factor = (nth) => freshnessFactorOfNthUnit({ ages, nth, turn: 20, lifeTurns: 20, curve });

    expect(factor(0)).toBeCloseTo(0.4);
    expect(factor(3)).toBeCloseTo(0.4);
    expect(factor(4)).toBe(1);
    expect(() => factor(10)).toThrow('no unit number 10');
  });

  test('the units of a house at different prices are one purchase for the accounting, and what the house paid is kept', () => {
    const transfers = [
      { consumerId: 'house', category: 'carrot', amount: 1, unitPrice: 0.4 },
      { consumerId: 'house', category: 'carrot', amount: 1, unitPrice: 0.4 },
      { consumerId: 'house', category: 'carrot', amount: 1, unitPrice: 1 },
      { consumerId: 'house', category: 'wheat', amount: 1, unitPrice: 0.5 },
    ];

    const purchases = purchasesOfDeliveries(transfers);

    expect(purchases).toHaveLength(2);
    const carrots = purchases.find((purchase) => purchase.category === 'carrot');
    expect(carrots.units).toBe(3);
    expect(Math.round(carrots.units * carrots.unitPrice * 100)).toBe(180);
    expect(() => purchasesOfDeliveries([{ consumerId: 'house', category: 'carrot', amount: 1 }])).toThrow('carries no price');
  });
});

describe('the purchase of a buyer is shared by what it spends, not by units', () => {
  test('a good sold off is bought in larger quantity, and a good that runs out leaves the rest to the others', () => {
    // Good 0 costs 1 a unit, good 1 costs 2: the same money buys twice the units of the first.
    const priced = shareByExpenditure({ caps: [10, 10], units: 6, priceOf: (index) => [1, 2][index], budget: Infinity });
    expect(priced.amounts).toEqual([4, 2]);
    expect(priced.spent).toEqual([4, 4]);

    const short = shareByExpenditure({ caps: [1, 10], units: 6, priceOf: (index) => [1, 2][index], budget: Infinity });
    expect(short.amounts).toEqual([1, 5]);
  });

  test('the budget stops the purchase: no unit goes over it', () => {
    const limited = shareByExpenditure({ caps: [10, 10], units: 6, priceOf: (index) => [1, 2][index], budget: 5 });
    expect(limited.spent.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(5);
    expect(limited.amounts.reduce((sum, value) => sum + value, 0)).toBeLessThan(6);
    expect(shareByExpenditure({ caps: [10], units: 6, priceOf: () => 1, budget: 0 }).amounts).toEqual([0]);
  });

  test('a company buys on its suppliers\' credit: its cash, plus the sales its credit covers, less what it already bought this month', () => {
    const power = (parts) => purchasingPower(parts);
    expect(power({ cash: 30, creditLine: 100, committed: 0 })).toBe(130);
    expect(power({ cash: -50, creditLine: 100, committed: 20 })).toBe(30);
    // Deep in debt, it buys nothing until its sales bring money in; it is never lent below zero.
    expect(power({ cash: -500, creditLine: 100, committed: 0 })).toBe(0);
  });
});
