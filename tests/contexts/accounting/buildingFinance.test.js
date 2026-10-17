import { describe, test, expect } from '@jest/globals';
import { buildingFinanceFigures, householdBudgetOf, householdLastMonthOf } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

const lineOf = (statement, lineId) => statement.sections.flatMap((section) => section.lines).find((line) => line.id === lineId).amount;

describe('building finance — a company account is a compte de résultat read from its own lines, by month and by year', () => {
  test('the result runs operating, current, then net: sales less purchases, wages, upkeep and corporate tax; other accounts are left out', () => {
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

    const march = buildingFinanceFigures(entries, 'farm', { year: 2026, month: 3, salesNature: 'production' }).statement;

    expect(lineOf(march, 'productionSold')).toBe(1000);
    expect(march.results.operating).toBe(500);
    expect(march.results.net).toBe(374.5);
    expect(lineOf(buildingFinanceFigures(entries, 'farm', { year: 2026, salesNature: 'production' }).statement, 'productionSold')).toBe(1200);
  });

  test('a merchant house\'s account counts what an import cost: price, freight and duty are in the commercial margin', () => {
    const line = (type, amount) => ({ type, amount, year: 3, month: 11, accountBuildingId: 'merchants', accountKind: 'entreprise:cooperative' });
    const entries = [
      line('import_coal', 16.2),
      line('freight_coal', 1.71),
      line('duty_paid_import_coal', 3.58),
      line('producer_revenue', 23.64),
    ];

    const { statement } = buildingFinanceFigures(entries, 'merchants', { year: 3, month: 11, accountKind: 'entreprise:cooperative', salesNature: 'merchandise' });

    expect(statement.goodsSold).toBe(23.64);
    expect(statement.commercialMargin).toBe(2.15); // sales − purchases − freight − import duty: the merchants' 10%
    expect(statement.results.net).toBe(2.15);
  });

  test('an export is a sale abroad, and its duty is an operating tax, not a cost of the goods', () => {
    const line = (type, amount) => ({ type, amount, year: 3, month: 5, accountBuildingId: 'merchants', accountKind: 'entreprise:cooperative' });
    const entries = [
      line('producer_purchase', 100),
      line('abroad_sale_book', 160),
      line('duty_paid_export_book', 16),
    ];

    const { statement } = buildingFinanceFigures(entries, 'merchants', { year: 3, month: 5, accountKind: 'entreprise:cooperative', salesNature: 'merchandise' });

    expect(statement.goodsSold).toBe(160);
    expect(statement.commercialMargin).toBe(60); // 160 − 100: the duty is not in it
    expect(lineOf(statement, 'taxes')).toBe(16);
    expect(statement.results.operating).toBe(44);
  });

  test('cash that is not a result (a loan, capital, construction) is not in the statement', () => {
    const entries = [
      { type: 'producer_revenue', amount: 50, year: 1, month: 1, accountBuildingId: 'farm' },
      { type: 'capital_funds', amount: 500, year: 1, month: 1, accountBuildingId: 'farm' },
      { type: 'construction', amount: 200, year: 1, month: 1, accountBuildingId: 'farm' },
    ];

    expect(buildingFinanceFigures(entries, 'farm', { year: 1, salesNature: 'production' }).statement.results.net).toBe(50);
  });

  test('the ratios read the statement: break-even is the fixed charges over the rate of margin on variable charges', () => {
    const line = (type, amount) => ({ type, amount, year: 1, month: 1, accountBuildingId: 'shop' });
    const entries = [
      line('producer_revenue', 100), // sales
      line('producer_purchase', 60), // variable: what the goods cost
      line('producer_wage', 10), // fixed: wages are not a cost of the quantity sold
      line('maintenance', 10), // fixed
    ];

    const { ratios } = buildingFinanceFigures(entries, 'shop', { year: 1, salesNature: 'merchandise' });

    expect(ratios.turnover).toBe(100);
    expect(ratios.variableCharges).toBe(60);
    expect(ratios.fixedCharges).toBe(20);
    expect(ratios.variableMarginRate).toBeCloseTo(0.4);
    expect(ratios.breakEven).toBeCloseTo(50, 2); // 20 ÷ 0.4
    expect(ratios.safetyIndex).toBeCloseTo(0.5, 2);
    expect(ratios.caf).toBe(20); // no depreciation in the game: the net result
  });

  test('the cost of a unit sets the month\'s operating charges against the units sold, and shows where a wage makes a unit lose money', () => {
    const line = (type, amount) => ({ type, amount, year: 1, month: 1, accountBuildingId: 'farm' });
    const entries = [line('producer_revenue', 24), line('producer_wage', 72), line('maintenance', 2)];

    const { ratios } = buildingFinanceFigures(entries, 'farm', { year: 1, salesNature: 'production', unitsSold: 24 });

    expect(ratios.averagePrice).toBe(1); // 24 sold for 24
    expect(ratios.costPerUnit).toBe(3.08); // (72 + 2) / 24
    expect(ratios.resultPerUnit).toBe(-2.08);
  });

  test('units not read, or none sold, show no cost per unit rather than a zero', () => {
    const entries = [{ type: 'maintenance', amount: 2, year: 1, month: 1, accountBuildingId: 'farm' }];

    expect(buildingFinanceFigures(entries, 'farm', { year: 1, salesNature: 'production' }).ratios.costPerUnit).toBeNull();
    expect(buildingFinanceFigures(entries, 'farm', { year: 1, salesNature: 'production', unitsSold: 0 }).ratios.costPerUnit).toBeNull();
  });

  test('with no sales there is no break-even, not a zero', () => {
    const entries = [{ type: 'maintenance', amount: 2, year: 1, month: 1, accountBuildingId: 'plant' }];

    const { ratios } = buildingFinanceFigures(entries, 'plant', { year: 1, salesNature: 'services' });

    expect(ratios.breakEven).toBeNull();
    expect(ratios.variableMarginRate).toBeNull();
  });

  test('a statement is never read without its sales nature, and a sale on an account whose nature the catalog does not give throws', () => {
    expect(() => buildingFinanceFigures([], 'farm', { year: 1 })).toThrow(/sales nature/);
    const sale = [{ type: 'producer_revenue', amount: 10, year: 1, month: 1, accountBuildingId: 'bank' }];
    expect(() => buildingFinanceFigures(sale, 'bank', { year: 1, salesNature: null })).toThrow(/does not say/);
  });

  test('a service building\'s sales are services (706), not goods: they do not make a commercial margin', () => {
    const sale = [{ type: 'producer_revenue', amount: 40, year: 1, month: 1, accountBuildingId: 'school' }];

    const { statement } = buildingFinanceFigures(sale, 'school', { year: 1, salesNature: 'services' });

    expect(lineOf(statement, 'productionSold')).toBe(40);
    expect(statement.goodsSold).toBe(0);
  });

  test('a house has no statement for its personal account: its wages are a household budget', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'household_wage', amount: 15.1, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'particulier' },
    ];

    const figures = buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2, accountKind: 'particulier' });

    expect(figures.statement).toBeNull();
    expect(figures.wagesReceived).toBe(75.1);
  });

  test('a house keeps its two accounts apart: the wages and the business sales never mix', () => {
    const entries = [
      { type: 'household_wage', amount: 60, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'particulier' },
      { type: 'producer_revenue', amount: 20, year: 2026, month: 2, accountBuildingId: 'house-1', accountKind: 'entreprise:cooperative' },
    ];

    const personal = buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2, accountKind: 'particulier' });
    const business = buildingFinanceFigures(entries, 'house-1', { year: 2026, month: 2, accountKind: 'entreprise:cooperative', salesNature: 'production' });

    expect(personal.wagesReceived).toBe(60);
    expect(business.statement.results.net).toBe(20);
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
      participationReceived: 0,
      dividendReceived: 0,
      incomeTaxRefunded: 0,      servicesPaid: 5,
      rentPaid: 0,
      incomeTax: 12,
      citizenTax: 0,
      employeeContributionPaid: 0,
      goodsBought: 20,
      householdResult: 193,
      // What the two purchase lines add up: the service of the settlement month, the good of the month it was bought in.
      details: { services: [{ amount: 5 }], goods: [{ amount: 20 }] },
    });
  });
});
