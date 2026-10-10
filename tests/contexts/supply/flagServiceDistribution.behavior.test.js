/**
 * Behavior tests — Supply: 'flag'-consumption distribution (School's coverage, standing in for any
 * remaining flag-mode service — Chapel itself left flag mode on 2026-10-10, see buildingEconomy.js).
 * Proves DistributeResourceToConsumers' non-depleting branch: a service with no stock marks reached
 * houses "served this period" via their own periodLock instead of moving any resource quantity.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { unlimitedConsumerMoney } from '../../helpers/unlimitedConsumerMoney.js';

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

function school(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'School',
    roadCount: 1,
    worker: 3,
    workerNeed: 3,
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

describe('Supply — school coverage (flag consumption)', () => {
  let repo;
  let useCase;
  let schoolId;
  let house1Id;
  let house2Id;

  beforeEach(() => {
    schoolId = createBuildingInstanceId();
    house1Id = createBuildingInstanceId();
    house2Id = createBuildingInstanceId();
    repo = new InMemorySupplyBuildingRepository([school(schoolId), house(house1Id), house(house2Id)]);
    useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney);
  });

  test('marks reached houses served this month, no stock moves at all', async () => {
    const outcome = await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }, { instanceId: house2Id }],
    });

    expect(outcome.distributed).toBe(true);
    expect(outcome.totalUnits).toBe(2);
    expect(outcome.transfers).toEqual(
      expect.arrayContaining([
        { consumerId: house1Id, category: 'school', amount: 1 },
        { consumerId: house2Id, category: 'school', amount: 1 },
      ])
    );

    const h1 = await repo.findById(house1Id);
    // Shared servedFlags field, keyed by category — same "one field, many
    // keys" shape `stocks` already uses, so a new service never needs a
    // new field name (see PeriodLockPolicy.js).
    expect(h1.servedFlags).toEqual({ school: 3 });
    // Food consumer entry on the same house untouched by the school pass.
    expect(h1.stocks.food).toBe(0);
  });

  test('refuses a second pass in the same month — nothing left to serve', async () => {
    await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    const second = await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(second.distributed).toBe(false);
    expect(second.reason).toBe('nothing_distributed');
  });

  test('serves again the following month', async () => {
    await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 3 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    const next = await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 4 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(next.distributed).toBe(true);
    expect((await repo.findById(house1Id)).servedFlags).toEqual({ school: 4 });
  });

  test('skips a house without road access', async () => {
    repo = new InMemorySupplyBuildingRepository([school(schoolId), house(house1Id, { roadCount: 0 })]);
    useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney);

    const outcome = await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 1 },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.distributed).toBe(false);
    expect(outcome.reason).toBe('nothing_distributed');
    expect((await repo.findById(house1Id)).servedFlags).toBeUndefined();
  });

  test('runs with an empty school stock — flag mode never checks source stock', async () => {
    // School declares no `stocks` role at all; this asserts the flag branch
    // never reaches the 'source_empty' check the quantity branch has.
    const outcome = await useCase.execute({
      sourceId: schoolId,
      period: { monthIndex: 1 },
      consumerRefs: [{ instanceId: house1Id }],
    });
    expect(outcome.distributed).toBe(true);
  });
});
