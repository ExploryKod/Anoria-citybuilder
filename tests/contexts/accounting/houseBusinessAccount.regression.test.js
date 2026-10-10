import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';

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
      journal.push(line);
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
});
