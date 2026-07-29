/**
 * Integration — factory production uses instanceId (UUID) as Dexie PK.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HouseStore } from '../../../../src/js/stores/HousesStore.js';
import { DexieFactoryBuildingRepository } from '../../../../src/contexts/supply/infrastructure/dexie/DexieFactoryBuildingRepository.js';
import { ProcessFactoryProductionStep } from '../../../../src/contexts/supply/application/commands/manufacturing/ProcessFactoryProductionStep.js';
import { CollectFactoryResources } from '../../../../src/contexts/supply/application/commands/manufacturing/CollectFactoryResources.js';
import { TransformFactoryMaterials } from '../../../../src/contexts/supply/application/commands/manufacturing/TransformFactoryMaterials.js';
import { ProduceFactoryGoods } from '../../../../src/contexts/supply/application/commands/manufacturing/ProduceFactoryGoods.js';
import { instanceIdFromHouseRow } from '../../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../../fixtures/buildingRecord.js';

function createTestDb() {
  const db = new Dexie('testFactoryUuidDb');
  db.version(1).stores({
    houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
    game: 'name',
    budget: 'name',
    objectives: 'name',
    journal: '++id, turn, date, type, amount, description',
    foodTraceability:
      '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
  });
  return db;
}

describe('Factory production — UUID Dexie keys', () => {
  let housesStore;
  let repository;
  let testDb;
  let factoryRecord;
  let treeRecord;

  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.open();
    housesStore = new HouseStore();
    housesStore.db = testDb;
    repository = new DexieFactoryBuildingRepository(housesStore);

    factoryRecord = makeHouseRecord({
      type: 'Winery-001',
      x: 4,
      y: 4,
      extra: {
        roads: 1,
        employees: { worker: 2, worker_need: 2 },
        rawMaterials: {},
        products: {},
      },
    });
    treeRecord = makeHouseRecord({
      type: 'Tree-Pine-001',
      x: 5,
      y: 4,
      extra: {
        category: 'nature',
        stocks: { wood: 1 },
      },
    });

    await housesStore.addHouse(factoryRecord);
    await housesStore.addHouse(treeRecord);
  });

  afterEach(async () => {
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
  });

  test('ProcessFactoryProductionStep resolves factory row by instanceId', async () => {
    const collect = new CollectFactoryResources(repository, null);
    const transform = new TransformFactoryMaterials(repository, null);
    const produce = new ProduceFactoryGoods(repository, null);
    const step = new ProcessFactoryProductionStep(
      repository,
      collect,
      transform,
      produce
    );

    const factories = await repository.findFactories();
    expect(factories).toHaveLength(1);

    const factoryId = instanceIdFromHouseRow(factories[0]);
    expect(factoryId).toBe(factoryRecord.instanceId);

    await step.execute({ factory: factories[0], time: 1 });

    const row = await housesStore.getHouse(factoryRecord.instanceId);
    expect(row).toBeDefined();
    expect(await housesStore.getHouse('Winery-001-4-4')).toBeUndefined();
  });

  test('CollectFactoryResources updates nature item by instanceId', async () => {
    const collect = new CollectFactoryResources(repository, null);

    await collect.execute({
      factoryId: factoryRecord.instanceId,
      time: 1,
    });

    const tree = await housesStore.getHouse(treeRecord.instanceId);
    expect(tree).toBeDefined();
  });
});
