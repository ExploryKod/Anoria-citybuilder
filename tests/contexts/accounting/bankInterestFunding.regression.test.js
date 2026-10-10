import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';

// Regression: a bank earns no sale, no service, no goods flow — its only income is the interest the journal
// already holds for it (RecordLoanInterestExpense.js's lender mirror line, read via sumBankInterestByBuilding).
// Without folding that fourth source into salesHT, a bank could never fund its own wages or corporate tax from
// what it actually earns.
const BANK = 'Bank';

function settle(bankInterest, otherExpenses = []) {
  const journal = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
    listBuildings: async () => [
      { id: 'bank-1', type: BANK, workerSources: { 'house-1': 3 } },
      { id: 'house-1', type: 'House-Blue', workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => bankInterest,
    sumOtherExpensesByBuilding: async () => otherExpenses,
    listHouses: async () => [],
    getPublicPay: async () => ({ salaryPerMonth: 0, unemploymentBenefitRate: 0 }),
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
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

describe('a bank funds its own wages and corporate tax from the interest it earned', () => {
  test('loan interest becomes the bank\'s salesHT, which pays its workers and its IS', async () => {
    const journal = await settle([{ buildingId: 'bank-1', amountHT: 1000 }]);

    const wage = journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1');
    expect(wage).toBeDefined();
    expect(wage.amount).toBe(100); // 1000 * WAGE_RATE_BY_ROLE.finance (0.1)

    const householdWage = journal.find((line) => line.type === 'household_wage' && line.accountBuildingId === 'house-1');
    expect(householdWage).toBeDefined();
    expect(householdWage.amount).toBe(100);

    const tax = journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1');
    expect(tax).toBeDefined();
    expect(tax.amount).toBe(225); // (1000 - 100 wages - 0 upkeep) * CORPORATE_TAX_RATE (0.25)
  });

  test('no interest earned means no wage and no tax for the bank that month', async () => {
    const journal = await settle([]);

    expect(journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1')).toBeUndefined();
    expect(journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1')).toBeUndefined();
  });

  test('deposit interest the bank already paid its savers reduces its taxable profit, not just its cash', async () => {
    const journal = await settle(
      [{ buildingId: 'bank-1', amountHT: 1000 }],
      [{ buildingId: 'bank-1', amountHT: 300 }], // SettleBankDepositInterest.js's deposit_interest_paid, already booked
    );

    const wage = journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1');
    expect(wage.amount).toBe(100); // wages are a share of sales (salesHT), unaffected by this expense

    const tax = journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1');
    expect(tax.amount).toBe(150); // (1000 - 100 wages - 0 upkeep - 300 deposit interest) * 0.25, vs 225 without it
  });
});
