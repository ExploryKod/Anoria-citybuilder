import { describe, test, expect } from '@jest/globals';
import { buildingFinanceFigures, householdBudgetOf, householdLastMonthOf } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

describe('building finance — a company account is the sum of its own lines, by month and by year', () => {
  test('the net result is sales less purchases, wages, upkeep and corporate tax, and other accounts are left out', () => {
    const line = (type, amount, month, accountBuildingId = 'farm') => ({ type, amount, year: 2026, month, accountBuildingId });
    const entries = [
      line('producer_revenue', 1000, 3),
      line('producer_purchase', 400, 3),
      line('producer_wage', 90, 3),
      line('maintenance', 10, 3),
      line('corporate_tax', 125.5, 3),
      line('producer_revenue', 300, 3, 'market'),
      line('producer_revenue', 200, 4),
    ];

    const march = buildingFinanceFigures(entries, 'farm', { year: 2026, month: 3 });

    expect(march.revenueHT).toBe(1000);
    expect(march.grossMargin).toBe(600);
    expect(march.operatingResult).toBe(500);
    expect(march.netResult).toBe(374.5);
    expect(buildingFinanceFigures(entries, 'farm', { year: 2026 }).revenueHT).toBe(1200);
  });

  test('a house has no costs: its account is the wages it received', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 2, accountBuildingId: 'house-1' },
      { type: 'household_wage', amount: 15.1, year: 2026, month: 2, accountBuildingId: 'house-1' },
    ];

    expect(buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2 }).wagesReceived).toBe(75.1);
  });

  test('a house keeps its two accounts apart: the wages and the business sales never mix', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'producer_revenue', amount: 20, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'entreprise' },
    ];

    const personal = buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2, accountKind: 'particulier' });
    const business = buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2, accountKind: 'entreprise' });

    expect(personal.wagesReceived).toBe(60);
    expect(personal.revenueHT).toBe(0);
    expect(business.revenueHT).toBe(20);
    expect(business.wagesReceived).toBe(0);
  });
});

describe('household budget — a house buys with its savings, last month\'s salary, less its services', () => {
  test('the budget is the balance before the month\'s purchases; the savings kept are what is left after them', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'service_purchase', amount: 10, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'consumer_purchase', amount: 25, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'household_wage', amount: 100, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'particulier' },
    ];

    const budget = householdBudgetOf(entries, 'house-1', { year: 2026, month: 3, balance: 125 });

    expect(budget).toEqual({ carried: 100, wages: 60, services: 10, purchases: 25, budget: 150, saved: 125 });
  });

  test('a civil servant\'s salary, a benefit and the income tax withheld are known lines too, not a crash', () => {
    const entries = [
      { type: 'public_wage', amount: 100, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'household_benefit', amount: 70, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'income_tax', amount: 12, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
    ];

    const budget = householdBudgetOf(entries, 'house-1', { year: 2026, month: 3, balance: 158 });

    expect(budget).toEqual({ carried: 0, wages: 170, services: 12, purchases: 0, budget: 158, saved: 158 });
  });

  test('a house\'s last month reads its salary and services from the settlement and its goods from the month they were bought', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'public_wage', amount: 100, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'household_benefit', amount: 70, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'service_purchase', amount: 5, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'income_tax', amount: 12, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'consumer_purchase', amount: 20, year: 2026, month: 3, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'consumer_purchase', amount: 9, year: 2026, month: 4, accountBuildingId: 'house-1', accountKind: 'particulier' },
    ];

    const last = householdLastMonthOf(entries, 'house-1', { settled: { year: 2026, month: 4 }, bought: { year: 2026, month: 3 } });

    expect(last).toEqual({
      wagesReceived: 60,
      publicWageReceived: 100,
      benefitReceived: 70,
      servicesPaid: 5,
      incomeTax: 12,
      goodsBought: 20,
      householdResult: 193,
    });
  });
});
