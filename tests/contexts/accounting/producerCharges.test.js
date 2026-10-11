import { describe, test, expect } from '@jest/globals';
import {
  buildingChargeLines,
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

describe('building lines — a company pays its upkeep and its corporate tax; a house is subsidised by the city', () => {
  test('a market stall keeps its profit after its wages: the tax is its own, the tax reaches the city', () => {
    expect(
      buildingChargeLines({ id: 'market', type: 'Market-Stall-Red', salesHT: 100, subsidiesHT: 0, purchasesHT: 40, wagesHT: 15, maintenanceCost: 2 })
    ).toEqual([
      { kind: 'maintenance', amount: 2, holder: 'market', counterparty: null },
      { kind: 'corporate_tax', amount: 10.75, holder: 'market', counterparty: null },
      { kind: 'corporate_tax_revenue', amount: 10.75, holder: null, counterparty: null },
    ]);
  });

  test('a loss pays no corporate tax', () => {
    expect(
      buildingChargeLines({ id: 'market', type: 'Market-Stall-Red', salesHT: 10, subsidiesHT: 0, purchasesHT: 12, wagesHT: 0, maintenanceCost: 2 }).map(
        (line) => line.kind
      )
    ).not.toContain('corporate_tax');
  });

  test('a house has no account: the city books its upkeep as the housing subsidy', () => {
    expect(
      buildingChargeLines({ id: 'house', type: 'House-Red', salesHT: 0, subsidiesHT: 0, purchasesHT: 0, wagesHT: 0, maintenanceCost: 3 })
    ).toEqual([{ kind: 'subsidy_housing', amount: 3, holder: null, counterparty: null }]);
  });
});
