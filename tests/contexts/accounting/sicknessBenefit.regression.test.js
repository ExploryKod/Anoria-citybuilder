import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';

// A worker who is sick is not paid by his employer. With the social security chosen, the city's social body (431) pays his household an allowance:
// half of the wage he would have earned, less the waiting period (a tenth of the month). With no cover, nobody does.
function settle({ sicknessCover, absent = { 'house-1': 1 } }) {
  const journal = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 5, month: 'Juin' }),
    listBuildings: async () => [
      { id: 'bank-1', type: 'Bank', workerSources: { 'house-1': 4 }, absentSources: absent },
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
    listHouses: async () => [{ id: 'house-1', pop: 4, salaried: 0 }],
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
