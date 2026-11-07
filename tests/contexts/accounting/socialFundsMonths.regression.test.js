import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { CloseMonthAccounts } from '../../../src/contexts/accounting/application/services/CloseMonthAccounts.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { HEALTH_FUND_ACCOUNT, UNEMPLOYMENT_FUND_ACCOUNT } from '../../../src/shared/accounting-catalog/SocialFundsCatalog.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';

// Several months of the real settlement and closing, folded like the journal: a bank whose 3 workers come from a house of 6 (3 unemployed) pays its contributions,
// the unemployed are paid out of the unemployment fund, and the allocation of each closing is what feeds that fund.
const HAMLET = 'hamlet-1';

async function runMonths(months, { sicknessCover = 'none', absent = {} } = {}) {
  const journal = [];
  const stamp = (line, monthIndex) => booked({ ...line, hamletId: HAMLET, year: 1, month: monthIndex + 1, turn: line.turn ?? monthIndex * 10 });
  for (let monthIndex = 0; monthIndex < months; monthIndex += 1) {
    const timeInfo = { year: 1, monthIndex, month: `M${monthIndex}` };
    const record = async (line) => {
      if (line.businessKey && journal.some((previous) => previous.businessKey === line.businessKey)) return { recorded: false, reason: 'duplicate_business_key' };
      journal.push(stamp(line, monthIndex));
      return { recorded: true };
    };
    journal.push(stamp({ type: 'loan_interest_received', amount: 1000, accountBuildingId: 'bank-1' }, monthIndex));
    await new SettleProducerCharges({
      getTimeInfo: () => timeInfo,
      listBuildings: async () => [
        { id: 'bank-1', type: 'Bank', workerSources: { 'house-1': 3 }, absentSources: absent },
        { id: 'house-1', type: 'House-Blue', workerSources: {}, absentSources: {} },
      ],
      sumGoodsFlowsByPair: async () => [],
      sumServiceFlows: async () => [],
      getServiceSubsidies: async () => ({}),
      getServicePrice: () => 0,
      fundsOf: async () => 0,
      companyFundsOf: async () => 1e9,
      getJournalEntries: async () => [],
      getVatRates: async () => ({}),
      sumHouseSales: async () => [],
      sumBankInterestByBuilding: async () => [{ buildingId: 'bank-1', amountHT: 1000 }],
      sumOtherExpensesByBuilding: async () => [],
      listHouses: async () => [{ id: 'house-1', pop: 6, salaried: 0 }],
      getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0.25, employeeContributionRate: 0.1, administratorStipend: 0, sicknessCover }),
      getWageRateOf: async () => () => 100,
      getSalaryTax: async () => ({ threshold1: 1e6, rate1: 0, threshold2: 1e6, rate2: 0 }),
      getCorporateTaxRate: async () => 0,
      getHouseMaintenanceSubsidyRate: async () => 1,
      listSpoilage: async () => [],
      recordServiceCutOff: async () => {},
      buildingMaintenanceCost: () => 0,
      readCompanyYear: companyYearReaderOf(journal),
      readHouseholdYear: householdYearReaderOf(journal),
      recordLedgerEntry: record,
    }).execute({ time: monthIndex * 10 + 2, deliveredTime: monthIndex * 10 + 1 });
    await new CloseMonthAccounts({
      getTimeInfo: () => timeInfo,
      listStockAccounts: async () => [],
      valueStock: async () => [],
      getOwnerHoldings: async () => null,
      getJournalEntries: async () => journal,
      recordLedgerEntry: record,
    }).execute({ time: monthIndex * 10 + 2, deliveredTime: monthIndex * 10 + 1 });
  }
  const fold = new LegsFold();
  for (const entry of journal) fold.add(entry);
  // What the city holds for a fund: credits less debits (centimes), negative when the fund is in deficit.
  const held = (account) => -fold.balanceOf(account, { hamletId: HAMLET, accountKey: null });
  return { journal, held };
}

describe('social funds over several months', () => {
  test('the unemployment fund is fed by the allocation only, a third of the month\'s contributions, and pays the unemployed out of it', async () => {
    const { journal, held } = await runMonths(3);

    const contributions = journal.filter((line) => line.type === 'social_contribution' && line.accountBuildingId === null).reduce((sum, line) => sum + line.amount, 0);
    const allocations = journal.filter((line) => line.type === 'od_social_allocation');
    const benefits = journal.filter((line) => line.type === 'unemployment_benefit').reduce((sum, line) => sum + line.amount, 0);

    expect(allocations).toHaveLength(3);
    expect(allocations.reduce((sum, line) => sum + line.amount, 0)).toBeCloseTo(contributions / 3, 2);
    // The unemployment fund only ever receives the allocation, and only pays the benefit.
    expect(held(UNEMPLOYMENT_FUND_ACCOUNT) / 100).toBeCloseTo(contributions / 3 - benefits, 2);
  });

  test('what the city holds across both funds is the contributions it received less every benefit it paid: the allocation moves nothing out of the city', async () => {
    const { journal, held } = await runMonths(3, { sicknessCover: 'secu', absent: { 'house-1': 1 } });

    const amount = (type) => journal.filter((line) => line.type === type && line.accountBuildingId === null).reduce((sum, line) => sum + line.amount, 0);
    const total = (held(HEALTH_FUND_ACCOUNT) + held(UNEMPLOYMENT_FUND_ACCOUNT)) / 100;

    expect(amount('sickness_benefit')).toBeGreaterThan(0);
    expect(total).toBeCloseTo(amount('social_contribution') - amount('unemployment_benefit') - amount('sickness_benefit'), 2);
  });
});
