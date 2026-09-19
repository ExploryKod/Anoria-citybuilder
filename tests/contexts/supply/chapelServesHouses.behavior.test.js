/**
 * Behavior tests — Supply: 'flag'-consumption distribution (chapel faith
 * coverage). Proves DistributeResourceToConsumers' non-depleting branch:
 * a service with no stock marks reached houses "served this period" via
 * their own periodLock instead of moving any resource quantity.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? createSupplyBuildingSnapshot({ ...b, stocks: createSupplyStock(b.stocks) }) : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (!b) return;
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) b[key] = fields[key];
    }
  }
}

function chapel(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'Chapel',
    roadCount: 1,
    worker: 2,
    workerNeed: 2,
    stocks: {},
    ...extras,
  });
}

function house(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount: 1,
    stocks: {},
    ...extras,
  });
}

describe('Supply — chapel faith coverage (flag consumption)', () => {
  let repo;
  let useCase;
  let chapelId;
  let house1Id;
  let house2Id;

  beforeEach(() => {
    chapelId = createBuildingInstanceId();
    house1Id = createBuildingInstanceId();
    house2Id = createBuildingInstanceId();
    repo = new InMemorySupplyBuildingRepository([chapel(chapelId), house(house1Id), house(house2Id)]);
    useCase = new DistributeResourceToConsumers(repo);
  });

  test('marks reached houses served this month, no stock moves at all', async () => {
    const outcome = await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }, { instanceId: house2Id }],
    });

    expect(outcome.distributed).toBe(true);
    expect(outcome.totalUnits).toBe(2);
    expect(outcome.transfers).toEqual(
      expect.arrayContaining([
        { consumerId: house1Id, category: 'faith', amount: 1 },
        { consumerId: house2Id, category: 'faith', amount: 1 },
      ])
    );

    const h1 = await repo.findById(house1Id);
    // Shared servedFlags field, keyed by category — same "one field, many
    // keys" shape `stocks` already uses, so a new service never needs a
    // new field name (see PeriodLockPolicy.js).
    expect(h1.servedFlags).toEqual({ faith: 3 });
    // Food consumer entry on the same house untouched by the faith pass.
    expect(h1.stocks.food).toBe(0);
  });

  test('refuses a second pass in the same month — nothing left to serve', async () => {
    await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    const second = await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(second.distributed).toBe(false);
    expect(second.reason).toBe('nothing_distributed');
  });

  test('serves again the following month', async () => {
    await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    const next = await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 4 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(next.distributed).toBe(true);
    expect((await repo.findById(house1Id)).servedFlags).toEqual({ faith: 4 });
  });

  test('skips a house without road access', async () => {
    repo = new InMemorySupplyBuildingRepository([chapel(chapelId), house(house1Id, { roadCount: 0 })]);
    useCase = new DistributeResourceToConsumers(repo);

    const outcome = await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 1 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.distributed).toBe(false);
    expect(outcome.reason).toBe('nothing_distributed');
    expect((await repo.findById(house1Id)).servedFlags).toBeUndefined();
  });

  test('runs with an empty chapel stock — flag mode never checks source stock', async () => {
    // Chapel declares no `stocks` role at all; this asserts the flag branch
    // never reaches the 'source_empty' check the quantity branch has.
    const outcome = await useCase.execute({
      sourceId: chapelId,
      period: { monthIndex: 1 },
      consumerRefs: [{ instanceId: house1Id }],
    });
    expect(outcome.distributed).toBe(true);
  });
});
