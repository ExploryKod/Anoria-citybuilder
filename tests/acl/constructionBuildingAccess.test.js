/**
 * ACL Construction — building row access (replaces legacy HousesStore CRUD tests)
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { resetConstructionContextForTests } from '../../src/composition/createConstructionContext.js';
import { resetCityAssetsContextForTests } from '../../src/composition/createCityAssetsContext.js';
import { resetHousingContextForTests } from '../../src/composition/createHousingContext.js';
import { createBuildingInstanceId } from '../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';
import { clearBuildingsTable, seedBuilding, getBuildingRow } from '../helpers/buildingDb.js';
import {
  placeBuildingRecord,
  getBuildingById,
  getBuildingField,
  updateBuildingFields,
  findBuildingAtTile,
  listAllBuildingRows,
  removeBuildingRecord,
  incrementBuildingField,
} from '../../src/composition/constructionOps.js';
import { getCityTotalBuildingValue, getCityBuildingPricesByType } from '../../src/composition/budgetOps.js';
import { getCityTotalPopulation, getFamishedPopulation, clearPopulationWithoutRoadAccess } from '../../src/composition/housingOps.js';

describe('ACL Construction — building access', () => {
  beforeEach(async () => {
    resetConstructionContextForTests();
    resetCityAssetsContextForTests();
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  afterEach(async () => {
    resetConstructionContextForTests();
    resetCityAssetsContextForTests();
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  describe('placeBuildingRecord', () => {
    test('persists a building row', async () => {
      const record = makeHouseRecord({ type: 'House-Blue', x: 5, y: 3 });
      const result = await placeBuildingRecord(record);

      expect(result.success).toBe(true);
      const row = await getBuildingById(record.instanceId);
      expect(row?.type).toBe('House-Blue');
    });

    test('put is idempotent for the same instanceId', async () => {
      const record = makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2 });
      await seedBuilding(record);

      const result = await placeBuildingRecord({ ...record, type: 'Farm-Wheat' });
      expect(result.success).toBe(true);
      expect(result.instanceId).toBe(record.instanceId);

      const rows = await listAllBuildingRows();
      expect(rows.filter((r) => r.instanceId === record.instanceId)).toHaveLength(1);
    });
  });

  describe('getBuildingById / getBuildingField', () => {
    test('returns row and field values with defaults', async () => {
      const record = makeHouseRecord({
        type: 'House-Blue',
        x: 0,
        y: 0,
        extra: {
          pop: 3,
          stocks: { food: 5, wheat: 3, carrot: 2, cabbage: 0 },
        },
      });
      await seedBuilding(record);

      expect(await getBuildingById(record.instanceId)).toBeDefined();
      expect(await getBuildingField(record.instanceId, 'pop')).toBe(3);
      expect(await getBuildingField(record.instanceId, 'stocks')).toEqual({
        food: 5,
        wheat: 3,
        carrot: 2,
        cabbage: 0,
      });
      expect(await getBuildingField(createBuildingInstanceId(), 'pop')).toBe(0);
      expect(await getBuildingField(record.instanceId, 'unknownKey')).toBe(false);
    });
  });

  describe('updateBuildingFields', () => {
    test('updates existing row only', async () => {
      const record = makeHouseRecord({ type: 'Farm-Wheat', x: 5, y: 5, extra: { pop: 0 } });
      await seedBuilding(record);

      await updateBuildingFields(record.instanceId, { pop: 2 });
      expect((await getBuildingById(record.instanceId)).pop).toBe(2);

      const missingId = createBuildingInstanceId();
      await updateBuildingFields(missingId, { pop: 1 });
      expect(await getBuildingById(missingId)).toBeUndefined();
    });
  });

  describe('findBuildingAtTile / listAllBuildingRows / removeBuildingRecord', () => {
    test('finds, lists, and removes buildings', async () => {
      const record = makeHouseRecord({ type: 'House-Blue', x: 4, y: 6 });
      await seedBuilding(record);
      await seedBuilding(makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2 }));

      const found = await findBuildingAtTile({ x: 4, y: 6 });
      expect(found?.instanceId).toBe(record.instanceId);
      expect((await listAllBuildingRows())).toHaveLength(2);

      await removeBuildingRecord(record.instanceId);
      expect(await getBuildingById(record.instanceId)).toBeUndefined();
    });
  });

  describe('incrementBuildingField', () => {
    test('increments numeric field', async () => {
      const record = makeHouseRecord({ type: 'Farm-Wheat', x: 5, y: 5 });
      await seedBuilding(record);
      await updateBuildingFields(record.instanceId, { foodCount: 5 });

      await incrementBuildingField({
        instanceId: record.instanceId,
        field: 'foodCount',
        increment: 3,
      });

      expect((await getBuildingById(record.instanceId)).foodCount).toBe(8);
    });
  });
});

describe('ACL cross-context reads (formerly HousesStore facades)', () => {
  beforeEach(async () => {
    resetConstructionContextForTests();
    resetCityAssetsContextForTests();
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  afterEach(async () => {
    resetConstructionContextForTests();
    resetCityAssetsContextForTests();
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  test('getCityTotalPopulation sums residential pop only', async () => {
    await seedBuilding(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 3 } }));
    await seedBuilding(makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 4 } }));
    await seedBuilding(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { pop: 99 } }));

    expect(await getCityTotalPopulation()).toBe(7);
  });

  test('getFamishedPopulation counts unfed residents', async () => {
    await seedBuilding(
      makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 6, stocks: { food: 3 } } })
    );
    await seedBuilding(
      makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 4, stocks: { food: 2 } } })
    );

    expect(await getFamishedPopulation()).toBe(5);
  });

  test('getCityTotalBuildingValue and prices by type', async () => {
    await seedBuilding(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } }));
    await seedBuilding(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { price: 20 } }));

    expect(await getCityTotalBuildingValue()).toBe(30);

    const byType = await getCityBuildingPricesByType();
    expect(byType['House-Blue']).toBe(10);
    expect(byType['Farm-Wheat']).toBe(20);
  });

  test('clearPopulationWithoutRoadAccess zeros pop without roads (Palace only — legacy safety net)', async () => {
    // Blue/Red/Purple are level-based now (see HouseLevelPolicy): losing a
    // road demotes level + clamps pop, it never hard-resets to 0 anymore.
    const isolated = makeHouseRecord({
      type: 'House-2Story',
      x: 1,
      y: 1,
      extra: { pop: 3, roads: 0 },
    });
    const connected = makeHouseRecord({
      type: 'House-2Story',
      x: 2,
      y: 2,
      extra: { pop: 3, roads: 1 },
    });
    await seedBuilding(isolated);
    await seedBuilding(connected);

    const result = await clearPopulationWithoutRoadAccess();
    expect(result.totalPopulationLost).toBe(3);
    expect((await getBuildingRow(isolated.instanceId)).pop).toBe(0);
    expect((await getBuildingRow(connected.instanceId)).pop).toBe(3);
  });

  test('clearPopulationWithoutRoadAccess leaves Blue/Red/Purple houses untouched (handled by HouseLevelPolicy instead)', async () => {
    const isolated = makeHouseRecord({
      type: 'House-Blue',
      x: 1,
      y: 1,
      extra: { pop: 3, roads: 0 },
    });
    await seedBuilding(isolated);

    const result = await clearPopulationWithoutRoadAccess();
    expect(result.totalPopulationLost).toBe(0);
    expect((await getBuildingRow(isolated.instanceId)).pop).toBe(3);
  });
});
