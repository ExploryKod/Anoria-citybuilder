/**
 * Regression: a merchant's trade deals (dealCoal…) are agreements with no value yet, so they sell at 0. The hub's purchase limit divided by that price and threw;
 * the cycle swallows a collection that throws, so nothing was collected and the next check ("a working hub has room, yet it was not collected") failed the tick.
 */
import { describe, expect, test } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { CollectResourceToHub } from '../../../src/contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { getResourceRoles } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

class Repo {
  constructor(rows) {
    this.raw = new Map(rows.map((row) => [row.id, { ...row, stocks: { ...row.stocks } }]));
  }

  async findById(id) {
    const row = this.raw.get(id);
    return row ? { ...row, stocks: createSupplyStock(row.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    this.raw.get(id).stocks = { ...createSupplyStock(stocks) };
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.raw.get(id), fields);
  }
}

describe('a hub that cannot pay still collects what costs nothing', () => {
  test('the trade deals of a merchant house are collected by the trade warehouse with no money at all', async () => {
    const hubId = createBuildingInstanceId();
    const merchantId = createBuildingInstanceId();
    const repo = new Repo([
      createSupplyBuildingSnapshot({ id: hubId, type: 'TradeWarehouse', roadCount: 1, worker: 1, workerNeed: 1, stocks: { goods: 0, dealCoal: 0 }, maxStock: 500 }),
      createSupplyBuildingSnapshot({ id: merchantId, type: 'House-Blue', roadCount: 1, stocks: { dealCoal: 20 }, maxStock: 100 }),
    ]);
    const priceBook = { ensure: async () => {}, sellingPrice: () => 0 };
    const collect = new CollectResourceToHub(repo, null, { priceBook, purchasingPower: async () => 0 });
    // The merchants' window opens every other month (an interval and an offset): the first month it matches.
    const { schedule } = getResourceRoles('House-Blue').find((entry) => entry.role === 'producer' && entry.categories.includes('dealCoal')).sale;
    const period = { [schedule.unit]: schedule.offset, turn: 1 };

    const outcome = await collect.execute({ hubId, sourceRefs: [{ instanceId: merchantId }], period });

    expect(outcome.collected).toBe(true);
    expect(repo.raw.get(hubId).stocks.dealCoal).toBe(20);
  });

  test('a hub that can pay only part of what a farm offers tells the farm, so that the failed sale is explained by it', async () => {
    const hubId = createBuildingInstanceId();
    const farmId = createBuildingInstanceId();
    const repo = new Repo([
      createSupplyBuildingSnapshot({ id: hubId, type: 'Windmill-001', roadCount: 1, worker: 1, workerNeed: 1, stocks: { wheat: 0, food: 0 }, maxStock: 1000 }),
      createSupplyBuildingSnapshot({ id: farmId, type: 'Farm-Wheat', roadCount: 1, stocks: { wheat: 10, food: 10 }, maxStock: 100 }),
    ]);
    // A unit costs 1 and the hub can pay 4.
    const collect = new CollectResourceToHub(repo, null, { priceBook: { ensure: async () => {}, sellingPrice: () => 1 }, purchasingPower: async () => 4 });

    const outcome = await collect.execute({ hubId, sourceRefs: [{ instanceId: farmId }], period: { month: 'december', turn: 1 } });

    expect(outcome.totalUnits).toBe(4);
    expect(repo.raw.get(farmId).unpaidByHub).toBe(true);
  });
});
