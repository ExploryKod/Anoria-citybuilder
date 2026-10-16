import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { allocateCooperativeResult } from '../../../src/contexts/accounting/domain/policies/CooperativeAllocationPolicy.js';
import { COOPERATIVE_MINIMUM_SHARES, COOPERATIVE_SHARES, CORPORATE_TAX_RATE } from '../../../src/contexts/accounting/domain/catalogs/ProducerChargeCatalog.js';
import { buildingFinanceFigures } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

// A house's own business is a cooperative (SCOP): its year's surplus, shared when the fiscal year closes, goes to the residents (participation, a charge before the tax), to the tax,
// to the interest on the parts sociales (after the tax) and to the reserves. A loss shares nothing; only the cash the business holds can leave it.
const shares = COOPERATIVE_SHARES;
const allocate = (result, businessCash) => allocateCooperativeResult({ result, businessCash, shares, corporateTaxRate: CORPORATE_TAX_RATE });

describe('the shares of a cooperative follow the rules of the SCOP', () => {
  test('they add up to one and meet the minimums the rules ask', () => {
    expect(shares.workers + shares.associates + shares.enterprise).toBeCloseTo(1, 10);
    expect(shares.workers).toBeGreaterThanOrEqual(COOPERATIVE_MINIMUM_SHARES.workers);
    expect(shares.enterprise).toBeGreaterThanOrEqual(COOPERATIVE_MINIMUM_SHARES.enterprise);
    // The interest on the parts is lower than both other parts.
    expect(shares.associates).toBeLessThan(Math.min(shares.workers, shares.enterprise));
  });
});

describe('allocateCooperativeResult — what a cooperative shares in a year', () => {
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

function settle({ pairs, businessCash }) {
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
    getPublicPay: async () => ({ benefitBase: 0, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0 }),
    getWageRateOf: async () => () => 8,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    readCompanyYear: companyYearReaderOf(journal),
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
    expect(of('cooperative_participation')).toMatchObject({ amount: 80, accountBuildingId: 'house-1', accountKind: 'entreprise' });
    expect(of('household_participation')).toMatchObject({ amount: 80, accountBuildingId: 'house-1', accountKind: 'particulier' });
    expect(of('corporate_tax')).toMatchObject({ amount: 30, accountBuildingId: 'house-1', accountKind: 'entreprise' }); // (200 − 80) × 25 %
    expect(of('corporate_tax_revenue')).toMatchObject({ amount: 30, accountBuildingId: null });
    expect(of('cooperative_dividend')).toMatchObject({ amount: 30, accountKind: 'entreprise' }); // 15 % of the surplus
    expect(of('household_dividend')).toMatchObject({ amount: 30, accountKind: 'particulier' });

    // The statement of the business: the participation is a charge before the tax, the dividend is outside it, the rest stays in the reserves.
    const figures = buildingFinanceFigures(journal, 'house-1', { year: 1, accountKind: 'entreprise', salesNature: 'production' });
    expect(figures.statement.sections.find((section) => section.id === 'workersParticipation').total).toBe(80);
    expect(figures.statement.results.net).toBe(90); // 200 − 80 − 30
    expect(figures.allocation).toEqual({ dividends: 30, retained: 60 });
    // The household's own account shows both.
    const household = buildingFinanceFigures(journal, 'house-1', { year: 1, accountKind: 'particulier' });
    expect(household.participationReceived).toBe(80);
    expect(household.dividendReceived).toBe(30);
  });

  test('a business that sold nothing, or at a loss, shares nothing', async () => {
    expect(await settle({ pairs: [], businessCash: 1000 })).toEqual([]);
    const loss = await settle({ pairs: [{ sellerId: 'supplier', buyerId: 'house-1', amountHT: 50 }], businessCash: 1000 });

    const houseLines = loss.filter((line) => line.accountBuildingId === 'house-1');
    expect(houseLines.some((line) => ['cooperative_participation', 'cooperative_dividend', 'corporate_tax'].includes(line.type))).toBe(false);
  });
});
