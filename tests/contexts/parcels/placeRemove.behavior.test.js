/**
 * Tests de comportement — place / remove + recalc ciblé (BC Parcels, UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { UpdateNeighborsForBuilding } from '../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { RecalculateRoadAccessForBuilding } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateRoadAccessForNeighbors } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForNeighbors.js';
import { PlaceBuilding } from '../../../src/contexts/parcels/application/commands/PlaceBuilding.js';
import { RemoveBuilding } from '../../../src/contexts/parcels/application/commands/RemoveBuilding.js';
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
  }

  async findById(buildingId) {
    const id = typeof buildingId === 'string' ? buildingId : buildingId?.value;
    const entry = this.raw.get(id);
    if (!entry) return null;
    return {
      ...entry.snapshot,
      neighbors: entry.neighbors,
      roadCount: entry.snapshot.roadCount,
    };
  }

  async findAll() {
    return Promise.all([...this.raw.keys()].map((id) => this.findById(id)));
  }

  async saveRoadAccess(buildingId, roadCount) {
    const entry = this.raw.get(buildingId);
    if (entry) entry.snapshot = { ...entry.snapshot, roadCount };
  }

  async saveNeighbors(buildingId, neighbors) {
    const entry = this.raw.get(buildingId);
    if (entry) {
      entry.neighbors = neighbors;
      entry.snapshot = { ...entry.snapshot, neighbors };
    }
  }

  async findNeighbors(buildingId) {
    return this.raw.get(buildingId)?.neighbors ?? [];
  }

  async deleteById(buildingId) {
    this.raw.delete(buildingId);
  }
}

class FakeSpatialNeighborhood {
  constructor(byTile = new Map()) {
    this.byTile = byTile;
  }

  async discoverInZones({ x, y }) {
    return this.byTile.get(`${x},${y}`) ?? [];
  }
}

function createHarness({ buildings = [], spatialByTile = new Map() } = {}) {
  const repository = new InMemoryBuildingRepository(buildings);
  const events = new InMemoryDomainEventPublisher();
  const spatial = new FakeSpatialNeighborhood(spatialByTile);
  const updateNeighbors = new UpdateNeighborsForBuilding(repository, events);
  const recalcOne = new RecalculateRoadAccessForBuilding(repository, events);
  const recalcNeighbors = new RecalculateRoadAccessForNeighbors(recalcOne);
  const placeBuilding = new PlaceBuilding({
    buildingRepository: repository,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding: updateNeighbors,
    recalculateRoadAccessForNeighbors: recalcNeighbors,
  });
  const removeBuilding = new RemoveBuilding({
    buildingRepository: repository,
    spatialNeighborhood: spatial,
    updateNeighborsForBuilding: updateNeighbors,
    recalculateRoadAccessForNeighbors: recalcNeighbors,
  });
  const getRoadAccess = new GetBuildingRoadAccess(repository);

  return {
    repository,
    spatial,
    async whenBuildingIsPlaced(params) {
      return placeBuilding.execute(params);
    },
    async whenBuildingIsRemoved(params) {
      return removeBuilding.execute(params);
    },
    async whenRoadAccessIsRecalculatedForNeighbors(ids) {
      return recalcNeighbors.execute(ids);
    },
    async roadAccessOf(buildingId) {
      const result = await getRoadAccess.execute(buildingId);
      return result?.roadAccess ?? null;
    },
    async neighborsOf(buildingId) {
      return repository.findNeighbors(buildingId);
    },
  };
}

describe('Place / remove et accès routier ciblé', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  describe('RecalculateRoadAccessForNeighbors', () => {
    test('ne traite que les ids fournis', async () => {
      const servedId = createBuildingInstanceId();
      const isolatedId = createBuildingInstanceId();
      harness = createHarness({
        buildings: [
          makeParcelHouseSnapshot({
            instanceId: servedId,
            neighbors: [makeRoadNeighborRef(3, 6)],
          }),
          makeParcelHouseSnapshot({ instanceId: isolatedId, x: 1, y: 1, neighbors: [] }),
        ],
      });

      const outcome = await harness.whenRoadAccessIsRecalculatedForNeighbors([servedId]);

      expect(outcome.processed).toBe(1);
      expect(outcome.updated).toBe(1);
      expect((await harness.roadAccessOf(servedId)).hasAccess).toBe(true);
      expect((await harness.roadAccessOf(isolatedId)).roadCount).toBe(0);
    });
  });

  describe('quand on place un bâtiment', () => {
    test('persiste ses voisins et dessert une maison adjacente à une route', async () => {
      const roadId = createBuildingInstanceId();
      const houseId = createBuildingInstanceId();

      const spatialByTile = new Map([
        [
          '3,6',
          [
            makeNeighborRef({
              instanceId: houseId,
              type: 'House-Blue',
              x: 3,
              y: 7,
              isRoad: false,
            }),
          ],
        ],
        [
          '3,7',
          [makeRoadNeighborRef(3, 6, roadId)],
        ],
      ]);

      harness = createHarness({
        buildings: [
          createBuildingSnapshot({
            id: roadId,
            type: 'roads',
            x: 3,
            y: 6,
            neighbors: [],
            roadCount: 0,
          }),
          makeParcelHouseSnapshot({ instanceId: houseId, x: 3, y: 7, neighbors: [] }),
        ],
        spatialByTile,
      });

      const outcome = await harness.whenBuildingIsPlaced({
        buildingId: roadId,
        x: 3,
        y: 6,
        type: 'roads',
      });

      expect(outcome).not.toBeNull();
      expect(outcome.affectedIds).toEqual(expect.arrayContaining([roadId, houseId]));
      expect((await harness.roadAccessOf(houseId)).hasAccess).toBe(true);
      expect(await harness.neighborsOf(houseId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: roadId,
            isRoad: true,
          }),
        ])
      );
    });

    test('ignore un bâtiment absent de la base', async () => {
      expect(
        await harness.whenBuildingIsPlaced({
          buildingId: createBuildingInstanceId(),
          x: 0,
          y: 0,
          type: 'House-Blue',
        })
      ).toBeNull();
    });
  });

  describe('quand on retire un bâtiment', () => {
    test('supprime la fiche et retire la desserte des voisins', async () => {
      const roadId = createBuildingInstanceId();
      const houseId = createBuildingInstanceId();

      const spatialByTile = new Map([['3,7', []]]);

      harness = createHarness({
        buildings: [
          makeParcelHouseSnapshot({
            instanceId: houseId,
            x: 3,
            y: 7,
            neighbors: [makeRoadNeighborRef(3, 6, roadId)],
            roadCount: 1,
          }),
          createBuildingSnapshot({
            id: roadId,
            type: 'roads',
            x: 3,
            y: 6,
            neighbors: [
              makeNeighborRef({
                instanceId: houseId,
                type: 'House-Blue',
                x: 3,
                y: 7,
                isRoad: false,
              }),
            ],
            roadCount: 0,
          }),
        ],
        spatialByTile,
      });

      const outcome = await harness.whenBuildingIsRemoved({ buildingId: roadId });

      expect(outcome.deleted).toBe(true);
      expect(await harness.repository.findById(roadId)).toBeNull();
      expect((await harness.roadAccessOf(houseId)).hasAccess).toBe(false);
      expect(await harness.neighborsOf(houseId)).toEqual([]);
    });
  });
});
