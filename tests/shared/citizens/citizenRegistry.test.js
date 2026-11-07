/**
 * The citizens follow the population of their house, in the same transaction as its row: arrivals are drawn, the latest
 * arrivals leave first, the identity of those who stay never changes, a demolished house takes its citizens with it, and the
 * residents of a house are the count of its citizens (never a stored number).
 */
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { DexieHousingBuildingRepository } from '../../../src/contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { DexieCitizenRegistry } from '../../../src/shared/citizens/DexieCitizenRegistry.js';
import { seedBuilding, clearBuildingsTable } from '../../helpers/buildingDb.js';
import { TEST_HAMLET_ID } from '../../helpers/testHamlet.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

let turn;
let registry;
let repository;
let houseId;

beforeEach(async () => {
  await clearBuildingsTable();
  await db.citizens.clear();
  turn = 0;
  let sequence = 0;
  registry = new DexieCitizenRegistry({
    currentTurn: () => turn,
    random: () => 0.5,
    newId: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
  });
  repository = new DexieHousingBuildingRepository({ citizens: registry });
  const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
  houseId = record.instanceId;
  await seedBuilding(record);
});

const house = () => ({ houseId, hamletId: TEST_HAMLET_ID });

describe('citizens — one per resident, written with the house', () => {
  test('arrivals are drawn at the turn they arrive; the latest arrivals leave first and the others keep their identity', async () => {
    await repository.savePopulation(houseId, { pop: 2 });
    turn = 5;
    await repository.savePopulation(houseId, { pop: 4 });
    const before = await registry.forHouse({ ...house(), pop: 4 });
    expect(before.map((citizen) => citizen.arrivalTurn)).toEqual([0, 0, 5, 5]);

    await repository.savePopulation(houseId, { pop: 3 });
    const after = await registry.forHouse({ ...house(), pop: 3 });
    expect(after.map((citizen) => citizen.id)).toEqual(before.slice(0, 3).map((citizen) => citizen.id));
    expect(after).toEqual(before.slice(0, 3));
  });

  // The residents of a house are its citizens: `pop` is never stored on the row, it is the count the citizens make, whatever a writer puts in the row.
  test('a house\'s pop is the count of its citizens, never a stored number', async () => {
    await repository.savePopulation(houseId, { pop: 2 });
    expect((await db.houses.get(houseId)).pop).toBe(2);
    expect((await repository.findById(houseId)).pop).toBe(2);

    // A writer that puts a number in the row changes nothing.
    await db.houses.put({ ...(await db.houses.get(houseId)), pop: 9 });
    expect((await db.houses.get(houseId)).pop).toBe(2);

    // A transaction that aborts moves no count.
    await expect(db.transaction('rw', db.houses, db.citizens, async () => {
      await registry.removeHouse(houseId);
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect((await db.houses.get(houseId)).pop).toBe(2);
  });

  test('a demolished house takes its citizens with it', async () => {
    await repository.savePopulation(houseId, { pop: 3 });
    await db.transaction('rw', db.houses, db.citizens, async () => {
      await registry.removeHouse(houseId);
      await db.houses.delete(houseId);
    });
    expect(await db.citizens.where('houseId').equals(houseId).count()).toBe(0);
  });
});
