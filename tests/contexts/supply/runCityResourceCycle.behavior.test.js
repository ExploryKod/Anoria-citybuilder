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

const CATEGORIES = ['wheat'];
const TOTAL_KEY = 'food';

const DISTRIBUTE_CIRCUIT = {
  categories: CATEGORIES,
  totalKey: TOTAL_KEY,
  canDistribute: () => true,
};

const HUB_TRANSFER_CIRCUIT = {
  categories: CATEGORIES,
  totalKey: TOTAL_KEY,
  canTransfer: () => true,
  sourceLinkField: 'supplyWindmillId',
  linksField: 'linkedMarkets',
  allocationField: 'allocatedStocks',
  linkTargetIdField: 'marketId',
  saveLinks: async (repository, sourceId, links) => repository.saveLinkedMarkets(sourceId, links),
};

function toSnapshot(b) {
  return createSupplyBuildingSnapshot({
    id: b.id,
    type: b.type,
    roadCount: b.roadCount,
    worker: b.worker,
    workerNeed: b.workerNeed,
    stocks: createResourceStock(b.stocks, CATEGORIES, TOTAL_KEY),
    maxStock: b.maxStock,
    supplyWindmillId: b.supplyWindmillId,
    linkedMarkets: b.linkedMarkets,
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

  async saveLinkedMarkets(windmillId, linkedMarkets) {
    const b = this.rows.get(windmillId);
    if (b) b.linkedMarkets = linkedMarkets;
  }
}

const MARKET_ID = createBuildingInstanceId();
const WINDMILL_ID = createBuildingInstanceId();
const HOUSE_ID = createBuildingInstanceId();

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
    stocks: { wheat: 0, food: 0 },
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
      distributeCircuit: DISTRIBUTE_CIRCUIT,
      season: 'summer',
      timeInfo: { turn: 1 },
      maxDistance: 5,
    });

    expect(result.distributorsProcessed).toBe(1);
    const houseRow = await repo.findBuildingRow(HOUSE_ID);
    expect(houseRow.stocks.wheat).toBeGreaterThan(0);
    // Round-robin distributes 1 unit/pass to the sole consumer — several
    // events, all for the same source/consumer/category pair.
    expect(events.length).toBeGreaterThan(0);
    expect(events.reduce((sum, e) => sum + e.amount, 0)).toBe(houseRow.stocks.wheat);
    for (const event of events) {
      expect(event).toMatchObject({
        type: 'supply.resourceDelivered',
        sourceId: MARKET_ID,
        consumerId: HOUSE_ID,
        category: 'wheat',
      });
    }
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
        linkedMarkets: [{ marketId: MARKET_ID, allocatedStocks: { wheat: 10 } }],
      },
      market({ supplyWindmillId: WINDMILL_ID, stocks: { wheat: 0, food: 0 } }),
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
      distributeCircuit: DISTRIBUTE_CIRCUIT,
      hubTransferCircuit: HUB_TRANSFER_CIRCUIT,
      season: 'summer',
      month: 'January',
      timeInfo: { turn: 1 },
      maxDistance: 5,
    });

    expect(hubLinkResolved).toEqual({ marketId: MARKET_ID, hasHubLink: true });
    const houseRow = await repo.findBuildingRow(HOUSE_ID);
    expect(houseRow.stocks.wheat).toBeGreaterThan(0);
  });
});
