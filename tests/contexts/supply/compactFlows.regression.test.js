import { beforeEach, describe, expect, test } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { DexieSupplyTraceabilityRepository } from '../../../src/contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';

const HAMLET = '33333333-3333-4333-8333-333333333333';
const SELLER = '11111111-1111-4111-8111-111111111111';
const BUYER = '22222222-2222-4222-8222-222222222222';
const OTHER_BUYER = '44444444-4444-4444-8444-444444444444';

describe('compactFlowsOfMonth — a settled month keeps the sums of its transfers', () => {
  let repository;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    useHamletForTests(HAMLET);
    repository = new DexieSupplyTraceabilityRepository();
  });

  test('one row per seller, buyer and good, and every reader still reads the same sums', async () => {
    const seller = { id: SELLER, x: 1, y: 1, type: 'Market-Stall-Red' };
    for (const turn of [10, 11, 12]) await repository.recordDistributorToConsumer(turn, 2, 1, seller, { id: BUYER, x: 2, y: 2, type: 'House-Blue' }, 'wheat', 4, 0.5);
    await repository.recordDistributorToConsumer(11, 2, 1, seller, { id: OTHER_BUYER, x: 3, y: 3, type: 'House-Blue' }, 'wheat', 1, 0.5);
    await repository.recordDistributorToConsumer(60, 3, 1, seller, { id: BUYER, x: 2, y: 2, type: 'House-Blue' }, 'wheat', 9, 0.5);
    const soldBefore = await repository.sumUnitsSoldBySeller(1, 2);

    const outcome = await repository.compactFlowsOfMonth(1, 2);

    expect(outcome).toEqual({ merged: 1, removed: 3 });
    expect(await repository.sumUnitsSoldBySeller(1, 2)).toEqual(soldBefore);
    const march = (await db.supplyTraceability.toArray()).filter((row) => row.month === 2 && row.toId === BUYER);
    expect(march).toHaveLength(1);
    expect(march[0]).toMatchObject({ quantity: 12, totalPrice: 6, price: 0.5, turn: 12 });
    // Another month is left as it is.
    expect((await db.supplyTraceability.toArray()).filter((row) => row.month === 3)).toHaveLength(1);
  });

  test('sumChainFlows tells what the producers sold on, what the houses were sold and what was lost, over a range of months', async () => {
    const farm = { id: SELLER, x: 1, y: 1, type: 'Farm-Wheat' };
    const hub = { id: BUYER, x: 2, y: 2, type: 'Windmill-001' };
    await repository.recordSourceToHub(10, 2, 1, farm, hub, 'wheat', 288, 0.4);
    await repository.recordDistributorToConsumer(11, 2, 1, hub, { id: OTHER_BUYER, x: 3, y: 3, type: 'House-Blue' }, 'wheat', 60, 0.5);
    await repository.addTransaction(12, 2, 1, 'game_event', farm, null, null, 25, 0, { event: 'goods_spoiled', details: { good: 'wheat' } });
    await repository.recordSourceToHub(70, 8, 1, farm, hub, 'wheat', 99, 0.4);

    expect(await repository.sumChainFlows({ fromKey: 14, toKey: 14 })).toEqual({ collected: { wheat: 288 }, sold: { wheat: 60 }, spoiled: { wheat: 25 } });
    expect((await repository.sumChainFlows({ fromKey: 14, toKey: 20 })).collected).toEqual({ wheat: 387 });
  });
});
