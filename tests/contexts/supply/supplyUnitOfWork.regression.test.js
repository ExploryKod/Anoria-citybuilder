import { beforeEach, describe, expect, test } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { DexieSupplyBuildingRepository } from '../../../src/contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { DexieSupplyTraceabilityRepository } from '../../../src/contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const row = (instanceId, extra = {}) => ({ instanceId, id: instanceId, type: 'Farm-Wheat', x: 1, y: 1, stocks: {}, ...extra });

describe('DexieSupplyBuildingRepository.inUnitOfWork', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('writes the changes once at the end, and a building removed meanwhile is not written back', async () => {
    await db.houses.bulkPut([row(A), row(B)]);
    const repository = new DexieSupplyBuildingRepository();

    await repository.inUnitOfWork(async () => {
      await repository.updateBuildingFields(A, { lastProductionYear: 3 });
      await repository.updateBuildingFields(B, { lastProductionYear: 4 });
      expect((await repository.findBuildingRow(A)).lastProductionYear).toBe(3);
      expect((await db.houses.get(A)).lastProductionYear).toBeUndefined();
      await db.houses.delete(B);
    });

    expect((await db.houses.get(A)).lastProductionYear).toBe(3);
    expect(await db.houses.get(B)).toBeUndefined();
  });

  test('a field another context changed meanwhile survives the flush, and reads are copies', async () => {
    await db.houses.bulkPut([row(A, { pop: 1 })]);
    const repository = new DexieSupplyBuildingRepository();

    await repository.inUnitOfWork(async () => {
      const copy = await repository.findBuildingRow(A);
      copy.lastProductionYear = 99;
      await repository.updateBuildingFields(A, { lastConsumptionMonth: 2 });
      await db.houses.update(A, { pop: 7 });
      expect((await repository.findBuildingRow(A)).lastProductionYear).toBeUndefined();
    });

    const stored = await db.houses.get(A);
    expect(stored.pop).toBe(7);
    expect(stored.lastConsumptionMonth).toBe(2);
    expect(stored.lastProductionYear).toBeUndefined();
  });

  test('traceability rows added in a unit of work are written together, in order, and a read inside it sees them', async () => {
    useHamletForTests('33333333-3333-4333-8333-333333333333');
    const repository = new DexieSupplyTraceabilityRepository();
    const house = { id: A, x: 1, y: 1, type: 'House-Blue' };

    await repository.inUnitOfWork(async () => {
      await repository.addTransaction(5, 2, 1, 'chain_state', house, null, 'wheat', 1, 0);
      await repository.addTransaction(5, 2, 1, 'chain_state', house, null, 'fish', 2, 0);
      expect(await db.supplyTraceability.count()).toBe(0);
      expect((await repository.getTransactionsForMonth(5)).length).toBe(2);
    });

    const rows = await db.supplyTraceability.toArray();
    expect(rows.map((r) => r.foodType)).toEqual(['wheat', 'fish']);
  });
});
