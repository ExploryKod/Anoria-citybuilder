/**
 * Integration tests — DexieBuildingRepository (BC Parcels ↔ HousesStore)
 *
 * Boundary tests: UUID PK in Dexie must survive #toSnapshot and round-trip
 * through saveNeighbors / saveRoadAccess. In-memory fakes do not exercise this path.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HouseStore } from '../../../../src/js/stores/HousesStore.js';
import { DexieBuildingRepository } from '../../../../src/contexts/parcels/infrastructure/dexie/DexieBuildingRepository.js';
import { UpdateNeighborsForBuilding } from '../../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { GetBuildingNeighbors } from '../../../../src/contexts/parcels/application/queries/GetBuildingNeighbors.js';
import { GetBuildingRoadAccess } from '../../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { RecalculateRoadAccessForBuilding } from '../../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { InMemoryDomainEventPublisher } from '../../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { createBuildingInstanceId } from '../../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../../fixtures/buildingRecord.js';

function createTestDb() {
  const db = new Dexie('testParcelsDexieRepoDb');
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

describe('DexieBuildingRepository — boundary UUID ↔ Dexie', () => {
  let housesStore;
  let repository;
  let testDb;

  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.open();
    housesStore = new HouseStore();
    housesStore.db = testDb;
    repository = new DexieBuildingRepository(housesStore);
  });

  afterEach(async () => {
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
  });

  test('findById conserve instanceId UUID dans snapshot.id (avec x/y)', async () => {
    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
    await housesStore.addHouse(record);

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
    await housesStore.addHouse(record);

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

    const row = await housesStore.getHouse(record.instanceId);
    expect(row.neighbors).toHaveLength(1);
    expect(row.neighbors[0].isRoad).toBe(true);

    const legacyRow = await housesStore.getHouse('House-Blue-8-10');
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
    await housesStore.addHouse(record);

    const snapshot = await repository.findById(record.instanceId);
    await repository.saveRoadAccess(snapshot.id, 1);

    const row = await housesStore.getHouse(record.instanceId);
    expect(row.roads).toBe(1);
  });
});

describe('DexieBuildingRepository — use cases bout-en-bout (UUID)', () => {
  let housesStore;
  let repository;
  let events;
  let testDb;
  let houseInstanceId;

  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.open();
    housesStore = new HouseStore();
    housesStore.db = testDb;
    repository = new DexieBuildingRepository(housesStore);
    events = new InMemoryDomainEventPublisher();

    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10 });
    houseInstanceId = record.instanceId;
    await housesStore.addHouse(record);
  });

  afterEach(async () => {
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
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
    expect(result.buildingId).toBe(houseInstanceId);
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

    const row = await housesStore.getHouse(houseInstanceId);
    expect(row.roads).toBe(1);
  });
});
