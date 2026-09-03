/**
 * ACL Supply — UI read helpers (storage-section)
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import db from '../../src/core/persistence/dexie/db.js';
import { resetSupplyContextForTests } from '../../src/composition/createSupplyContext.js';
import {
  listWindmillSupplyViews,
  listCommercializableWindmills,
  listSupplyMapBuildings,
  listNatureResources,
} from '../../src/composition/supplyOps.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

async function clearHousesTable() {
  await db.open();
  await db.houses.clear();
}

describe('ACL Supply UI queries', () => {
  beforeEach(async () => {
    resetSupplyContextForTests();
    await clearHousesTable();
  });

  afterEach(async () => {
    resetSupplyContextForTests();
    await clearHousesTable();
  });

  test('listWindmillSupplyViews exposes commerce flags and stocks', async () => {
    const windmillId = makeHouseRecord({
      type: 'Windmill-001',
      x: 1,
      y: 1,
      extra: {
        stocks: { wheat: 5, wood: 2 },
        isActive: false,
        commercializeEnabled: true,
      },
    }).instanceId;

    await db.houses.add(
      makeHouseRecord({
        type: 'Windmill-001',
        x: 1,
        y: 1,
        instanceId: windmillId,
        extra: {
          stocks: { wheat: 5, wood: 2 },
          isActive: false,
          commercializeEnabled: true,
        },
      })
    );

    const views = await listWindmillSupplyViews();
    expect(views).toHaveLength(1);
    expect(views[0].buildingId).toBe(windmillId);
    expect(views[0].instanceId).toBe(windmillId);
    expect(views[0].id).toBe(windmillId);
    expect(views[0].stocks.wheat).toBe(5);
    expect(views[0].isActive).toBe(false);
    expect(views[0].commercializeEnabled).toBe(true);
  });

  test('listCommercializableWindmills filters inactive or disabled windmills', async () => {
    await db.houses.bulkAdd([
      makeHouseRecord({
        type: 'Windmill-001',
        x: 1,
        y: 1,
        extra: { isActive: true, commercializeEnabled: true },
      }),
      makeHouseRecord({
        type: 'Windmill-001',
        x: 2,
        y: 2,
        extra: { isActive: false, commercializeEnabled: true },
      }),
      makeHouseRecord({
        type: 'Windmill-001',
        x: 3,
        y: 3,
        extra: { isActive: true, commercializeEnabled: false },
      }),
    ]);

    const active = await listCommercializableWindmills();
    expect(active).toHaveLength(1);
    expect(active[0].x).toBe(1);
  });

  test('listSupplyMapBuildings classifies farms for commerce production estimate', async () => {
    await db.houses.bulkAdd([
      makeHouseRecord({ type: 'Farm-Wheat', x: 1, y: 1 }),
      makeHouseRecord({ type: 'Farm-Carrot', x: 2, y: 2 }),
      makeHouseRecord({ type: 'House-Blue', x: 3, y: 3, extra: { pop: 4 } }),
    ]);

    const map = await listSupplyMapBuildings();
    const farms = map.filter((b) => b.kind === 'farm');
    expect(farms).toHaveLength(2);
  });

  test('listNatureResources returns nature category rows only', async () => {
    await db.houses.bulkAdd([
      makeHouseRecord({
        type: 'Tree-Oak',
        x: 0,
        y: 0,
        extra: { category: 'nature', stocks: { wood: 10 } },
      }),
      makeHouseRecord({ type: 'House-Blue', x: 1, y: 1 }),
    ]);

    const nature = await listNatureResources();
    expect(nature).toHaveLength(1);
    expect(nature[0].type).toContain('Tree');
  });
});
