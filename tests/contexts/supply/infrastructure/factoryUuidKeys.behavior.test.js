/**
 * Integration — factory production uses instanceId (UUID) as Dexie PK.
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { clearBuildingsTable, seedBuilding, getBuildingRow } from '../../../helpers/buildingDb.js';
import { DexieFactoryBuildingRepository } from '../../../../src/contexts/supply/infrastructure/dexie/DexieFactoryBuildingRepository.js';
import { ProcessFactoryProductionStep } from '../../../../src/contexts/supply/application/commands/manufacturing/ProcessFactoryProductionStep.js';
import { CollectFactoryResources } from '../../../../src/contexts/supply/application/commands/manufacturing/CollectFactoryResources.js';
import { TransformFactoryMaterials } from '../../../../src/contexts/supply/application/commands/manufacturing/TransformFactoryMaterials.js';
import { ProduceFactoryGoods } from '../../../../src/contexts/supply/application/commands/manufacturing/ProduceFactoryGoods.js';
import { instanceIdFromHouseRow } from '../../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../../fixtures/buildingRecord.js';

describe('Factory production — UUID Dexie keys', () => {
  let repository;
  let factoryRecord;
  let treeRecord;

  beforeEach(async () => {
    await clearBuildingsTable();
    repository = new DexieFactoryBuildingRepository();

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

    await seedBuilding(factoryRecord);
    await seedBuilding(treeRecord);
  });

  afterEach(async () => {
    await clearBuildingsTable();
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

    const row = await getBuildingRow(factoryRecord.instanceId);
    expect(row).toBeDefined();
    expect(await getBuildingRow('Winery-001-4-4')).toBeUndefined();
  });

  test('CollectFactoryResources updates nature item by instanceId', async () => {
    const collect = new CollectFactoryResources(repository, null);

    await collect.execute({
      factoryId: factoryRecord.instanceId,
      time: 1,
    });

    const tree = await getBuildingRow(treeRecord.instanceId);
    expect(tree).toBeDefined();
  });
});
