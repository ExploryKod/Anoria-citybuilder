import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { buildingFinanceFigures } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

// Regression: a house's own little business (an artisan's, a savant's, a merchant's — buildingEconomy.js's
// activityRecipe) sells and buys through the same pairs a company does (sumGoodsFlowsByPair → tradeLines).
// Before this fix, tradeLines never tagged an accountKind, so the house's trade lines landed on the bare
// houseId key — a third, unenumerated account, invisible to both the "Particulier" and "Entreprise" tabs
// (buildingFinanceInfoView.js), which read accountKind 'particulier'/'entreprise' exactly.
const HOUSE = 'house-1';

function settle(pairs) {
  const journal = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
    listBuildings: async () => [
      { id: HOUSE, type: 'House-Red', workerSources: {} },
      { id: 'warehouse-1', type: 'Warehouse', workerSources: {} },
      { id: 'warehouse-2', type: 'Warehouse', workerSources: {} },
      { id: 'farm-1', type: 'Farm-Wheat', workerSources: {} },
      { id: 'market-1', type: 'Market-Stall', workerSources: {} },
    ],
    sumGoodsFlowsByPair: async () => pairs,
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [{ id: HOUSE, pop: 4 }],
    getPublicPay: async () => ({ salaryPerMonth: 0, unemploymentBenefitRate: 0 }),
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 0,
    recordLedgerEntry: async (line) => {
      // The real RecordLedgerEntry command stamps year/month from its own getTimeInfo(turn); this fake
      // does it directly, matching the fixed deliveredTime (year 1, monthIndex 0) settle() uses below.
      journal.push({ ...line, year: 1, month: 1 });
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('a house that runs its own business is booked on its business account, not a bare key', () => {
  test('selling its output to a warehouse is producer_revenue on the house\'s entreprise account', async () => {
    const journal = await settle([{ sellerId: HOUSE, buyerId: null, amountHT: 80 }]);

    const sale = journal.find((line) => line.type === 'producer_revenue' && line.accountBuildingId === HOUSE);
    expect(sale).toBeDefined();
    expect(sale.accountKind).toBe('entreprise');
  });

  test('buying its raw material from a warehouse is producer_purchase on the house\'s entreprise account', async () => {
    const journal = await settle([{ sellerId: 'warehouse-1', buyerId: HOUSE, amountHT: 30 }]);

    const purchase = journal.find((line) => line.type === 'producer_purchase' && line.accountBuildingId === HOUSE);
    expect(purchase).toBeDefined();
    expect(purchase.accountKind).toBe('entreprise');
  });

  test('a sale between two companies still carries no accountKind', async () => {
    const journal = await settle([{ sellerId: 'farm-1', buyerId: 'market-1', amountHT: 50 }]);

    const sale = journal.find((line) => line.type === 'producer_revenue' && line.accountBuildingId === 'farm-1');
    expect(sale.accountKind).toBeNull();
    const purchase = journal.find((line) => line.type === 'producer_purchase' && line.accountBuildingId === 'market-1');
    expect(purchase.accountKind).toBeNull();
  });

  // A house can run more than one activity at once (House-Red: decoratedPot AND carrotCake —
  // ARTISAN_ACTIVITY_ROLES in buildingEconomy.js). The Entreprise tab must not reflect only one of them:
  // accountKind tagging is keyed on the HOLDER alone, never on which good/counterparty produced the line,
  // so BuildingFinancePolicy's blanket sum over the account already spans every activity by construction —
  // this proves it end to end, not just by reading the aggregation code.
  test('a house selling two different activities to two different counterparties: the entreprise account sums both', async () => {
    const journal = await settle([
      { sellerId: HOUSE, buyerId: 'warehouse-1', amountHT: 80 }, // e.g. decoratedPot
      { sellerId: HOUSE, buyerId: 'warehouse-2', amountHT: 50 }, // e.g. carrotCake
    ]);

    const sales = journal.filter((line) => line.type === 'producer_revenue' && line.accountBuildingId === HOUSE);
    expect(sales).toHaveLength(2);
    expect(sales.every((line) => line.accountKind === 'entreprise')).toBe(true);

    const figures = buildingFinanceFigures(journal, HOUSE, { year: 1, accountKind: 'entreprise' });
    expect(figures.revenueHT).toBe(130);
  });
});
