/**
 * Behavior tests — Supply: 'flag'-consumption distribution (School's coverage, standing in for any
 * remaining flag-mode service — the water tank is a quantity distributor, see buildingEconomy.js).
 * Proves DistributeResourceToConsumers' non-depleting branch: a service with no stock marks reached
 * houses "served this period" via their own periodLock instead of moving any resource quantity.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { unlimitedConsumerMoney } from '../../helpers/unlimitedConsumerMoney.js';
import { referencePriceBook } from '../../helpers/referencePriceBook.js';

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
    useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook);
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
    useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook);

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

// A service the catalog bounds (the Cabinet médical: 40 inhabitants per worker in post) reaches houses whole, in the order the catalog's rule
// gives, and never past its capacity, however often it is asked in the period.
describe('Supply — a bounded service (capacity per worker, houses served in the rule\'s order)', () => {
  const doctor = (id, worker) => createSupplyBuildingSnapshot({ id, type: 'Doctor', roadCount: 1, worker, workerNeed: 2, stocks: {} });
  // The queue stands for the composition's rule: the houses are served in the order it gives, here the order of `priority`.
  const queueOf = (priority) => ({ order: async (rule, houses) => {
    if (rule !== 'lowestHealth') throw new Error(`unexpected rule ${rule}`);
    return [...houses].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  } });

  let ids;
  let repo;
  let refs;

  beforeEach(() => {
    ids = { doctor: createBuildingInstanceId(), a: createBuildingInstanceId(), b: createBuildingInstanceId(), c: createBuildingInstanceId() };
    repo = new InMemorySupplyBuildingRepository([
      doctor(ids.doctor, 1),
      house(ids.a, { pop: 30 }),
      house(ids.b, { pop: 25 }),
      house(ids.c, { pop: 10 }),
    ]);
    refs = [{ instanceId: ids.a }, { instanceId: ids.b }, { instanceId: ids.c }];
  });

  test('one worker reaches 40 inhabitants: the first house in the queue, then the first that still fits', async () => {
    const useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook, queueOf([ids.a, ids.b, ids.c]));
    const outcome = await useCase.execute({ sourceId: ids.doctor, period: { monthIndex: 3 }, consumerRefs: refs });

    // a (30) fits; b (25) would make 55 > 40, passed over; c (10) fits: 40.
    expect(outcome.transfers.map((transfer) => transfer.consumerId)).toEqual([ids.a, ids.c]);
    expect((await repo.findById(ids.b)).servedFlags).toBeUndefined();
  });

  test('asked again in the same period it serves no more than its capacity', async () => {
    const useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook, queueOf([ids.a, ids.b, ids.c]));
    await useCase.execute({ sourceId: ids.doctor, period: { monthIndex: 3 }, consumerRefs: refs });
    const second = await useCase.execute({ sourceId: ids.doctor, period: { monthIndex: 3 }, consumerRefs: refs });
    expect(second.distributed).toBe(false);
    expect((await repo.findById(ids.b)).servedFlags).toBeUndefined();
  });

  test('the rule decides who is reached: the house the queue puts first is served before a larger one', async () => {
    const useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook, queueOf([ids.b, ids.c, ids.a]));
    const outcome = await useCase.execute({ sourceId: ids.doctor, period: { monthIndex: 3 }, consumerRefs: refs });
    // b (25) and c (10) fit within 40 (35); a (30) does not.
    expect(outcome.transfers.map((transfer) => transfer.consumerId)).toEqual([ids.b, ids.c]);
  });

  test('a bounded service asked without a service queue throws, naming what is missing', async () => {
    const useCase = new DistributeResourceToConsumers(repo, unlimitedConsumerMoney, referencePriceBook);
    await expect(useCase.execute({ sourceId: ids.doctor, period: { monthIndex: 3 }, consumerRefs: refs })).rejects.toThrow(/service queue/);
  });
});
