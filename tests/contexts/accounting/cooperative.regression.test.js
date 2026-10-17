import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { allocateEnterpriseResult } from '../../../src/contexts/accounting/domain/policies/EnterpriseAllocationPolicy.js';
import { LEGAL_FORMS } from '../../../src/shared/accounting-catalog/LegalFormCatalog.js';
import { DEFAULT_HAMLET_FISCAL_RATES } from '../../../src/contexts/accounting/domain/catalogs/FiscalRateCatalog.js';

const CORPORATE_TAX_RATE = DEFAULT_HAMLET_FISCAL_RATES.corporateTaxRate;
import { buildingFinanceFigures } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

// A house's own business is a cooperative (SCOP): its year's surplus, shared when the fiscal year closes, goes to the residents (participation, a charge before the tax), to the tax,
// to the interest on the parts sociales (after the tax) and to the reserves. A loss shares nothing; only the cash the business holds can leave it.
const { shares, minimumShares: COOPERATIVE_MINIMUM_SHARES } = LEGAL_FORMS.cooperative.regime;
const allocate = (result, businessCash) => allocateEnterpriseResult({ result, businessCash, shares, corporateTaxRate: CORPORATE_TAX_RATE });

describe('the shares of a cooperative follow the rules of the SCOP', () => {
  test('they add up to one and meet the minimums the rules ask', () => {
    expect(shares.workers + shares.associates + shares.enterprise).toBeCloseTo(1, 10);
    expect(shares.workers).toBeGreaterThanOrEqual(COOPERATIVE_MINIMUM_SHARES.workers);
    expect(shares.enterprise).toBeGreaterThanOrEqual(COOPERATIVE_MINIMUM_SHARES.enterprise);
    // The interest on the parts is lower than both other parts.
    expect(shares.associates).toBeLessThan(Math.min(shares.workers, shares.enterprise));
  });
});

describe('allocateEnterpriseResult — what a cooperative shares in a year', () => {
  test('a surplus is shared: the participation, the tax on what is left, then the interest on the parts', () => {
    expect(allocate(100, 1000)).toEqual({ participation: 40, corporateTax: 15, dividend: 15 });
  });

  test('only the cash the business holds can leave it: the participation first, the dividend after the tax is set aside', () => {
    // 30 in cash: the participation takes it all, the tax is still due on the rest (a deficit), nothing is left for a dividend.
    expect(allocate(100, 30)).toEqual({ participation: 30, corporateTax: 17.5, dividend: 0 });
    expect(allocate(100, 0)).toEqual({ participation: 0, corporateTax: 25, dividend: 0 });
  });

  test('a loss, or nothing, shares nothing', () => {
    expect(allocate(-20, 1000)).toEqual({ participation: 0, corporateTax: 0, dividend: 0 });
    expect(allocate(0, 1000)).toEqual({ participation: 0, corporateTax: 0, dividend: 0 });
  });
});

describe('a property company (SCI) follows its own legal form, not the cooperative\'s', () => {
  // Transparent: no corporate tax at its level, no participation, and what the cash allows of the result goes to its associates.
  const sci = LEGAL_FORMS.sci.regime;
  const share = (result, businessCash) => allocateEnterpriseResult({ result, businessCash, shares: sci.shares, corporateTaxRate: sci.taxed ? CORPORATE_TAX_RATE : 0 });

  test('the whole result is distributed, untaxed, as far as the cash goes', () => {
    expect(share(100, 1000)).toEqual({ participation: 0, corporateTax: 0, dividend: 100 });
    expect(share(100, 40)).toEqual({ participation: 0, corporateTax: 0, dividend: 40 });
  });

  test('its words are its own: a distribution, no participation', () => {
    expect(LEGAL_FORMS.sci.terms.participation).toBeNull();
    expect(LEGAL_FORMS.sci.terms.dividend.paid).not.toBe(LEGAL_FORMS.cooperative.terms.dividend.paid);
  });
});

function settle({ pairs, businessCash, taxRate = { threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 } }) {
  const journal = [];
  const service = new SettleProducerCharges({
    // The month delivered is the last of the year: the settlement that closes the fiscal year, the one that shares the surplus.
    getTimeInfo: () => ({ year: 1, monthIndex: 11, month: 'Décembre' }),
    listBuildings: async () => [
      { id: 'house-1', type: 'House-Red', workerSources: {} },
      { id: 'supplier', type: 'Farm-Wheat', workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => pairs,
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    businessFundsOf: async () => businessCash,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [{ id: 'house-1', pop: 4, salaried: 0 }],
    getPublicPay: async () => ({ benefitBase: 0, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 8,
    getSalaryTax: async () => taxRate,
    getCorporateTaxRate: async () => 0.25,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    readCompanyYear: companyYearReaderOf(journal),
    readHouseholdYear: householdYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: 1 });
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('the year-end settlement of a house\'s cooperative', () => {
  test('the surplus reaches the residents\' personal account, the tax reaches the city, and the statement carries the participation before the tax', async () => {
    const journal = await settle({ pairs: [{ sellerId: 'house-1', buyerId: null, amountHT: 200 }], businessCash: 1000 });

    const of = (type) => journal.find((line) => line.type === type);
    expect(of('enterprise_participation')).toMatchObject({ amount: 80, accountBuildingId: 'house-1', accountKind: 'entreprise:cooperative' });
    expect(of('household_participation')).toMatchObject({ amount: 80, accountBuildingId: 'house-1', accountKind: 'particulier' });
    expect(of('corporate_tax')).toMatchObject({ amount: 30, accountBuildingId: 'house-1', accountKind: 'entreprise:cooperative' }); // (200 − 80) × 25 %
    expect(of('corporate_tax_revenue')).toMatchObject({ amount: 30, accountBuildingId: null });
    expect(of('enterprise_dividend')).toMatchObject({ amount: 30, accountKind: 'entreprise:cooperative' }); // 15 % of the surplus
    expect(of('household_dividend')).toMatchObject({ amount: 30, accountKind: 'particulier' });

    // The statement of the business: the participation is a charge before the tax, the dividend is outside it, the rest stays in the reserves.
    const figures = buildingFinanceFigures(journal, 'house-1', { year: 1, accountKind: 'entreprise:cooperative', salesNature: 'production' });
    expect(figures.statement.sections.find((section) => section.id === 'workersParticipation').total).toBe(80);
    expect(figures.statement.results.net).toBe(90); // 200 − 80 − 30
    expect(figures.allocation).toEqual({ dividends: 30, retained: 60 });
    // The household's own account shows both.
    const household = buildingFinanceFigures(journal, 'house-1', { year: 1, accountKind: 'particulier' });
    expect(household.participationReceived).toBe(80);
    expect(household.dividendReceived).toBe(30);
  });

  // What the enterprises pay the household is income like a wage: the year's income tax is recalculated on it at the close, on the same bands
  // (the monthly thresholds counted for the twelve months of the year), and what the monthly withholdings did not cover is charged then.
  test('the participation and the dividend are taxed with the year\'s income, on the same bands', async () => {
    // 80 + 30 = 110 over the year; the first 5 a month (60 a year) are exempt, then 10 %: (110 − 60) × 10 % = 5.
    const journal = await settle({
      pairs: [{ sellerId: 'house-1', buyerId: null, amountHT: 200 }],
      businessCash: 1000,
      taxRate: { threshold1: 5, rate1: 0.1, threshold2: 5, rate2: 0.1 },
    });

    expect(journal.find((line) => line.type === 'income_tax')).toMatchObject({ amount: 5, accountBuildingId: 'house-1', accountKind: 'particulier' });
    expect(journal.find((line) => line.type === 'payroll_tax')).toMatchObject({ amount: 5, accountBuildingId: null });
  });

  // The monthly withholdings are an advance: when they went beyond the tax of the year, the city gives the difference back at the close.
  test('an advance that went beyond the tax of the year is given back, to the household and out of the city\'s funds', async () => {
    const journal = [];
    const service = new SettleProducerCharges({
      getTimeInfo: () => ({ year: 1, monthIndex: 11, month: 'Décembre' }),
      listBuildings: async () => [{ id: 'house-1', type: 'House-Red', workerSources: {} }],
      sumGoodsFlowsByPair: async () => [],
      sumServiceFlows: async () => [],
      getServiceSubsidies: async () => ({}),
      getServicePrice: () => 0,
      fundsOf: async () => 0,
      businessFundsOf: async () => 0,
      getVatRates: async () => ({}),
      sumHouseSales: async () => [],
      sumBankInterestByBuilding: async () => [],
      sumOtherExpensesByBuilding: async () => [],
      listHouses: async () => [{ id: 'house-1', pop: 4, salaried: 0 }],
      getPublicPay: async () => ({ benefitBase: 0, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
      getWageRateOf: async () => () => 8,
      getSalaryTax: async () => ({ threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 }),
      getCorporateTaxRate: async () => 0.25,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => [],
      recordServiceCutOff: async () => {},
      buildingMaintenanceCost: () => 0,
      readCompanyYear: companyYearReaderOf(journal),
      // The year's income is 100 (a flat 10 % makes 10), but 30 was withheld over the year: 20 too much.
      readHouseholdYear: async () => ({ incomeYearToDate: 100, taxWithheldYearToDate: 30 }),
      recordLedgerEntry: async (line) => {
        journal.push({ ...line, year: 1, month: 1 });
        return { recorded: true };
      },
      recordEconomyMovement: async () => {},
    });
    await service.execute({ time: 2, deliveredTime: 1 });

    expect(journal.find((line) => line.type === 'income_tax_refund')).toMatchObject({ amount: 20, accountBuildingId: 'house-1', accountKind: 'particulier' });
    expect(journal.find((line) => line.type === 'payroll_tax_refund')).toMatchObject({ amount: 20, accountBuildingId: null, counterpartyBuildingId: 'house-1' });
    expect(journal.some((line) => line.type === 'income_tax')).toBe(false);
  });

  // Informative lines (what spoiled goods would have sold for) tell the player a loss of opportunity; they never move money.
  test('the goods a building lost to spoilage are an informative line that moves no money', async () => {
    const journal = [];
    const service = new SettleProducerCharges({
      getTimeInfo: () => ({ year: 1, monthIndex: 3, month: 'Avril' }),
      listBuildings: async () => [{ id: 'field', type: 'Farm-Wheat', workerSources: {} }],
      sumGoodsFlowsByPair: async () => [],
      sumServiceFlows: async () => [],
      getServiceSubsidies: async () => ({}),
      getServicePrice: () => 0,
      fundsOf: async () => 0,
      businessFundsOf: async () => 0,
      getVatRates: async () => ({}),
      sumHouseSales: async () => [],
      sumBankInterestByBuilding: async () => [],
      sumOtherExpensesByBuilding: async () => [],
      listHouses: async () => [],
      getPublicPay: async () => ({ benefitBase: 0, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
      getWageRateOf: async () => () => 8,
      getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
      getCorporateTaxRate: async () => 0.25,
    getHouseMaintenanceSubsidyRate: async () => 1,
      listSpoilage: async () => [{ buildingId: 'field', units: 120, lostRevenue: 96 }],
      recordServiceCutOff: async () => {},
      buildingMaintenanceCost: () => 0,
      readCompanyYear: companyYearReaderOf(journal),
      readHouseholdYear: householdYearReaderOf(journal),
      recordLedgerEntry: async (line) => {
        journal.push({ ...line, year: 1, month: 1 });
        return { recorded: true };
      },
      recordEconomyMovement: async () => {},
    });
    await service.execute({ time: 2, deliveredTime: 1 });

    const spoiled = journal.find((line) => line.type === 'info_goods_spoiled');
    expect(spoiled).toMatchObject({ amount: 96, accountBuildingId: 'field', accountKind: null });
    expect(spoiled.description).toContain('120 unités jetées');
    expect(moneyDirectionOf(spoiled)).toBeNull();
  });

  test('a household whose income stays under the exempt part is charged nothing at the close', async () => {
    const journal = await settle({
      pairs: [{ sellerId: 'house-1', buyerId: null, amountHT: 200 }],
      businessCash: 1000,
      taxRate: { threshold1: 20, rate1: 0.1, threshold2: 20, rate2: 0.1 },
    });

    expect(journal.some((line) => line.type === 'income_tax')).toBe(false);
  });

  test('a business that sold nothing, or at a loss, shares nothing', async () => {
    expect(await settle({ pairs: [], businessCash: 1000 })).toEqual([]);
    const loss = await settle({ pairs: [{ sellerId: 'supplier', buyerId: 'house-1', amountHT: 50 }], businessCash: 1000 });

    const houseLines = loss.filter((line) => line.accountBuildingId === 'house-1');
    expect(houseLines.some((line) => ['enterprise_participation', 'enterprise_dividend', 'corporate_tax'].includes(line.type))).toBe(false);
  });
});
