/**
 * Integration tests — DexieBuildingRepository (BC Parcels ↔ Dexie)
 *
 * Boundary tests: UUID PK in Dexie must survive #toSnapshot and round-trip
 * through saveNeighbors / saveRoadAccess. In-memory fakes do not exercise this path.
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { clearBuildingsTable, seedBuilding, getBuildingRow } from '../../../helpers/buildingDb.js';
import { DexieBuildingRepository } from '../../../../src/contexts/parcels/infrastructure/dexie/DexieBuildingRepository.js';
import { UpdateNeighborsForBuilding } from '../../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { GetBuildingNeighbors } from '../../../../src/contexts/parcels/application/queries/GetBuildingNeighbors.js';
import { GetBuildingRoadAccess } from '../../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { RecalculateRoadAccessForBuilding } from '../../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { InMemoryDomainEventPublisher } from '../../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { createBuildingInstanceId } from '../../../../src/shared/building-identity/index.js';
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

  test('saveNeighbors persiste sous la clé UUID Dexie, pas sous type-x-y', async () => {
    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
    await seedBuilding(record);

    const roadNeighborId = createBuildingInstanceId();
    const neighbors = [
      {
        name: 'StonePath-001',
        id: roadNeighborId,
        type: 'StonePath-001',
        x: 8,
        y: 11,
        zone: 1,
        isRoad: true,
      },
    ];

    const snapshot = await repository.findById(record.instanceId);
    await repository.saveNeighbors(snapshot.id, neighbors);

    const row = await getBuildingRow(record.instanceId);
    expect(row.neighbors).toHaveLength(1);
    expect(row.neighbors[0].isRoad).toBe(true);

    const legacyRow = await getBuildingRow('House-Blue-8-10');
    expect(legacyRow).toBeUndefined();
  });

  test('saveRoadAccess persiste roads sous la clé UUID', async () => {
    const record = makeHouseRecord({
      type: 'House-Blue',
      x: 8,
      y: 10,
      extra: {
        neighbors: [
          {
            id: createBuildingInstanceId(),
            name: 'roads',
            type: 'roads',
            x: 8,
            y: 11,
            zone: 1,
            isRoad: true,
          },
        ],
      },
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

  test('UpdateNeighborsForBuilding → voisins lisibles via GetBuildingNeighbors', async () => {
    const updateNeighbors = new UpdateNeighborsForBuilding(repository, events);
    const getNeighbors = new GetBuildingNeighbors(repository);

    const outcome = await updateNeighbors.execute(houseInstanceId, [
      {
        name: 'StonePath-001',
        id: createBuildingInstanceId(),
        x: 8,
        y: 11,
        zone: 1,
        isRoad: true,
      },
    ]);

    expect(outcome?.updated).toBe(true);

    const result = await getNeighbors.execute(houseInstanceId);
    expect(result.neighbors).toHaveLength(1);
    expect(result.neighbors[0].isRoad).toBe(true);
    expect(result.instanceId).toBe(houseInstanceId);
  });

  test('voisins route → RecalculateRoadAccess → GetBuildingRoadAccess.hasAccess', async () => {
    const updateNeighbors = new UpdateNeighborsForBuilding(repository, events);
    const recalcRoadAccess = new RecalculateRoadAccessForBuilding(repository, events);
    const getRoadAccess = new GetBuildingRoadAccess(repository);

    await updateNeighbors.execute(houseInstanceId, [
      {
        name: 'StonePath-001',
        id: createBuildingInstanceId(),
        x: 8,
        y: 11,
        zone: 1,
        isRoad: true,
      },
    ]);

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
