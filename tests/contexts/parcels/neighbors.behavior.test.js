/**
 * Tests de comportement — voisinage (BC Parcels, UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createNeighbor, normalizeNeighborFromRef } from '../../../src/contexts/parcels/domain/value-objects/Neighbor.js';
import { UpdateNeighborsForBuilding } from '../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { GetBuildingNeighbors } from '../../../src/contexts/parcels/application/queries/GetBuildingNeighbors.js';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import {
  createBuildingInstanceId,
  makeParcelHouseSnapshot,
  makeRoadNeighborRef,
  makeNeighborRef,
} from '../../fixtures/parcelsFixtures.js';

class InMemoryBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          snapshot: { ...b },
          neighbors: Array.isArray(b.neighbors)
            ? b.neighbors.map((n) =>
                n.instanceId
                  ? n
                  : {
                      instanceId: n.id,
                      type: n.type,
                      x: n.x ?? n.tile?.x ?? null,
                      y: n.y ?? n.tile?.y ?? null,
                      zone: n.zone,
                      isRoad: n.isRoad,
                    }
              )
            : [],
        },
      ])
    );
    this.savedNeighbors = [];
  }

  async findById(buildingId) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    return this.raw.get(id)?.snapshot ?? null;
  }

  async findNeighbors(buildingId) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    return this.raw.get(id)?.neighbors ?? [];
  }

  async saveNeighbors(buildingId, neighbors) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    const entry = this.raw.get(id);
    if (entry) {
      entry.neighbors = neighbors;
      entry.snapshot = { ...entry.snapshot, neighbors };
      this.savedNeighbors.push({ buildingId: id, neighbors });
    }
  }
}

function createNeighborsHarness(buildings = []) {
  const repository = new InMemoryBuildingRepository(buildings);
  const events = new InMemoryDomainEventPublisher();
  const updateUseCase = new UpdateNeighborsForBuilding(repository, events);
  const getNeighbors = new GetBuildingNeighbors(repository);

  return {
    repository,
    events,
    async whenNeighborsAreUpdated(buildingId, neighbors) {
      return updateUseCase.execute(buildingId, neighbors);
    },
    async whenNeighborsAreQueried(buildingId) {
      return getNeighbors.execute(buildingId);
    },
    persistedNeighbors() {
      return [...repository.savedNeighbors];
    },
    neighborsChangedEvents() {
      return events.getHistory('parcels.NeighborsChanged');
    },
    async rawNeighborsOf(buildingId) {
      return repository.findNeighbors(buildingId);
    },
  };
}

describe('Voisinage des bâtiments', () => {
  let harness;

  beforeEach(() => {
    harness = createNeighborsHarness();
  });

  describe('modèle Neighbor (domaine Parcels)', () => {
    test('extrait instanceId UUID et champs spatiaux depuis un scan', () => {
      const roadId = createBuildingInstanceId();
      const neighbor = normalizeNeighborFromRef({
        type: 'Farm-Wheat',
        instanceId: roadId,
        id: roadId,
        x: 4,
        y: 7,
        zone: 1,
        isRoad: false,
        stocks: { wheat: 10 },
        time: 99,
        deltaX: 1,
      });

      expect(neighbor).toEqual(
        createNeighbor({
          instanceId: roadId,
          type: 'Farm-Wheat',
          tile: { x: 4, y: 7 },
          isRoad: false,
          zone: 1,
        })
      );
      expect(neighbor.stocks).toBeUndefined();
    });

    test('ignore les blobs sans UUID', () => {
      expect(
        normalizeNeighborFromRef({ name: 'roads', x: 1, y: 2, zone: 1 }).instanceId
      ).toBe('');
    });

    test('détecte une route via type roads', () => {
      const roadId = createBuildingInstanceId();
      expect(
        normalizeNeighborFromRef(makeRoadNeighborRef(1, 2, roadId)).isRoad
      ).toBe(true);
    });
  });

  describe('quand on met à jour les voisins d\'un bâtiment', () => {
    test('persiste sous instanceId UUID', async () => {
      const instanceId = createBuildingInstanceId();
      harness = createNeighborsHarness([makeParcelHouseSnapshot({ instanceId, x: 8, y: 10 })]);

      const roadId = createBuildingInstanceId();
      const outcome = await harness.whenNeighborsAreUpdated(instanceId, [
        makeRoadNeighborRef(8, 11, roadId),
      ]);

      expect(outcome.updated).toBe(true);
      expect(harness.persistedNeighbors()[0].buildingId).toBe(instanceId);

      const saved = harness.persistedNeighbors()[0].neighbors;
      expect(saved[0].instanceId).toBe(roadId);
      expect(saved[0].type).toBe('roads');
      expect(saved[0].isRoad).toBe(true);
      expect(saved[0].stocks).toBeUndefined();
    });

    test('ne réécrit pas si la liste est inchangée', async () => {
      const houseId = createBuildingInstanceId();
      const roadId = createBuildingInstanceId();
      const persisted = [
        {
          instanceId: roadId,
          type: 'roads',
          x: 0,
          y: 1,
          zone: 1,
          isRoad: true,
        },
      ];
      harness = createNeighborsHarness([
        makeParcelHouseSnapshot({ instanceId: houseId, neighbors: persisted, x: 2, y: 2 }),
      ]);
      harness.repository.raw.get(houseId).neighbors = persisted;

      const outcome = await harness.whenNeighborsAreUpdated(houseId, [
        makeRoadNeighborRef(0, 1, roadId),
      ]);

      expect(outcome.updated).toBe(false);
      expect(harness.persistedNeighbors()).toHaveLength(0);
    });

    test('ignore un bâtiment inconnu', async () => {
      expect(await harness.whenNeighborsAreUpdated(createBuildingInstanceId(), [])).toBeNull();
    });

    test('traite une liste absente comme vide', async () => {
      const houseId = createBuildingInstanceId();
      const roadId = createBuildingInstanceId();
      harness = createNeighborsHarness([makeParcelHouseSnapshot({ instanceId: houseId, x: 0, y: 0 })]);
      harness.repository.raw.get(houseId).neighbors = [
        { instanceId: roadId, type: 'roads', x: 0, y: 1, zone: 1, isRoad: true },
      ];

      const outcome = await harness.whenNeighborsAreUpdated(houseId, null);

      expect(outcome.updated).toBe(true);
      expect(outcome.neighborCount).toBe(0);
      expect(await harness.rawNeighborsOf(houseId)).toEqual([]);
    });
  });

  describe('quand on interroge les voisins (query CQRS)', () => {
    test('retourne un read model plat avec instanceId', async () => {
      const houseId = createBuildingInstanceId();
      const roadId = createBuildingInstanceId();
      const farmId = createBuildingInstanceId();
      harness = createNeighborsHarness([
        makeParcelHouseSnapshot({
          instanceId: houseId,
          x: 3,
          y: 7,
          neighbors: [
            { instanceId: roadId, type: 'roads', x: 3, y: 6, zone: 1, isRoad: true },
            { instanceId: farmId, type: 'Farm-Wheat', x: 4, y: 7, zone: 1, isRoad: false },
          ],
        }),
      ]);
      harness.repository.raw.get(houseId).neighbors = [
        { instanceId: roadId, type: 'roads', x: 3, y: 6, zone: 1, isRoad: true },
        { instanceId: farmId, type: 'Farm-Wheat', x: 4, y: 7, zone: 1, isRoad: false },
      ];

      const result = await harness.whenNeighborsAreQueried(houseId);

      expect(result.buildingId).toBe(houseId);
      expect(result.neighbors).toEqual([
        {
          instanceId: roadId,
          type: 'roads',
          x: 3,
          y: 6,
          isRoad: true,
          zone: 1,
        },
        {
          instanceId: farmId,
          type: 'Farm-Wheat',
          x: 4,
          y: 7,
          isRoad: false,
          zone: 1,
        },
      ]);
    });

    test('retourne null pour un bâtiment inconnu', async () => {
      expect(await harness.whenNeighborsAreQueried(createBuildingInstanceId())).toBeNull();
    });
  });
});
