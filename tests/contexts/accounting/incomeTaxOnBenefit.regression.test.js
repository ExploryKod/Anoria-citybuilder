import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';

// Regression: the unemployment benefit is taxed exactly like a wage — folded into the same monthly gross per
// household, under the same brackets, no separate threshold or rate for it (decided 2026-10-09).
const HOUSE = 'House-Blue';

function settle({ pop, salaryPerMonth, unemploymentBenefitRate, taxRate }) {
  const journal = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
    listBuildings: async () => [{ id: 'house', type: HOUSE, workerSources: {} }],
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [{ id: 'house', pop }],
    getPublicPay: async () => ({ salaryPerMonth, unemploymentBenefitRate }),
    getSalaryTax: async () => taxRate,
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    recordLedgerEntry: async (line) => {
      journal.push(line);
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('income tax on the unemployment benefit — taxed together with wages, no separate threshold', () => {
  test('a fully unemployed household pays income tax on its benefit, at the same rate as a wage', async () => {
    // pop 3, no workplace: all 3 are unemployed. benefit = 3 * 100 * 0.7 = 210.
    const journal = await settle({
      pop: 3,
      salaryPerMonth: 100,
      unemploymentBenefitRate: 0.7,
      taxRate: { threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 }, // flat 10%, same shape as other regression tests
    });

    const benefit = journal.find((line) => line.type === 'household_benefit');
    expect(benefit.amount).toBe(210);

    const incomeTax = journal.find((line) => line.type === 'income_tax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax.amount).toBe(21); // 210 * 10%, same bracket as a wage would use
    expect(incomeTax.accountBuildingId).toBe('house');
    expect(incomeTax.accountKind).toBe('particulier');

    const payrollTax = journal.find((line) => line.type === 'payroll_tax');
    expect(payrollTax.amount).toBe(21);
  });

  test('below the exemption threshold, the benefit alone pays no income tax', async () => {
    const journal = await settle({
      pop: 3,
      salaryPerMonth: 100,
      unemploymentBenefitRate: 0.7,
      taxRate: { threshold1: 1000, rate1: 0.1, threshold2: 2000, rate2: 0.2 }, // 210 < threshold1
    });

    expect(journal.find((line) => line.type === 'household_benefit').amount).toBe(210);
    expect(journal.find((line) => line.type === 'income_tax')).toBeUndefined();
  });
});
