import { importCapabilities, openRelationRow } from './importCapabilities.js';
import { RunMonthlyCityTradeCycle } from '../../../src/contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { priceImportDelivery } from '../../../src/contexts/geography/domain/policies/ImportPricePolicy.js';
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
      recordMerchantSale: async () => {},
      getCustomsDuty: () => 0.1,
      ...importCapabilities(),
      random: () => 0.5,
      saleBias: () => 0,
    });
    return { cycle, relation, savedRelations };
  }

  test('a relation last ordered late in year 0 orders again once monthNumber (not monthIndex) advances enough', async () => {
    const relation = openRelationRow({
      cityId: 'silvania', // frequencyMonths: 2 in TradeCatalog.js
      satisfactionScore: 20,
      demandMultiplier: 1,
      lastOrderMonth: 10, // set by a previous run, in absolute-month terms
    });
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
    const relation = openRelationRow({ cityId: 'silvania', demandMultiplier: 1 });
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
        return [openRelationRow({ cityId: 'silvania', demandMultiplier: 1 })];
      },
      async saveRelation() {},
    };
    const recordedSales = [];
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository,
      supplyBuildingRepository,
      hubServing,
      takeHubStock,
      recordMerchantSale: async (sale) => recordedSales.push(sale),
      getCustomsDuty: () => 0.1,
      ...importCapabilities(),
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
    // (Silvania also delivers its imports to the same hub this month: they count in that total too.)
    expect(finalHub.stocks.goods).toBe(80 + finalHub.stocks.exoticWood);
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
    const relation = openRelationRow({ cityId: 'silvania', demandMultiplier: 1 });
    const sales = [];
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository: { async getActiveRelations() { return [relation]; }, async saveRelation() {} },
      supplyBuildingRepository: repo,
      hubServing,
      takeHubStock,
      recordMerchantSale: async (s) => sales.push(s),
      getCustomsDuty: () => 0.1,
      ...importCapabilities(),
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

/**
 * Exports: our merchants are the exporters. Each house is credited the sale on its business account and pays Anoria's
 * export duty on it; the city receives the duty (its own line, never the import's); the warehouse is not paid by the
 * city any more (it was paid by the merchants for the goods they made the deals from). When the sale, duty taken off,
 * does not cover what the merchants paid for the goods, they cease to export that good, and only that flow.
 */
describe('RunMonthlyCityTradeCycle — exports (the merchants export against their deals)', () => {
  function build({ duty = 0.1, dealStock = 100 } = {}) {
    const hub = {
      id: 'hub-1', type: 'TradeWarehouse', x: 9, y: 2, roadCount: 3, maxStock: 500,
      stocks: { dealBook: dealStock, goods: dealStock }, lots: { dealBook: { 'house-1': dealStock } },
    };
    const store = new Map([[hub.id, hub]]);
    const repo = {
      async findById(id) { const r = store.get(id); return r ? Object.freeze({ ...r }) : null; },
      async updateBuildingFields(id, f) { store.set(id, { ...store.get(id), ...f }); },
      async saveStocks(id, next) { store.set(id, { ...store.get(id), stocks: next }); },
      async listAllBuildingRows() { return [...store.values()].map((r) => Object.freeze({ ...r })); },
      async findByResourceRole() { return [...store.values()].map((r) => Object.freeze({ ...r })); },
    };
    const booked = { merchantLines: [], cityLines: [], deliveries: [] };
    const sales = [];
    const row = openRelationRow({ cityId: 'silvania' });
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository: { async getActiveRelations() { return [row]; }, async saveRelation(next) { Object.assign(row, next); } },
      supplyBuildingRepository: repo,
      hubServing: new HubServing(repo, { listExternalClients: () => [] }),
      takeHubStock,
      recordMerchantSale: async (sale) => sales.push(sale),
      getCustomsDuty: (authority, flow) => (flow === 'export' ? duty : 0.1), // the export duty under test; the imports keep a normal one
      ...importCapabilities(booked),
      random: () => 0.5,
      saleBias: () => 0,
    });
    return { cycle, row, sales, ...booked };
  }
  const order = (cycle) => cycle.execute({ turn: 0, monthIndex: 0, monthNumber: 0, year: 0 });

  test('the merchant house is credited the sale and pays the duty; the city receives the duty, stamped with its rate', async () => {
    const { cycle, merchantLines, cityLines, sales } = build();
    await order(cycle);

    // Silvania buys 20 books an order, at the centre of its range: 15 × 1.8 per unit.
    const gross = Math.round(20 * 15 * 1.8 * 100) / 100;
    const duty = Math.round(gross * 0.1 * 100) / 100;
    const sale = merchantLines.find((line) => line.type === 'abroad_sale_book');
    const paid = merchantLines.find((line) => line.type === 'duty_paid_export_book');
    expect(sale).toMatchObject({ houseId: 'house-1', partnerId: 'silvania', amount: gross });
    expect(paid).toMatchObject({ houseId: 'house-1', amount: duty, dutyRate: 0.1, customsBase: gross });
    expect(cityLines).toEqual([expect.objectContaining({ type: 'export_book', amount: duty, dutyRate: 0.1, customsBase: gross })]);
    // No freight on an export: the buying city pays it.
    expect(merchantLines.some((line) => line.type.startsWith('freight_'))).toBe(false);
    expect(sales).toEqual([expect.objectContaining({ good: 'book', quantity: 20, netRevenue: gross - duty })]);
  });

  test('a duty that makes the sale lose money ends that export only: nothing is sold, the imports go on', async () => {
    const { cycle, row, merchantLines, cityLines } = build({ duty: 0.5 });
    await order(cycle);

    expect(row.exportCeased.book).toMatchObject({ reason: 'export_unprofitable', by: 'merchants' });
    expect(merchantLines.some((line) => line.type.endsWith('_book'))).toBe(false);
    expect(cityLines).toHaveLength(0);
    expect(row.importCeased).toEqual({}); // the imports have their own state
    expect(row.status).toBe('active');
  });
});

/**
 * Imports: the city delivers what it offers against the deals our merchants hold. The merchants are the importers: each
 * house pays the city's price, the transport and the duty on its own business account, and sells the goods to the
 * warehouse at that cost plus its margin; the duty is the city's income. When the landed price is above what the market
 * pays, the merchants cease to deal, and the relation says who ceased and why.
 */
describe('RunMonthlyCityTradeCycle — imports (the merchants import against their deals)', () => {
  function build({ dealStock = 40, hubStocks = {}, maxStock = 500, duty = 0.1, relation = {}, withHub = true } = {}) {
    const stocks = { goods: dealStock + (hubStocks.goods ?? 0), dealCoal: dealStock, ...hubStocks };
    const hub = { id: 'hub-1', type: 'TradeWarehouse', x: 9, y: 2, roadCount: 3, maxStock, stocks, lots: { dealCoal: dealStock > 0 ? { 'house-1': dealStock } : {} } };
    const store = new Map(withHub ? [[hub.id, hub]] : []);
    const repo = {
      async findById(id) { const r = store.get(id); return r ? Object.freeze({ ...r }) : null; },
      async updateBuildingFields(id, f) { store.set(id, { ...store.get(id), ...f }); },
      async saveStocks(id, next) { store.set(id, { ...store.get(id), stocks: next }); },
      async listAllBuildingRows() { return [...store.values()].map((r) => Object.freeze({ ...r })); },
      async findByResourceRole() { return [...store.values()].map((r) => Object.freeze({ ...r })); },
    };
    const booked = { merchantLines: [], cityLines: [], deliveries: [] };
    const row = openRelationRow({ cityId: 'briga', ...relation });
    const cycle = new RunMonthlyCityTradeCycle({
      cityTradeRepository: {
        async getActiveRelations() { return [row]; },
        async saveRelation(next) { Object.assign(row, next); },
      },
      supplyBuildingRepository: repo,
      hubServing: new HubServing(repo, { listExternalClients: () => [] }),
      takeHubStock,
      recordMerchantSale: async () => {},
      getCustomsDuty: () => duty,
      ...importCapabilities(booked),
      random: () => 0.5,
      saleBias: () => 0,
    });
    return { cycle, repo, row, ...booked };
  }
  const order = (cycle) => cycle.execute({ turn: 0, monthIndex: 0, monthNumber: 0, year: 0 });

  test('briga delivers its coal against the merchants\' deals: the house pays, the city collects the duty, the warehouse buys', async () => {
    const { cycle, repo, merchantLines, cityLines, deliveries } = build();
    await order(cycle);

    const hub = await repo.findById('hub-1');
    expect(hub.stocks.dealCoal).toBe(0); // the deals were consumed
    expect(hub.stocks.coal).toBe(40); // Briga's offer: 40 per order
    expect(hub.lots.coal).toEqual({ 'city:briga': 40 });

    const priced = priceImportDelivery({ cityId: 'briga', offer: { good: 'coal', baseMultiplier: 1.35 }, quantity: 40, dutyRate: 0.1 });
    const amountOf = (type) => merchantLines.find((line) => line.type === type)?.amount;
    expect(merchantLines.every((line) => line.houseId === 'house-1' && line.partnerId === 'briga')).toBe(true);
    expect(amountOf('import_coal')).toBe(priced.foreign);
    expect(amountOf('freight_coal')).toBe(priced.transport);
    expect(amountOf('duty_paid_import_coal')).toBe(priced.duty);
    // The duty the merchants pay is the duty the city receives, on the price plus the transport (not the margin).
    expect(cityLines).toEqual([expect.objectContaining({ type: 'customs_import_coal', amount: priced.duty })]);
    expect(priced.duty).toBeCloseTo(priced.customsValue * 0.1, 2);
    // What the warehouse pays is the merchants' cost plus their margin.
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].quantity * deliveries[0].unitPrice).toBeCloseTo(priced.sale, 2);
  });

  test('a duty that pushes the landed price above what the market pays makes the merchants cease: nothing is bought', async () => {
    const { cycle, repo, row, merchantLines, cityLines } = build({ duty: 0.5 });
    await order(cycle);

    expect((await repo.findById('hub-1')).stocks.coal ?? 0).toBe(0);
    expect(merchantLines).toHaveLength(0);
    expect(cityLines).toHaveLength(0);
    expect(row.importCeased.coal).toMatchObject({ reason: 'unprofitable', by: 'merchants' });
    expect(row.status).toBe('active'); // only the imports stop, the city still buys our exports
  });

  test('the merchants resume the first order month the price is bearable again', async () => {
    const { cycle, row } = build({ relation: { importCeased: { coal: { reason: 'unprofitable', by: 'merchants', turn: 0 } } } });
    await order(cycle);

    expect(row.importCeased.coal).toBeUndefined();
  });

  test('with no deal waiting for several order months the merchants cease, and the reason says why', async () => {
    const { cycle, row, merchantLines } = build({
      dealStock: 0,
      relation: { importFailures: { coal: { no_merchants: 2 } } },
    });
    await order(cycle);

    expect(merchantLines).toHaveLength(0);
    expect(row.importCeased.coal).toMatchObject({ reason: 'no_merchants', by: 'merchants' });
  });

  test('with no trade warehouse built, the merchants cease for that reason, not for lack of merchants', async () => {
    const { cycle, row } = build({ withHub: false, relation: { importFailures: { coal: { no_warehouse: 2 } } } });
    await order(cycle);

    expect(row.importCeased.coal).toMatchObject({ reason: 'no_warehouse', by: 'merchants' });
  });

  test('a city whose confidence is gone ends the relation: it ceases, and says so', async () => {
    const { cycle, row, merchantLines } = build({ relation: { satisfactionScore: -80 } });
    await order(cycle);

    expect(row.status).toBe('expired');
    expect(row.ceased).toMatchObject({ reason: 'satisfaction_too_low', by: 'city' });
    expect(merchantLines).toHaveLength(0);
  });
});
