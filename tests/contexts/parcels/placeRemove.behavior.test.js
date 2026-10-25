/**
 * Tests de comportement — place / remove (BC Parcels, UUID) : l'accès routier de la ville est recalculé, et les comptes sont clos avant un retrait.
 */

import { describe, test, expect } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { RecalculateAllRoadAccess } from '../../../src/contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { PlaceBuilding } from '../../../src/contexts/parcels/application/commands/PlaceBuilding.js';
import { RemoveBuilding } from '../../../src/contexts/parcels/application/commands/RemoveBuilding.js';
import { GetBuildingRoadAccess } from '../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { createBuildingInstanceId, makeParcelHouseSnapshot } from '../../fixtures/parcelsFixtures.js';

class InMemoryBuildingRepository {
  constructor(buildings = []) {
    this.snapshots = new Map(buildings.map((b) => [b.id, { ...b }]));
  }

  async findById(buildingId) {
    return this.snapshots.get(buildingId) ?? null;
  }

  async findAll() {
    return [...this.snapshots.values()];
  }

  // The road tiles are the buildings of type 'roads'.
  async findRoadTiles() {
    return [...this.snapshots.values()].filter((b) => b.type === 'roads').map((b) => ({ x: b.x, y: b.y }));
  }

  async saveRoadAccess(buildingId, roadCount) {
    const snapshot = this.snapshots.get(buildingId);
    if (snapshot) this.snapshots.set(buildingId, { ...snapshot, roadCount });
  }

  async deleteById(buildingId) {
    this.snapshots.delete(buildingId);
  }
}

function createHarness({ buildings = [] } = {}) {
  const repository = new InMemoryBuildingRepository(buildings);
  const events = new InMemoryDomainEventPublisher();
  const recalculateAllRoadAccess = new RecalculateAllRoadAccess(repository, events);
  const placeBuilding = new PlaceBuilding({ buildingRepository: repository, recalculateAllRoadAccess });
  // What `liquidateBuilding` was asked, and whether the building still stood when it was (its books are closed before it goes).
  const liquidated = [];
  const removeBuilding = new RemoveBuilding({
    buildingRepository: repository,
    recalculateAllRoadAccess,
    liquidateBuilding: async ({ instanceId, buildingType }) => {
      liquidated.push({ instanceId, buildingType, stillStood: (await repository.findById(instanceId)) !== null });
    },
  });
  const getRoadAccess = new GetBuildingRoadAccess(repository);

  return {
    repository,
    liquidated,
    whenBuildingIsPlaced: (params) => placeBuilding.execute(params),
    whenBuildingIsRemoved: (params) => removeBuilding.execute(params),
    async roadAccessOf(buildingId) {
      const result = await getRoadAccess.execute(buildingId);
      return result?.roadAccess ?? null;
    },
  };
}

describe('Place / remove et accès routier', () => {
  describe('quand on place un bâtiment', () => {
    test("une route posée à côté d'une maison lui donne l'accès", async () => {
      const roadId = createBuildingInstanceId();
      const houseId = createBuildingInstanceId();
      const harness = createHarness({
        buildings: [
          createBuildingSnapshot({ id: roadId, type: 'roads', x: 3, y: 6, roadCount: 0 }),
          makeParcelHouseSnapshot({ instanceId: houseId, x: 3, y: 7 }),
        ],
      });

      const outcome = await harness.whenBuildingIsPlaced({ instanceId: roadId, x: 3, y: 6, type: 'roads' });

      expect(outcome).toEqual({ instanceId: roadId });
      expect((await harness.roadAccessOf(houseId)).hasAccess).toBe(true);
    });

    test('ignore un bâtiment absent de la base', async () => {
      const harness = createHarness();

      expect(await harness.whenBuildingIsPlaced({ instanceId: createBuildingInstanceId(), x: 0, y: 0, type: 'House-Blue' })).toBeNull();
    });
  });

  describe('quand on retire un bâtiment', () => {
    test("retirer la route d'une maison lui retire l'accès", async () => {
      const roadId = createBuildingInstanceId();
      const houseId = createBuildingInstanceId();
      const harness = createHarness({
        buildings: [
          makeParcelHouseSnapshot({ instanceId: houseId, x: 3, y: 7, roadCount: 1 }),
          createBuildingSnapshot({ id: roadId, type: 'roads', x: 3, y: 6, roadCount: 0 }),
        ],
      });

      const outcome = await harness.whenBuildingIsRemoved({ instanceId: roadId });

      expect(outcome).toEqual({ instanceId: roadId, deleted: true });
      expect(await harness.repository.findById(roadId)).toBeNull();
      expect((await harness.roadAccessOf(houseId)).hasAccess).toBe(false);
    });

    // A disaster, the eraser, a hub taking its dependents down: every way a building leaves ends here, and its accounts are closed before it goes.
    test('ferme les comptes du bâtiment avant de le retirer, quel que soit le chemin qui le retire', async () => {
      const houseId = createBuildingInstanceId();
      const harness = createHarness({
        buildings: [createBuildingSnapshot({ id: houseId, type: 'House-Blue', x: 3, y: 7, roadCount: 0 })],
      });

      await harness.whenBuildingIsRemoved({ instanceId: houseId });

      expect(harness.liquidated).toEqual([{ instanceId: houseId, buildingType: 'House-Blue', stillStood: true }]);
      expect(await harness.repository.findById(houseId)).toBeNull();
    });
  });
});
