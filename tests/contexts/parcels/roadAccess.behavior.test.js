/**
 * Tests de comportement — accès routier (BC Parcels)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { RecalculateRoadAccessForBuilding } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../../../src/contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { GetBuildingRoadAccess } from '../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import {
  createBuildingInstanceId,
  makeParcelHouseSnapshot,
  makeRoadNeighborRef,
  makeNeighborRef,
} from '../../fixtures/parcelsFixtures.js';

class InMemoryBuildingRepository {
  constructor(buildings = []) {
    this.buildings = new Map(buildings.map((b) => [b.id, { ...b }]));
    this.savedRoadAccess = [];
  }

  async findById(buildingId) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    return this.buildings.get(id) ?? null;
  }

  async findAll() {
    return [...this.buildings.values()];
  }

  async saveRoadAccess(buildingId, roadCount) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    const building = this.buildings.get(id);
    if (building) {
      building.roadCount = roadCount;
      this.savedRoadAccess.push({ buildingId: id, roadCount });
    }
  }
}

function createRoadAccessHarness(buildings = []) {
  const repository = new InMemoryBuildingRepository(buildings);
  const events = new InMemoryDomainEventPublisher();

  const recalculateForBuilding = new RecalculateRoadAccessForBuilding(repository, events);
  const recalculateAll = new RecalculateAllRoadAccess(repository, events);
  const getBuildingRoadAccess = new GetBuildingRoadAccess(repository);

  return {
    repository,
    events,
    async whenRoadAccessIsRecalculatedFor(buildingId) {
      return recalculateForBuilding.execute(buildingId);
    },
    async whenAllRoadAccessIsRecalculated() {
      return recalculateAll.execute();
    },
    async roadAccessOf(buildingId) {
      const result = await getBuildingRoadAccess.execute(buildingId);
      return result?.roadAccess ?? null;
    },
    persistedRoadCounts() {
      return [...repository.savedRoadAccess];
    },
    roadAccessChangedEvents() {
      return events.getHistory('parcels.RoadAccessChanged');
    },
  };
}

describe('Accès routier des bâtiments', () => {
  let harness;

  beforeEach(() => {
    harness = createRoadAccessHarness();
  });

  describe('quand on recalcule la desserte d\'un bâtiment', () => {
    test('une maison bordée d\'une route est desservie et enregistrée', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [makeRoadNeighborRef(3, 6)],
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(true);
      expect(outcome.roadAccess.roadCount).toBe(1);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: houseId, roadCount: 1 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });

    test('une maison isolée n\'est pas desservie', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [
            makeNeighborRef({ type: 'Farm-Wheat', x: 4, y: 7, isRoad: false }),
          ],
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(outcome.roadAccess.roadCount).toBe(0);
      expect(outcome.updated).toBe(false);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });

    test('quand une route disparaît, la desserte est corrigée en base', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [
            makeNeighborRef({ type: 'Farm-Wheat', x: 4, y: 7, isRoad: false }),
          ],
          roadCount: 1,
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: houseId, roadCount: 0 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });

    test('si la desserte n\'a pas changé, rien n\'est publié', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [makeRoadNeighborRef(3, 6)],
          roadCount: 1,
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.updated).toBe(false);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
      expect(harness.roadAccessChangedEvents()).toHaveLength(0);
    });

    test('un bâtiment inconnu ne déclenche aucune action', async () => {
      expect(await harness.whenRoadAccessIsRecalculatedFor(createBuildingInstanceId())).toBeNull();
    });

    test('une tuile route n\'est pas concernée par la desserte', async () => {
      const roadId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        createBuildingSnapshot({
          id: roadId,
          type: 'roads',
          x: 1,
          y: 1,
          neighbors: [makeRoadNeighborRef(1, 2)],
          roadCount: 0,
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(roadId);

      expect(outcome.skipped).toBe(true);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });
  });

  describe('quand les voisins sont persistés avec UUID', () => {
    test.each([
      ['type roads', [makeRoadNeighborRef(2, 2)]],
      ['type Road', [makeNeighborRef({ type: 'Road', x: 2, y: 2, isRoad: true })]],
      ['StonePath', [makeNeighborRef({ type: 'StonePath-001', x: 2, y: 2, isRoad: true })]],
      ['userData.isRoad', [
        makeNeighborRef({
          type: 'StonePath',
          x: 2,
          y: 2,
          userData: { isRoad: true },
        }),
      ]],
    ])('reconnaît une route via %s', async (_label, neighbors) => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({ instanceId: houseId, neighbors }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(true);
      expect(outcome.roadAccess.roadCount).toBe(1);
    });

    test('compte plusieurs routes adjacentes', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [
            makeRoadNeighborRef(4, 5),
            makeRoadNeighborRef(4, 3),
            makeNeighborRef({ type: 'Farm-Wheat', x: 5, y: 4, isRoad: false }),
          ],
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.roadCount).toBe(2);
      expect(outcome.roadAccess.hasAccess).toBe(true);
    });

    test('voisins absents ou vides → aucune desserte', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({ instanceId: houseId, neighbors: [] }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(outcome.roadAccess.roadCount).toBe(0);
    });

    test('ignore les voisins sans UUID', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [{ name: 'roads', isRoad: true, x: 1, y: 2 }],
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor(houseId);

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(outcome.roadAccess.roadCount).toBe(0);
    });
  });

  describe('quand on recalcule la desserte de toute la ville', () => {
    test('seules les maisons sont traitées ; seules les dessertes modifiées sont persistées', async () => {
      const servedId = createBuildingInstanceId();
      const isolatedId = createBuildingInstanceId();
      const roadId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: servedId,
          neighbors: [makeRoadNeighborRef(1, 2)],
        }),
        makeParcelHouseSnapshot({ instanceId: isolatedId, x: 2, y: 2, neighbors: [] }),
        createBuildingSnapshot({
          id: roadId,
          type: 'roads',
          x: 0,
          y: 0,
          neighbors: [],
          roadCount: 0,
        }),
      ]);

      const outcome = await harness.whenAllRoadAccessIsRecalculated();

      expect(outcome.processed).toBe(2);
      expect(outcome.updated).toBe(1);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: servedId, roadCount: 1 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });
  });

  describe('quand on consulte la desserte d\'un bâtiment', () => {
    test('la consultation reflète les voisins en base sans persister', async () => {
      const houseId = createBuildingInstanceId();
      harness = createRoadAccessHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          neighbors: [makeRoadNeighborRef(5, 4)],
        }),
      ]);

      const access = await harness.roadAccessOf(houseId);

      expect(access.hasAccess).toBe(true);
      expect(access.roadCount).toBe(1);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });
  });
});
