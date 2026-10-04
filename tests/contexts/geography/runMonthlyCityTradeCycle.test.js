import { RunMonthlyCityTradeCycle } from '../../../src/contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { takeCategoryAmount } from '../../../src/contexts/supply/domain/value-objects/ResourceStock.js';

/** Mirrors createTradeContext.js's own `takeHubStock` capability exactly — geography is injected
 *  this, never importing supply's domain layer itself (see tests/architecture/boundaries.test.js). */
function takeHubStock(hub, category, amount) {
  return takeCategoryAmount(hub.stocks, category, amount, getCategoriesForRole(hub.type, 'hub'), getTotalKeyForRole(hub.type, 'hub'));
}

/**
 * Regression: `lastOrderMonth` must be tracked against an ever-increasing month count
 * (`monthNumber`), not the calendar's wrapping `monthIndex` (0-11, resets every year — see
 * TimeCalendar.js). A relation whose last order fell late in a year used to get stuck forever
 * the moment the year rolled over: `monthIndex - lastOrder` goes negative and can never reach
 * `frequencyMonths` again within a 0-11 range, so `RunMonthlyCityTradeCycle` silently never
 * revisited it — no error, no export, ever, even though the relation stayed "active".
 */
describe('RunMonthlyCityTradeCycle — order rhythm survives a year rollover', () => {
  function buildCycle({ relation }) {
    const savedRelations = [];
    const cityTradeRepository = {
      async getActiveRelations() {
        return [relation];
      },
      async saveRelation(next) {
        Object.assign(relation, next);
        savedRelations.push({ ...next });
      },
    };
    const supplyBuildingRepository = {
      async findByResourceRole() {
        return []; // no hub stock anywhere — this test only cares about the rhythm, not a sale
      },
      async saveStocks() {},
    };
    // Never actually called here (no hubs), but a real dependency of the class since it now takes
    // stock through HubServing (see priority-integration test below for the real thing).
    const hubServing = {
      async availableTo() { return 0; },
      async take() { return []; },
      async recordDemand() {},
    };
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository,
      supplyBuildingRepository,
      hubServing,
      takeHubStock,
      recordCommerceExportIncome: async () => {},
      recordMerchantSale: async () => {},
      getCustomsRate: () => 0.1,
      random: () => 0.5,
      saleBias: () => 0,
    });
    return { cycle, relation, savedRelations };
  }

  test('a relation last ordered late in year 0 orders again once monthNumber (not monthIndex) advances enough', async () => {
    const relation = {
      cityId: 'silvania', // frequencyMonths: 2 in TradeCatalog.js
      status: 'active',
      satisfactionScore: 20,
      demandMultiplier: 1,
      lastOrderMonth: 10, // set by a previous run, in absolute-month terms
    };
    const { cycle, savedRelations } = buildCycle({ relation });

    // November of year 0: calendar monthIndex=11, absolute monthNumber=11 — not due yet (11-10=1 < 2).
    await cycle.execute({ turn: 330, monthIndex: 11, monthNumber: 11, year: 0 });
    expect(savedRelations).toHaveLength(0);
    expect(relation.lastOrderMonth).toBe(10);

    // January of year 1: calendar monthIndex WRAPS to 0, but monthNumber keeps counting up to 12.
    // Due: 12 - 10 = 2 >= frequencyMonths(2). The old code compared against monthIndex (0 - 10 = -10),
    // which would stay "not due" forever from here on — this call proves it isn't stuck.
    await cycle.execute({ turn: 360, monthIndex: 0, monthNumber: 12, year: 1 });
    expect(savedRelations).toHaveLength(1);
    expect(relation.lastOrderMonth).toBe(12);
  });

  test('a fresh relation with no prior order becomes due exactly after its own frequency', async () => {
    const relation = {
      cityId: 'silvania',
      status: 'active',
      satisfactionScore: 50,
      demandMultiplier: 1,
      lastOrderMonth: null,
    };
    const { cycle, savedRelations } = buildCycle({ relation });

    await cycle.execute({ turn: 0, monthIndex: 0, monthNumber: 0, year: 0 });
    expect(savedRelations).toHaveLength(1);
    expect(relation.lastOrderMonth).toBe(0);
  });
});

/**
 * A trade city is a real HubServing client (see createSupplyContext.js's
 * `listExternalClientsForCategory`), not a direct `hub.stocks` mutation — this exercises the real
 * HubServing engine (lots, priority, demand) instead of faking it away, so a regression in that
 * wiring (e.g. the city id never reaching `hubServing.take`) fails here, not silently in the game.
 */
describe('RunMonthlyCityTradeCycle — sells through HubServing (city is a real client)', () => {
  // Rows come back FROZEN, exactly like the real DexieSupplyBuildingRepository
  // (SupplyBuildingSnapshot.js's Object.freeze) — this is what caught "Cannot assign to read only
  // property 'stocks'": the first version of #takeFromHubsForClient wrote straight onto the row it
  // got back instead of replacing the store's entry, which real Dexie snapshots would reject too.
  function buildInMemoryRepository(rows) {
    const store = new Map(rows.map((row) => [row.id, row]));
    const snapshot = (row) => Object.freeze({ ...row });
    return {
      store,
      async findById(id) {
        const row = store.get(id);
        return row ? snapshot(row) : null;
      },
      async updateBuildingFields(id, fields) {
        const row = store.get(id);
        if (!row) return;
        store.set(id, { ...row, ...fields });
      },
      async saveStocks(id, stocks) {
        const row = store.get(id);
        if (!row) return;
        store.set(id, { ...row, stocks });
      },
      async listAllBuildingRows() {
        return [...store.values()].map(snapshot);
      },
      async findByResourceRole(role) {
        return [...store.values()].filter((row) => row.type === 'TradeWarehouse' && role === 'hub').map(snapshot);
      },
    };
  }

  test('takes dealDecoratedPot from the merchant\'s own lot and pays out, with only Silvania eligible', async () => {
    const merchant = { id: 'merchant-1', type: 'House-Blue' };
    const hub = {
      id: 'hub-1',
      type: 'TradeWarehouse',
      x: 9,
      y: 2,
      roadCount: 3,
      worker: 0,
      workerNeed: 0,
      maxStock: 500,
      stocks: { dealDecoratedPot: 100 },
      lots: { dealDecoratedPot: { [merchant.id]: 100 } },
    };
    const supplyBuildingRepository = buildInMemoryRepository([merchant, hub]);
    const hubServing = new HubServing(supplyBuildingRepository, {
      listExternalClients: (category) => (category === 'dealDecoratedPot' ? [{ id: 'city:silvania', type: 'TradeCity' }] : []),
    });

    const cityTradeRepository = {
      async getActiveRelations() {
        return [{ cityId: 'silvania', status: 'active', satisfactionScore: 50, demandMultiplier: 1, lastOrderMonth: null }];
      },
      async saveRelation() {},
    };
    const recordedSales = [];
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository,
      supplyBuildingRepository,
      hubServing,
      takeHubStock,
      recordCommerceExportIncome: async () => {},
      recordMerchantSale: async (sale) => recordedSales.push(sale),
      getCustomsRate: () => 0.1,
      random: () => 0.5,
      saleBias: () => 0,
    });

    await cycle.execute({ turn: 0, monthIndex: 0, monthNumber: 0, year: 0 });

    // Silvania wants 20 decoratedPot/order (TradeCatalog.js) — the only eligible client, so it gets all of it.
    expect(recordedSales).toHaveLength(1);
    expect(recordedSales[0]).toMatchObject({ cityId: 'silvania', dealGood: 'dealDecoratedPot', quantity: 20 });
    const finalHub = await supplyBuildingRepository.findById('hub-1');
    expect(finalHub.stocks.dealDecoratedPot).toBe(80);
    // The hub's shared `goods` total must go down with it — not just the one category — or
    // CollectResourceToHub's capacity check eventually sees a hub that is not really full as full.
    expect(finalHub.stocks.goods).toBe(80);
  });
});

describe('RunMonthlyCityTradeCycle — real calendar timeInfo (no turn field)', () => {
  test('a sale runs to completion with the calendar shape TimeCalendar actually returns', async () => {
    const { TimeManager } = await import('../../../src/shared/time/TimeManager.js');
    const merchant = { id: 'merchant-1', type: 'House-Blue' };
    const hub = {
      id: 'hub-1', type: 'TradeWarehouse', x: 9, y: 2, roadCount: 3, worker: 4, workerNeed: 4, maxStock: 500,
      stocks: { dealDecoratedPot: 100 }, lots: { dealDecoratedPot: { [merchant.id]: 100 } },
    };
    const store = new Map([[merchant.id, merchant], [hub.id, hub]]);
    const repo = {
      async findById(id) { const r = store.get(id); return r ? Object.freeze({ ...r }) : null; },
      async updateBuildingFields(id, f) { store.set(id, { ...store.get(id), ...f }); },
      async saveStocks(id, stocks) { store.set(id, { ...store.get(id), stocks }); },
      async listAllBuildingRows() { return [...store.values()].map((r) => Object.freeze({ ...r })); },
      async findByResourceRole() { return [...store.values()].filter((r) => r.type === 'TradeWarehouse').map((r) => Object.freeze({ ...r })); },
    };
    const hubServing = new HubServing(repo, { listExternalClients: (c) => (c === 'dealDecoratedPot' ? [{ id: 'city:silvania', type: 'TradeCity' }] : []) });
    const relation = { cityId: 'silvania', status: 'active', satisfactionScore: 50, demandMultiplier: 1, lastOrderMonth: null };
    const sales = [];
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository: { async getActiveRelations() { return [relation]; }, async saveRelation() {} },
      supplyBuildingRepository: repo,
      hubServing,
      takeHubStock,
      recordCommerceExportIncome: async () => {},
      recordMerchantSale: async (s) => sales.push(s),
      getCustomsRate: () => 0.1,
      random: () => 0.5,
      saleBias: () => 0,
    });

    const timeInfo = TimeManager.getTimeInfo(4, 5);
    expect(timeInfo.turn).toBeUndefined();
    await expect(cycle.execute(timeInfo)).resolves.toBeUndefined();
    expect(sales).toHaveLength(1);
    expect((await repo.findById('hub-1')).stocks.dealDecoratedPot).toBe(80);
  });
});
