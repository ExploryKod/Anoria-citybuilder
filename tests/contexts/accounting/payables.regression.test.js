import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { difficultyMonthsOf, payablesOf, payByRank } from '../../../src/contexts/accounting/domain/policies/DebtPolicy.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';

const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';

// A company that cannot pay what it owes owes it: it pays by rank (the wages first) as far as its money goes, books the rest as a debt, and pays the old
// debts first as soon as it has the money.
function settleMonth(journal, { monthIndex, cash }) {
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex, month: `Mois ${monthIndex}` }),
    listBuildings: async () => [
      { id: 'farm', type: FARM, workerSources: { house: 4 } },
      { id: 'house', type: HOUSE, workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    companyFundsOf: async () => cash,
    getJournalEntries: async () => journal,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0.1, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    getCorporateTaxRate: async () => 0,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 10,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: monthIndex + 1 });
      return { recorded: true };
    },
  });
  return service.execute({ time: monthIndex, deliveredTime: monthIndex - 1 });
}

const amountOf = (journal, type) => journal.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0);

describe('the debts of a company', () => {
  test('money is shared by rank, the lowest first and in proportion within a rank, never more than what is owed', () => {
    const { paid, left } = payByRank(500, [
      { id: 'wage-a', rank: 1, amount: 300 },
      { id: 'wage-b', rank: 1, amount: 100 },
      { id: 'tax', rank: 2, amount: 200 },
    ]);
    expect(paid.get('wage-a')).toBe(300);
    expect(paid.get('wage-b')).toBe(100);
    expect(paid.get('tax')).toBe(100);
    expect(left).toBe(0);
    const short = payByRank(200, [{ id: 'a', rank: 1, amount: 300 }, { id: 'b', rank: 1, amount: 100 }]);
    expect(short.paid.get('a') + short.paid.get('b')).toBe(200);
    expect(short.paid.get('a')).toBe(150);
  });

  // The company's month: 400 of wages and 40 of contributions.
  test('a company with 300 pays the wages first, then the contributions, and books what it cannot pay as debts', async () => {
    const journal = [];
    await settleMonth(journal, { monthIndex: 3, cash: 300 });
    expect(amountOf(journal, 'producer_wage')).toBe(300);
    expect(amountOf(journal, 'household_wage')).toBe(300);
    expect(amountOf(journal, 'od_payable_wage')).toBe(100);
    expect(amountOf(journal, 'employer_contribution')).toBe(0);
    expect(amountOf(journal, 'od_payable_contribution')).toBe(40);
    const debts = payablesOf(journal);
    expect([...debts.values()].map((debt) => [debt.kind, debt.creditorId, debt.centimes])).toEqual(
      expect.arrayContaining([['wage', 'house', 10000], ['contribution', null, 4000]]),
    );
  });

  test('a company with nothing pays nobody: every charge is a debt, the economy does not start without its founding capital', async () => {
    const journal = [];
    await settleMonth(journal, { monthIndex: 3, cash: 0 });
    expect(amountOf(journal, 'producer_wage')).toBe(0);
    expect(amountOf(journal, 'od_payable_wage')).toBe(400);
  });

  test('the next month the company pays its old debts first, the workers\' house and the city receiving what is paid', async () => {
    const journal = [];
    await settleMonth(journal, { monthIndex: 3, cash: 300 });
    await settleMonth(journal, { monthIndex: 4, cash: 1000 });
    expect(amountOf(journal, 'wage_debt_paid')).toBe(100);
    // The house received the 300 of the first month, then the 400 of the second and the 100 owed: every wage due, none lost.
    expect(amountOf(journal, 'household_wage')).toBe(800);
    expect(amountOf(journal, 'producer_wage')).toBe(700);
    expect(amountOf(journal, 'contribution_debt_paid')).toBe(40);
    // The city booked a receivable when the first month's contributions fell due, and collects it now: not a product a second time.
    expect(amountOf(journal, 'od_receivable_contribution')).toBe(40);
    expect(amountOf(journal, 'contribution_debt_received')).toBe(40);
    expect(amountOf(journal, 'social_contribution')).toBe(40);
    expect(unpairedFlowsOf(journal).lonely).toEqual([]);
    expect(payablesOf(journal).size).toBe(0);
  });

  test('a debt left open months in a row counts the months of difficulty, and none once it is paid', async () => {
    const journal = [];
    await settleMonth(journal, { monthIndex: 3, cash: 0 });
    await settleMonth(journal, { monthIndex: 4, cash: 0 });
    expect(difficultyMonthsOf(journal, 'farm', null, { year: 1, month: 6 }, 12)).toBe(3);
    await settleMonth(journal, { monthIndex: 5, cash: 100000 });
    expect(difficultyMonthsOf(journal, 'farm', null, { year: 1, month: 7 }, 12)).toBe(0);
  });
});
