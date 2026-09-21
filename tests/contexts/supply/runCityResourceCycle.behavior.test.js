/**
 * Behavior tests — Supply: generic resource cycle (replaces the old
 * market/food-only RunCityMarketFoodCycle). Proves the actual claim that
 * motivated the replacement: which legs run is config, not per-resource
 * code — the same class distributes with or without a hub-restock leg.
 */
import { describe, test, expect } from '@jest/globals';
import { RunCityResourceCycle } from '../../../src/contexts/supply/application/commands/procurement/RunCityResourceCycle.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { TransferHubToHub } from '../../../src/contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createResourceStock } from '../../../src/contexts/supply/domain/value-objects/ResourceStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

// Market-Stall/Windmill-001/House-Blue are real catalog types — schedule,
// categories, totalKey, and hub-link field names all come from
// buildingCatalog.js (see buildingEconomy.js `hubLink` facts), not a
// test-local circuit.
const CATEGORIES = ['wheat', 'carrot', 'cabbage'];
const TOTAL_KEY = 'food';

function toSnapshot(b) {
  return createSupplyBuildingSnapshot({
    id: b.id,
    type: b.type,
    roadCount: b.roadCount,
    worker: b.worker,
    workerNeed: b.workerNeed,
    pop: b.pop,
    stocks: createResourceStock(b.stocks, CATEGORIES, TOTAL_KEY),
    maxStock: b.maxStock,
    supplyHubId: b.supplyHubId,
    linkedDistributors: b.linkedDistributors,
  });
}

class FakeSupplyBuildingRepository {
  constructor(buildings) {
    this.rows = new Map(buildings.map((b) => [b.id, { ...b }]));
  }

  async findById(id) {
    const b = this.rows.get(id);
    return b ? toSnapshot(b) : null;
  }

  async findBuildingRow(id) {
    const b = this.rows.get(id);
    return b ? { ...b } : null;
  }

  async listAllBuildingRows() {
    return [...this.rows.values()].map((b) => ({ ...b }));
  }

  async findByResourceRole(role, categories) {
    return [...this.rows.values()].filter((b) => hasResourceRole(b.type, role, categories)).map(toSnapshot);
  }

  async saveStocks(id, stocks) {
    const b = this.rows.get(id);
    if (b) b.stocks = { ...createResourceStock(stocks, CATEGORIES, TOTAL_KEY) };
  }

  async saveHubLinkedDistributors(hubId, linkedDistributors) {
    const b = this.rows.get(hubId);
    if (b) b.linkedDistributors = linkedDistributors;
  }

  async updateBuildingFields(id, fields) {
    const b = this.rows.get(id);
    if (!b) return;
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) b[key] = fields[key];
    }
  }
}

const MARKET_ID = createBuildingInstanceId();
const WINDMILL_ID = createBuildingInstanceId();
const HOUSE_ID = createBuildingInstanceId();
const HOUSE2_ID = createBuildingInstanceId();

function market(overrides = {}) {
  return {
    id: MARKET_ID,
    type: 'Market-Stall',
    x: 5,
    y: 5,
    roads: 1,
    roadCount: 1,
    worker: 0,
    workerNeed: 0,
    maxStock: 100,
    stocks: { wheat: 0, food: 0 },
    ...overrides,
  };
}

function house(id, overrides = {}) {
  return {
    id,
    type: 'House-Blue',
    x: 5,
    y: 6,
    roads: 1,
    roadCount: 1,
    worker: 0,
    workerNeed: 0,
    // Inhabitants, so the house has a demand and therefore something to be filled up to.
    pop: 10,
    stocks: { wheat: 0, food: 0 },
    ...overrides,
  };
}

const CHAPEL_ID = createBuildingInstanceId();

function chapel(overrides = {}) {
  return {
    id: CHAPEL_ID,
    type: 'Chapel',
    x: 5,
    y: 5,
    roads: 1,
    roadCount: 1,
    worker: 2,
    workerNeed: 2,
    stocks: {},
    ...overrides,
  };
}

describe('RunCityResourceCycle', () => {
  test('distributes directly to consumers when no hub leg is configured', async () => {
    const repo = new FakeSupplyBuildingRepository([
      market({ stocks: { wheat: 10, food: 10 } }),
      house(HOUSE_ID),
    ]);
    const distribute = new DistributeResourceToConsumers(repo);
    const events = [];
    const cycle = new RunCityResourceCycle(repo, distribute, { publish: (e) => events.push(e) });

    const result = await cycle.execute({
      categories: CATEGORIES,
      season: 'summer',
      timeInfo: { turn: 1 },
      maxDistance: 5,
    });

    expect(result.distributorsProcessed).toBe(1);
    const houseRow = await repo.findBuildingRow(HOUSE_ID);
    expect(houseRow.stocks.wheat).toBeGreaterThan(0);
    // Round-robin moves many units to the sole consumer across several
    // passes, but that's ONE walker event for the whole cycle — not one
    // per unit — carrying the distinct consumerIds reached.
    expect(events).toEqual([
      {
        type: 'supply.resourceDeliveryRoute',
        sourceId: MARKET_ID,
        consumerIds: [HOUSE_ID],
      },
    ]);
  });

  test('one event per cycle even when round-robin moves many units to many consumers', async () => {
    const repo = new FakeSupplyBuildingRepository([
      market({ stocks: { wheat: 10, food: 10 } }),
      house(HOUSE_ID),
      house(HOUSE2_ID),
    ]);
    const distribute = new DistributeResourceToConsumers(repo);
    const events = [];
    const cycle = new RunCityResourceCycle(repo, distribute, { publish: (e) => events.push(e) });

    await cycle.execute({
      categories: CATEGORIES,
      season: 'summer',
      timeInfo: { turn: 1 },
      maxDistance: 5,
    });

    // Each house received several units across round-robin passes (proving
    // the underlying transfers really are per-unit), yet exactly one
    // aggregated event fires for the whole cycle, listing each distinct
    // consumer once, in first-served order.
    const house1Stock = (await repo.findBuildingRow(HOUSE_ID)).stocks.wheat;
    const house2Stock = (await repo.findBuildingRow(HOUSE2_ID)).stocks.wheat;
    expect(house1Stock).toBeGreaterThan(1);
    expect(house2Stock).toBeGreaterThan(1);
    expect(events).toEqual([
      {
        type: 'supply.resourceDeliveryRoute',
        sourceId: MARKET_ID,
        consumerIds: [HOUSE_ID, HOUSE2_ID],
      },
    ]);
  });

  test('restocks from a linked hub first when a hub leg is configured, then distributes', async () => {
    const repo = new FakeSupplyBuildingRepository([
      {
        id: WINDMILL_ID,
        type: 'Windmill-001',
        x: 5,
        y: 4,
        roads: 1,
        roadCount: 1,
        worker: 0,
        workerNeed: 0,
        maxStock: 1000,
        stocks: { wheat: 20, food: 20 },
        linkedDistributors: [{ distributorId: MARKET_ID, allocatedStocks: { wheat: 10 } }],
      },
      market({ supplyHubId: WINDMILL_ID, stocks: { wheat: 0, food: 0 } }),
      house(HOUSE_ID),
    ]);
    const distribute = new DistributeResourceToConsumers(repo);
    const transferHubToHub = new TransferHubToHub(repo);
    let hubLinkResolved = null;
    const cycle = new RunCityResourceCycle(repo, distribute, undefined, {
      transferHubToHub,
      onHubLinkResolved: (marketId, hasHubLink) => {
        hubLinkResolved = { marketId, hasHubLink };
      },
    });

    await cycle.execute({
      categories: CATEGORIES,
      season: 'summer',
      month: 'January',
      timeInfo: { turn: 1 },
      maxDistance: 5,
    });

    expect(hubLinkResolved).toEqual({ marketId: MARKET_ID, hasHubLink: true });
    const houseRow = await repo.findBuildingRow(HOUSE_ID);
    expect(houseRow.stocks.wheat).toBeGreaterThan(0);
  });

  test('the hub gives only what the houses need, and the market keeps nothing back', async () => {
    const repo = new FakeSupplyBuildingRepository([
      {
        id: WINDMILL_ID,
        type: 'Windmill-001',
        x: 5,
        y: 4,
        roads: 1,
        roadCount: 1,
        worker: 0,
        workerNeed: 0,
        maxStock: 1000,
        stocks: { wheat: 100, food: 100 },
        linkedDistributors: [{ distributorId: MARKET_ID, allocatedStocks: { wheat: 100 } }],
      },
      market({ supplyHubId: WINDMILL_ID, stocks: { wheat: 0, food: 0 } }),
      house(HOUSE_ID),
    ]);
    const cycle = new RunCityResourceCycle(repo, new DistributeResourceToConsumers(repo), undefined, {
      transferHubToHub: new TransferHubToHub(repo),
    });

    await cycle.execute({ categories: CATEGORIES, season: 'summer', month: 'January', timeInfo: { turn: 1 } });

    // A house of 10 keeps two months of 1 unit each: 20. Nothing more leaves the hub.
    expect((await repo.findBuildingRow(HOUSE_ID)).stocks.wheat).toBe(20);
    expect((await repo.findBuildingRow(WINDMILL_ID)).stocks.wheat).toBe(80);
    expect((await repo.findBuildingRow(MARKET_ID)).stocks.wheat).toBe(0);

    // Next month the house is already full: the hub is left alone.
    await cycle.execute({ categories: CATEGORIES, season: 'summer', month: 'February', timeInfo: { turn: 2 } });
    expect((await repo.findBuildingRow(WINDMILL_ID)).stocks.wheat).toBe(80);
  });

  test('a hub-less flag distributor (chapel) marks houses served, no stock leg at all', async () => {
    const repo = new FakeSupplyBuildingRepository([chapel(), house(HOUSE_ID)]);
    const distribute = new DistributeResourceToConsumers(repo);
    const events = [];
    const cycle = new RunCityResourceCycle(repo, distribute, { publish: (e) => events.push(e) });

    const result = await cycle.execute({
      categories: ['faith'],
      season: 'summer',
      month: 'January',
      timeInfo: { turn: 1, monthIndex: 5 },
      maxDistance: 5,
    });

    expect(result.distributorsProcessed).toBe(1);
    const houseRow = await repo.findBuildingRow(HOUSE_ID);
    // Pinned to the EXACT monthIndex, not just "some number" — this is the
    // regression the bug hid behind: `period` built here used to omit
    // `monthIndex` (only `season`/`month`, the string name), so
    // PeriodLockPolicy.resolvePeriodKey('month', ...) fell back to 0 every
    // time. A house's tier-2 `serviceCoverage: 'faith'` requirement compares
    // this flag against the REAL current monthIndex (see
    // HouseTierRequirementPolicy.js), so a flag stuck at 0 only ever matched
    // in month 0 and looked permanently unserved (or caused a demotion)
    // every month after — Chapel could be fully staffed and in range and
    // houses would still never reach tier 2.
    expect(houseRow.servedFlags).toEqual({ faith: 5 });
    expect(events).toEqual([
      {
        type: 'supply.resourceDeliveryRoute',
        sourceId: CHAPEL_ID,
        consumerIds: [HOUSE_ID],
      },
    ]);
  });

  test('the served flag tracks the REAL current month across cycles, not a stuck value', async () => {
    const repo = new FakeSupplyBuildingRepository([chapel(), house(HOUSE_ID)]);
    const distribute = new DistributeResourceToConsumers(repo);
    const cycle = new RunCityResourceCycle(repo, distribute);

    await cycle.execute({
      categories: ['faith'],
      season: 'summer',
      timeInfo: { turn: 1, monthIndex: 6 },
      maxDistance: 5,
    });
    expect((await repo.findBuildingRow(HOUSE_ID)).servedFlags).toEqual({ faith: 6 });

    await cycle.execute({
      categories: ['faith'],
      season: 'summer',
      timeInfo: { turn: 2, monthIndex: 7 },
      maxDistance: 5,
    });
    expect((await repo.findBuildingRow(HOUSE_ID)).servedFlags).toEqual({ faith: 7 });
  });
});
