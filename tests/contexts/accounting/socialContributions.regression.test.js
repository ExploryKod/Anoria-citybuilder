import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { employeeContributionLines, employerContributionLines } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { pcgOfJournalType } from '../../../src/shared/accounting-catalog/PcgJournalCatalog.js';

// The social contributions: the employer pays a share of the gross wage on top (a charge, 645), the employee has a share withheld from it, both reach
// the city's social security (which pays the unemployment benefit). The income tax is on the wage after the employee's share.
function settle({ employerContributionRate, employeeContributionRate }) {
  const journal = [];
  const service = new SettleProducerCharges({
    // The month delivered is the last of the year: the settlement that closes the fiscal year, the one that books the corporate tax.
    getTimeInfo: () => ({ year: 1, monthIndex: 11, month: 'Décembre' }),
    listBuildings: async () => [
      { id: 'bank-1', type: 'Bank', workerSources: { 'house-1': 3 } },
      { id: 'house-1', type: 'House-Blue', workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [{ buildingId: 'bank-1', amountHT: 1000 }],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [{ id: 'house-1', pop: 3 }],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0, employerContributionRate, employeeContributionRate }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 }),
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push(line);
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  // The interest the bank earned is already in the journal (another settlement wrote it): the company's statement reads it there.
  journal.push({ type: 'loan_interest_received', amount: 1000, accountBuildingId: 'bank-1' });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('social contributions — employer, employee, and the city\'s social security', () => {
  test('the employer pays a share of the payroll on top, the city receives it', () => {
    expect(employerContributionLines({ workplaceId: 'farm', wagesHT: 300, rate: 0.25 })).toEqual([
      { kind: 'employer_contribution', amount: 75, holder: 'farm', counterparty: null },
      { kind: 'social_contribution', amount: 75, holder: null, counterparty: 'farm' },
    ]);
    expect(employerContributionLines({ workplaceId: 'farm', wagesHT: 300, rate: 0 })).toEqual([]);
  });

  test('the employee\'s share is withheld from the household\'s personal account, the city receives it', () => {
    expect(employeeContributionLines({ houseId: 'house-1', wagesReceived: 300, rate: 0.1 })).toEqual([
      { kind: 'employee_contribution', amount: 30, holder: 'house-1', counterparty: null, accountKind: 'particulier' },
      { kind: 'social_contribution', amount: 30, holder: null, counterparty: 'house-1' },
    ]);
  });

  test('a month\'s settlement writes both, deducts the employer\'s from the company\'s taxable profit and taxes the wage after the employee\'s share', async () => {
    const journal = await settle({ employerContributionRate: 0.25, employeeContributionRate: 0.1 });

    expect(journal.find((line) => line.type === 'producer_wage').amount).toBe(300);
    expect(journal.find((line) => line.type === 'employer_contribution')).toMatchObject({ amount: 75, accountBuildingId: 'bank-1' });
    expect(journal.find((line) => line.type === 'employee_contribution')).toMatchObject({ amount: 30, accountBuildingId: 'house-1', accountKind: 'particulier' });
    // Both reach the city: 75 from the company and 30 from the household, on the city's own account.
    const received = journal.filter((line) => line.type === 'social_contribution');
    expect(received.map((line) => line.amount).sort((a, b) => a - b)).toEqual([30, 75]);
    expect(received.every((line) => line.accountBuildingId === null)).toBe(true);
    // The tax is on the wage after the employee's share (270), and the corporate tax on the profit after the wages and the employer's share.
    expect(journal.find((line) => line.type === 'income_tax').amount).toBe(27);
    expect(journal.find((line) => line.type === 'corporate_tax').amount).toBe(156.25); // (1000 − 300 − 75) × 25 %
  });

  test('with no contribution rate nothing is written and the wage is taxed whole', async () => {
    const journal = await settle({ employerContributionRate: 0, employeeContributionRate: 0 });

    expect(journal.some((line) => ['employer_contribution', 'employee_contribution', 'social_contribution'].includes(line.type))).toBe(false);
    expect(journal.find((line) => line.type === 'income_tax').amount).toBe(30);
  });

  test('each type is known to the treasury and the chart of accounts', () => {
    expect(moneyDirectionOf({ type: 'employer_contribution', turn: 0 })).toBe('debit');
    expect(moneyDirectionOf({ type: 'employee_contribution', turn: 0 })).toBe('debit');
    expect(moneyDirectionOf({ type: 'social_contribution', turn: 0 })).toBe('credit');
    expect(pcgOfJournalType('employer_contribution').account).toBe('645');
  });
});
