import { describe, test, expect } from '@jest/globals';
import {
  buildingChargeLines,
  corporateTaxDueOf,
  corporateTaxLines,
  tradeLines,
  isLucrativeBuilding,
  payrollOf,
  wagePerWorkerOf,
  wageSplitLines,
} from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';

describe('trade lines — a sale and its purchase name each other, on each company account', () => {
  test('a sale between two companies is a revenue on the seller and a purchase on the buyer', () => {
    expect(tradeLines({ sellerId: 'farm', buyerId: 'market', amountHT: 100 })).toEqual([
      { kind: 'producer_revenue', amount: 100, holder: 'farm', counterparty: 'market' },
      { kind: 'producer_purchase', amount: 100, holder: 'market', counterparty: 'farm' },
    ]);
  });

  test('a sale to the houses has no buying company', () => {
    expect(tradeLines({ sellerId: 'market', buyerId: null, amountHT: 50 })).toEqual([
      { kind: 'producer_revenue', amount: 50, holder: 'market', counterparty: null },
    ]);
  });
});

describe('wages — each worker is paid the same, and the house it comes from receives it', () => {
  // The labour market's wage of a (skill, level): here a stand-in that pays 10 a level, so the test reads which pair a workplace asks for.
  const wageRateOf = (skill, level) => 10 * level;

  test('the payroll follows the staffing, not the sales: nothing without workers, the market wage of the skill and level for each worker with them', () => {
    expect(payrollOf({ type: 'Market-Stall-Red', workers: 0, wageRateOf })).toBe(0);
    expect(payrollOf({ type: 'Market-Stall-Red', workers: 3, wageRateOf })).toBe(30);
  });

  test('a workplace asks the market for the skill and the level its catalog entry requires', () => {
    // The hospital's workers need the medical skill at level 2.
    expect(payrollOf({ type: 'Hospital', workers: 2, wageRateOf })).toBe(40);
  });

  test('every lucrative workplace has a skill the labour market can give a wage to', () => {
    for (const [type, definition] of Object.entries(buildingCatalog)) {
      if (!definition.employment?.requiredSkill || !isLucrativeBuilding(type)) continue;
      expect({ type, wage: wagePerWorkerOf({ type, wageRateOf }) }).toEqual({ type, wage: expect.any(Number) });
    }
  });

  test('the wages split by workers per house, and the total is exact to the centime', () => {
    const lines = wageSplitLines({ workplaceId: 'market', wagesHT: 10, sources: { houseA: 1, houseB: 2 } });
    expect(lines.filter((line) => line.kind === 'household_wage')).toEqual([
      { kind: 'household_wage', amount: 3.33, holder: 'houseA', counterparty: 'market', accountKind: 'particulier' },
      { kind: 'household_wage', amount: 6.67, holder: 'houseB', counterparty: 'market', accountKind: 'particulier' },
    ]);
    const paid = lines.filter((line) => line.kind === 'producer_wage').reduce((sum, line) => sum + line.amount, 0);
    expect(Math.round(paid * 100) / 100).toBe(10);
  });
});

describe('building lines — a company pays its upkeep; a house is subsidised by the city', () => {
  test('a market stall books its upkeep on its account', () => {
    expect(buildingChargeLines({ id: 'market', type: 'Market-Stall-Red', maintenanceCost: 2 })).toEqual([
      { kind: 'maintenance', amount: 2, holder: 'market', counterparty: null },
    ]);
  });

  test('a house has no account: the city books its upkeep as the housing subsidy', () => {
    expect(buildingChargeLines({ id: 'house', type: 'House-Red', maintenanceCost: 3 })).toEqual([
      { kind: 'subsidy_housing', amount: 3, holder: null, counterparty: null },
    ]);
  });
});

describe('corporate tax — the rate on the résultat courant avant impôts of the year, never more', () => {
  test('the tax is the rate of the RCAI of the year so far (25 %), and it reaches the city', () => {
    expect(corporateTaxDueOf({ rcaiYearToDate: 92.81, taxPaidYearToDate: 0, rate: 0.25 })).toBe(23.2);
    expect(corporateTaxLines({ id: 'farm', amount: 23.2 })).toEqual([
      { kind: 'corporate_tax', amount: 23.2, holder: 'farm', counterparty: null },
      { kind: 'corporate_tax_revenue', amount: 23.2, holder: null, counterparty: null },
    ]);
  });

  test('a tax never turns a profit into a loss: what is owed over the year is the rate of the RCAI, whatever the months', () => {
    // A harvest month earns 400, then two lean months lose 100 each: 25 % of 400, then of 300, then of 200, less what was paid.
    const monthly = [400, 300, 200];
    let paid = 0;
    for (const rcai of monthly) paid += corporateTaxDueOf({ rcaiYearToDate: rcai, taxPaidYearToDate: paid, rate: 0.25 });
    expect(paid).toBe(100); // 25 % of the 400 of the first month: nothing is refunded afterwards
    expect(paid).toBeLessThanOrEqual(0.25 * 400);
  });

  test('a loss pays no corporate tax, and a year that already paid it owes nothing more', () => {
    expect(corporateTaxDueOf({ rcaiYearToDate: -165.15, taxPaidYearToDate: 0, rate: 0.25 })).toBe(0);
    expect(corporateTaxDueOf({ rcaiYearToDate: 400, taxPaidYearToDate: 100, rate: 0.25 })).toBe(0);
    // A rate of nothing (set by the player, or imposed while nobody collects the tax) levies nothing.
    expect(corporateTaxDueOf({ rcaiYearToDate: 400, taxPaidYearToDate: 0, rate: 0 })).toBe(0);
    expect(corporateTaxLines({ id: 'farm', amount: 0 })).toEqual([]);
  });
});
