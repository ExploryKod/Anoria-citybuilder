import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';
import { employerContributionLines } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';
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
    companyFundsOf: async () => 1e9, // a company that can pay everything: these tests are not about debts
    getJournalEntries: async () => [],
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [{ buildingId: 'bank-1', amountHT: 1000 }],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [{ id: 'house-1', pop: 3, salaried: 0 }],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0, employerContributionRate, employeeContributionRate, administratorStipend: 0 }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 }),
    getCorporateTaxRate: async () => 0.25,
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
  // The interest the bank earned is already in the journal (another settlement wrote it): the company's statement reads it there.
  journal.push(booked({ type: 'loan_interest_received', amount: 1000, accountBuildingId: 'bank-1' }));
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('social contributions — employer, employee, and the city\'s social security', () => {
  test('the employer pays a share of the payroll on top, the city receives it', () => {
    expect(employerContributionLines({ workplaceId: 'farm', wagesHT: 300, rate: 0.25 })).toMatchObject([
      { kind: 'employer_contribution', amount: 75, holder: 'farm', counterparty: null },
      { kind: 'social_contribution', amount: 75, holder: null, counterparty: 'farm' },
    ]);
    expect(employerContributionLines({ workplaceId: 'farm', wagesHT: 300, rate: 0 })).toMatchObject([]);
  });

  // The employer withholds the employee's share and the income tax before it pays: the household receives a payslip (one écriture, the gross against what is
  // withheld and what reaches its account), the city receives what was withheld from the employer.
  test('a month\'s settlement: the employer pays the wage, withholds the employee\'s share and the tax, and the city receives them from it', async () => {
    const journal = await settle({ employerContributionRate: 0.25, employeeContributionRate: 0.1 });

    expect(journal.find((line) => line.type === 'producer_wage').amount).toBe(300);
    expect(journal.find((line) => line.type === 'employer_contribution')).toMatchObject({ amount: 75, accountBuildingId: 'bank-1' });
    const payslip = journal.find((line) => line.type === 'household_wage');
    expect(payslip).toMatchObject({ amount: 300, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: 'bank-1', journal: 'PA' });
    // The tax is on the wage after the employee's share (270): 27. The household's account receives the 243 left.
    expect(payslip.legs).toEqual([
      { account: '512', debit: 24300, credit: 0 },
      { account: '431', debit: 3000, credit: 0 },
      { account: '4421', debit: 2700, credit: 0 },
      { account: '421', debit: 0, credit: 30000 },
    ]);
    // The household pays nothing itself any more: no line of its own for the contribution or the tax.
    expect(journal.some((line) => line.type === 'employee_contribution')).toBe(false);
    expect(journal.some((line) => line.type === 'income_tax')).toBe(false);
    // The city receives 75 (employer's) + 30 (employee's) of contributions, and the 27 of tax, from the company, on its own account.
    const received = journal.filter((line) => line.type === 'social_contribution');
    expect(received.map((line) => [line.amount, line.counterpartyBuildingId]).sort((a, b) => a[0] - b[0])).toEqual([[30, 'bank-1'], [75, 'bank-1']]);
    expect(received.every((line) => line.accountBuildingId === null)).toBe(true);
    expect(journal.find((line) => line.type === 'payroll_tax')).toMatchObject({ amount: 27, accountBuildingId: null, counterpartyBuildingId: 'bank-1' });
    // The corporate tax is on the profit after the wages and the employer's share.
    expect(journal.find((line) => line.type === 'corporate_tax').amount).toBe(156.25); // (1000 − 300 − 75) × 25 %
  });

  test('the cash of the wage adds up: what the company pays out is what the household and the city receive', async () => {
    const journal = await settle({ employerContributionRate: 0.25, employeeContributionRate: 0.1 });
    const wageFlow = journal.find((line) => line.type === 'producer_wage').transactionId;

    const cash = journal
      .filter((line) => line.transactionId === wageFlow)
      .flatMap((line) => line.legs)
      .filter((leg) => leg.account === '512')
      .reduce((sum, leg) => sum + leg.debit - leg.credit, 0);

    expect(cash).toBe(0);
  });

  // Each actor books its own écriture of a flow; the sides carry the same transactionId, so the consolidation can set them against one another.
  test('the sides of each flow of the month carry one transactionId, each on its own account', async () => {
    const journal = await settle({ employerContributionRate: 0.25, employeeContributionRate: 0.1 });

    const { lonely } = unpairedFlowsOf(journal);

    expect(lonely).toEqual([]);
    const flowOf = (type) => journal.find((line) => line.type === type).transactionId;
    expect(flowOf('employer_contribution')).toBeTruthy();
    expect(journal.filter((line) => line.transactionId === flowOf('employer_contribution')).map((line) => line.type).sort()).toEqual(['employer_contribution', 'social_contribution']);
    // The wage, the payslip and what was withheld are one flow, four écritures on three accounts.
    expect(journal.filter((line) => line.transactionId === flowOf('household_wage')).map((line) => line.type).sort()).toEqual(['household_wage', 'payroll_tax', 'producer_wage', 'social_contribution']);
  });

  test('with no contribution rate nothing is withheld for the contribution and the wage is taxed whole', async () => {
    const journal = await settle({ employerContributionRate: 0, employeeContributionRate: 0 });

    expect(journal.some((line) => ['employer_contribution', 'social_contribution'].includes(line.type))).toBe(false);
    const payslip = journal.find((line) => line.type === 'household_wage');
    expect(payslip.legs).toEqual([
      { account: '512', debit: 27000, credit: 0 },
      { account: '4421', debit: 3000, credit: 0 },
      { account: '421', debit: 0, credit: 30000 },
    ]);
    expect(journal.find((line) => line.type === 'payroll_tax').amount).toBe(30);
  });

  test('each type is known to the treasury and the chart of accounts', () => {
    expect(moneyDirectionOf(booked({ type: 'employer_contribution', amount: 1, turn: 0, accountBuildingId: 'farm' }))).toBe('debit');
    expect(moneyDirectionOf(booked({ type: 'social_contribution', amount: 1, turn: 0, accountBuildingId: null }))).toBe('credit');
    expect(pcgOfJournalType('employer_contribution').account).toBe('645');
  });
});
