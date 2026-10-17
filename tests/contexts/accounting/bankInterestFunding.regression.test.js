import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';

// Regression: a bank earns no sale, no service, no goods flow — its only income is the interest the journal
// already holds for it (RecordLoanInterestExpense.js's lender mirror line, read via sumBankInterestByBuilding).
// Without folding that fourth source into salesHT, a bank could never fund its own wages or corporate tax from
// what it actually earns.
const BANK = 'Bank';

function settle(bankInterest, otherExpenses = []) {
  const journal = [];
  const service = new SettleProducerCharges({
    // The month delivered is the last of the year: the settlement that closes the fiscal year, the one that books the corporate tax.
    getTimeInfo: () => ({ year: 1, monthIndex: 11, month: 'Décembre' }),
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
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    getCorporateTaxRate: async () => 0.25,
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push(line);
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  // The interest the bank earned and paid already is in the journal (another settlement wrote it): the company's statement reads it there.
  journal.push(
    ...bankInterest.map((interest) => ({ type: 'loan_interest_received', amount: interest.amountHT, accountBuildingId: interest.buildingId })),
    ...otherExpenses.map((expense) => ({ type: 'deposit_interest_paid', amount: expense.amountHT, accountBuildingId: expense.buildingId })),
  );
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('a bank funds its own wages and corporate tax from the interest it earned', () => {
  test('loan interest becomes the bank\'s salesHT: it pays its payroll from it, and its IS on what is left', async () => {
    const journal = await settle([{ buildingId: 'bank-1', amountHT: 1000 }]);

    const wage = journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1');
    expect(wage).toBeDefined();
    expect(wage.amount).toBe(300); // 3 workers × the reference salary (100) × the factor of level 1

    const householdWage = journal.find((line) => line.type === 'household_wage' && line.accountBuildingId === 'house-1');
    expect(householdWage).toBeDefined();
    expect(householdWage.amount).toBe(300);

    const tax = journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1');
    expect(tax).toBeDefined();
    expect(tax.amount).toBe(175); // (1000 - 300 wages - 0 upkeep) * CORPORATE_TAX_RATE (0.25)
  });

  test('no interest earned: the staffed bank still pays its payroll, and owes no tax that month', async () => {
    const journal = await settle([]);

    expect(journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1').amount).toBe(300);
    expect(journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1')).toBeUndefined();
  });

  test('deposit interest the bank already paid its savers reduces its taxable profit, not just its cash', async () => {
    const journal = await settle(
      [{ buildingId: 'bank-1', amountHT: 1000 }],
      [{ buildingId: 'bank-1', amountHT: 300 }], // SettleBankDepositInterest.js's deposit_interest_paid, already booked
    );

    const wage = journal.find((line) => line.type === 'producer_wage' && line.accountBuildingId === 'bank-1');
    expect(wage.amount).toBe(300); // the payroll follows the staffing, unaffected by this expense

    const tax = journal.find((line) => line.type === 'corporate_tax' && line.accountBuildingId === 'bank-1');
    expect(tax.amount).toBe(100); // (1000 - 300 wages - 0 upkeep - 300 deposit interest) * 0.25, vs 175 without it
  });
});
