import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';

// A worker who is sick is not paid by his employer. With the social security chosen, the city's social body (431) pays his household an allowance:
// half of the wage he would have earned, less the waiting period (a tenth of the month). With no cover, nobody does.
function settle({ sicknessCover, absent = { 'house-1': 1 }, invalid = 0 }) {
  const journal = [];
  // The workers who do not work are the sick (`absent`), house by house; the invalid (`invalid`, of the house) hold no post.
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 5, month: 'Juin' }),
    listBuildings: async () => [
      { id: 'bank-1', type: 'Bank', workerSources: { 'house-1': 4 }, absentSources: absent, sickAbsentSources: absent },
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
    listHouses: async () => [{ id: 'house-1', pop: 4, salaried: 0, invalid }],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0, sicknessCover }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 1e6, rate1: 0, threshold2: 1e6, rate2: 0 }),
    getCorporateTaxRate: async () => 0,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    readCompanyYear: companyYearReaderOf(journal),
    readHouseholdYear: householdYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push(booked(line));
      return { recorded: true };
    },
  });
  journal.push(booked({ type: 'loan_interest_received', amount: 1000, accountBuildingId: 'bank-1' }));
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('sickness — the employer pays the ones at work, the social security the sick', () => {
  test('secu: the payroll leaves the absent out, the city pays his household half of his wage less the waiting period', async () => {
    const journal = await settle({ sicknessCover: 'secu' });

    expect(journal.find((line) => line.type === 'producer_wage').amount).toBe(300); // 3 at work of 4 assigned
    // 1 absent × 100 × 50 % × (1 − 10 %) = 45, out of the social body's account (431) and into the household's payslip (437).
    expect(journal.find((line) => line.type === 'sickness_benefit')).toMatchObject({ amount: 45, accountBuildingId: null, counterpartyBuildingId: 'house-1' });
    expect(journal.find((line) => line.type === 'household_sickness_benefit')).toMatchObject({ amount: 45, accountBuildingId: 'house-1', accountKind: 'particulier', journal: 'PA' });
    expect(unpairedFlowsOf(journal).lonely).toEqual([]);
  });

  // An invalid resident is paid a flat pension from the first day (half of the base of the benefits, whatever he earned, no waiting period), a sick worker an allowance after it;
  // both from the same fund.
  test('secu: an invalid resident is paid the flat pension with no waiting period, beside the sick one\'s allowance', async () => {
    const invalidOnly = await settle({ sicknessCover: 'secu', absent: {}, invalid: 1 });
    expect(invalidOnly.find((line) => line.type === 'sickness_benefit')).toMatchObject({ amount: 50, accountBuildingId: null }); // 1 × base 100 × 50 %
    expect(invalidOnly.some((line) => line.type === 'unemployment_benefit' || line.type === 'household_benefit')).toBe(false); // he is no job seeker

    const both = await settle({ sicknessCover: 'secu', absent: { 'house-1': 1 }, invalid: 1 });
    expect(both.find((line) => line.type === 'producer_wage').amount).toBe(300);
    expect(both.find((line) => line.type === 'sickness_benefit').amount).toBe(95); // 45 of allowance (after the waiting period) + 50 of pension
    expect(unpairedFlowsOf(both).lonely).toEqual([]);
  });

  test('no cover: the invalid are paid by no one either', async () => {
    const journal = await settle({ sicknessCover: 'none', absent: {}, invalid: 1 });

    expect(journal.some((line) => line.type === 'sickness_benefit')).toBe(false);
  });

  test('a sick worker keeps his job: he is not unemployed, so no unemployment benefit is paid for him', async () => {
    const journal = await settle({ sicknessCover: 'secu' });

    expect(journal.some((line) => line.type === 'unemployment_benefit' || line.type === 'household_benefit')).toBe(false);
  });

  test('no cover: the payroll still leaves the absent out, and nobody pays him', async () => {
    const journal = await settle({ sicknessCover: 'none' });

    expect(journal.find((line) => line.type === 'producer_wage').amount).toBe(300);
    expect(journal.some((line) => line.type === 'sickness_benefit' || line.type === 'household_sickness_benefit')).toBe(false);
  });

  test('nobody sick: the cover is not even read, the month settles as it always did', async () => {
    const journal = await settle({ sicknessCover: undefined, absent: {} });

    expect(journal.find((line) => line.type === 'producer_wage').amount).toBe(400);
  });
});
