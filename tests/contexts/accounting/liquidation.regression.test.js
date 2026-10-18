import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { LiquidateCompanies } from '../../../src/contexts/accounting/application/services/LiquidateCompanies.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { payablesOf } from '../../../src/contexts/accounting/domain/policies/DebtPolicy.js';
import { liquidatedIdsOf } from '../../../src/contexts/accounting/domain/policies/LiquidationPolicy.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';

const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';
const timeInfoOf = (turn) => ({ year: 1, monthIndex: turn, month: `Mois ${turn}` });

// A company that has not paid for the whole grace period is liquidated: its stock is sold, it is closed (nothing new is charged), and what it still owes is
// forgiven — the workers' wages being paid by the city's guarantee.
function world({ cash }) {
  const journal = [];
  const recordLedgerEntry = async (line) => {
    journal.push({ ...line, year: 1, month: line.turn + 1 });
    return { recorded: true };
  };
  const settle = new SettleProducerCharges({
    getTimeInfo: timeInfoOf,
    listBuildings: async () => [
      { id: 'farm', type: FARM, workerSources: { house: 4 } },
      { id: 'house', type: HOUSE, workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    companyFundsOf: async () => cash.value,
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
    recordLedgerEntry,
    recordEconomyMovement: async () => {},
  });
  const liquidation = new LiquidateCompanies({
    getTimeInfo: timeInfoOf,
    listCompanies: async () => [{ id: 'farm', type: FARM }],
    getJournalEntries: async () => journal,
    valueStock: async () => [{ value: 100 }],
    getOwner: async () => null,
    recordLedgerEntry,
  });
  return { journal, settle, liquidation };
}

const amountOf = (journal, type) => journal.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0);

describe('the liquidation of a company', () => {
  test('after the grace period its stock is sold, it is charged nothing new, and what it cannot pay is forgiven with the wages guaranteed by the city', async () => {
    const cash = { value: 0 };
    const { journal, settle, liquidation } = world({ cash });
    for (const month of [3, 4, 5]) await settle.execute({ time: month, deliveredTime: month - 1 });
    expect(await liquidation.begin({ time: 6, deliveredTime: 5 })).toEqual(['farm']);
    expect(liquidatedIdsOf(journal).has('farm')).toBe(true);
    expect(amountOf(journal, 'liquidation_stock_sale')).toBe(50);

    cash.value = 50;
    await settle.execute({ time: 6, deliveredTime: 5 });
    await liquidation.end({ time: 6, deliveredTime: 5 });

    // Closed: three months of charges were booked as debts, the liquidation month added none, and the 50 recovered paid the wages first.
    expect(amountOf(journal, 'od_payable_wage')).toBe(1200);
    expect(amountOf(journal, 'wage_debt_paid')).toBe(50);
    // The rest of the wages is paid by the city to the workers' house; the other debts are written off at their creditor.
    expect(amountOf(journal, 'od_forgiven_wage')).toBe(1150);
    expect(amountOf(journal, 'wage_guarantee_paid')).toBe(1150);
    expect(amountOf(journal, 'od_forgiven_contribution')).toBe(120);
    expect(amountOf(journal, 'od_bad_debt_contribution')).toBe(120);
    expect(payablesOf(journal).size).toBe(0);
    expect(unpairedFlowsOf(journal).lonely).toEqual([]);

    // Once everything is written, a company is not liquidated again, and nothing is written twice.
    expect(await liquidation.begin({ time: 7, deliveredTime: 6 })).toEqual([]);
  });

  test('a company that pays its debts in time is never liquidated', async () => {
    const cash = { value: 100000 };
    const { settle, liquidation } = world({ cash });
    for (const month of [3, 4, 5]) await settle.execute({ time: month, deliveredTime: month - 1 });
    expect(await liquidation.begin({ time: 6, deliveredTime: 5 })).toEqual([]);
  });
});
