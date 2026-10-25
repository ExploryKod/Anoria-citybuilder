/**
 * Integration tests — DexieBuildingRepository (BC Parcels ↔ Dexie)
 *
 * Boundary tests: UUID PK in Dexie must survive #toSnapshot and round-trip
 * through saveRoadAccess. In-memory fakes do not exercise this path.
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { clearBuildingsTable, seedBuilding, getBuildingRow } from '../../../helpers/buildingDb.js';
import { DexieBuildingRepository } from '../../../../src/contexts/parcels/infrastructure/dexie/DexieBuildingRepository.js';
import { GetBuildingRoadAccess } from '../../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { RecalculateRoadAccessForBuilding } from '../../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { InMemoryDomainEventPublisher } from '../../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { makeHouseRecord } from '../../../fixtures/buildingRecord.js';

async function clearHousesTable() {
  await clearBuildingsTable();
}

describe('DexieBuildingRepository — boundary UUID ↔ Dexie', () => {
  /** @type {DexieBuildingRepository} */
  let repository;

  beforeEach(async () => {
    await clearBuildingsTable();
    repository = new DexieBuildingRepository();
  });

  afterEach(async () => {
    await clearHousesTable();
  });

  test('findById conserve instanceId UUID dans snapshot.id (avec x/y)', async () => {
    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
    await seedBuilding(record);

    const snapshot = await repository.findById(record.instanceId);

    expect(snapshot).not.toBeNull();
    expect(snapshot.id).toBe(record.instanceId);
    expect(snapshot.id).not.toBe('House-Blue-8-10');
    expect(snapshot.buildingId?.value).toBe('House-Blue-8-10');
    expect(snapshot.x).toBe(8);
    expect(snapshot.y).toBe(10);
  });

  test('saveRoadAccess persiste roads sous la clé UUID', async () => {
    const record = makeHouseRecord({
      type: 'House-Blue',
      x: 8,
      y: 10,
    });
    await seedBuilding(record);

    const snapshot = await repository.findById(record.instanceId);
    await repository.saveRoadAccess(snapshot.id, 1);

    const row = await getBuildingRow(record.instanceId);
    expect(row.roads).toBe(1);
  });
});

describe('DexieBuildingRepository — use cases bout-en-bout (UUID)', () => {
  let repository;
  let events;
  let houseInstanceId;

  beforeEach(async () => {
    await clearBuildingsTable();
    repository = new DexieBuildingRepository();
    events = new InMemoryDomainEventPublisher();

    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
    houseInstanceId = record.instanceId;
    await seedBuilding(record);
  });

  afterEach(async () => {
    await clearHousesTable();
  });

  test('une route posée contre la maison → RecalculateRoadAccess → GetBuildingRoadAccess.hasAccess', async () => {
    const recalcRoadAccess = new RecalculateRoadAccessForBuilding(repository, events);
    const getRoadAccess = new GetBuildingRoadAccess(repository);

    // The road is a building row like any other: the tile just below the house (a house is 2x2).
    await seedBuilding(makeHouseRecord({ type: 'StonePath-001', x: 8, y: 12 }));

    const recalc = await recalcRoadAccess.execute(houseInstanceId);
    expect(recalc?.roadAccess.hasAccess).toBe(true);
    expect(recalc?.updated).toBe(true);

    const access = await getRoadAccess.execute(houseInstanceId);
    expect(access.roadAccess.hasAccess).toBe(true);
    expect(access.roadAccess.roadCount).toBe(1);

    const row = await getBuildingRow(houseInstanceId);
    expect(row.roads).toBe(1);
  });
});
