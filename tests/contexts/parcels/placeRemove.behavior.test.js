/**
 * Tests de comportement — place / remove + recalc ciblé (BC Parcels)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { UpdateNeighborsForBuilding } from '../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { RecalculateRoadAccessForBuilding } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateRoadAccessForNeighbors } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForNeighbors.js';
import { PlaceBuilding } from '../../../src/contexts/parcels/application/commands/PlaceBuilding.js';
import { RemoveBuilding } from '../../../src/contexts/parcels/application/commands/RemoveBuilding.js';
import { GetBuildingRoadAccess } from '../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { InMemoryDomainEventPublisher } from '../../../src/infrastructure/events/InMemoryDomainEventPublisher.js';

class InMemoryBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          snapshot: { ...b },
          neighbors: Array.isArray(b.neighbors)
            ? b.neighbors.map((n) =>
                n.x !== undefined || n.name !== undefined
                  ? n
                  : {
                      id: n.buildingId,
                      name: n.type,
                      type: n.type,
                      x: n.tile?.x ?? null,
                      y: n.tile?.y ?? null,
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

/** Spatial fake : clé "x,y" → liste voisins bruts */
class FakeSpatialNeighborhood {
  constructor(byTile = new Map()) {
    this.byTile = byTile;
  }

  async discoverInZones({ x, y }) {
    return this.byTile.get(`${x},${y}`) ?? [];
  }
}

function house(id, neighbors = [], roadCount = 0) {
  return createBuildingSnapshot({
    id,
    type: id.replace(/-\d+-\d+$/, ''),
    neighbors,
    roadCount,
  });
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
      harness = createHarness({
        buildings: [
          house('House-Blue-3-7', [{ name: 'roads', isRoad: true, x: 3, y: 6 }], 0),
          house('House-Blue-1-1', [], 0),
        ],
      });

      const outcome = await harness.whenRoadAccessIsRecalculatedForNeighbors([
        'House-Blue-3-7',
      ]);

      expect(outcome.processed).toBe(1);
      expect(outcome.updated).toBe(1);
      expect((await harness.roadAccessOf('House-Blue-3-7')).hasAccess).toBe(true);
      expect((await harness.roadAccessOf('House-Blue-1-1')).roadCount).toBe(0);
    });
  });

  describe('quand on place un bâtiment', () => {
    test('persiste ses voisins et dessert une maison adjacente à une route', async () => {
      const spatialByTile = new Map([
        [
          '3,6',
          [
            {
              name: 'House-Blue',
              id: 'House-Blue-3-7',
              x: 3,
              y: 7,
              zone: 1,
              isRoad: false,
            },
          ],
        ],
        [
          '3,7',
          [
            {
              name: 'roads',
              id: 'roads-3-6',
              x: 3,
              y: 6,
              zone: 1,
              isRoad: true,
            },
          ],
        ],
      ]);

      harness = createHarness({
        buildings: [
          house('roads-3-6', [], 0),
          house('House-Blue-3-7', [], 0),
        ],
        spatialByTile,
      });

      const outcome = await harness.whenBuildingIsPlaced({
        buildingId: 'roads-3-6',
        x: 3,
        y: 6,
        type: 'roads',
      });

      expect(outcome).not.toBeNull();
      expect(outcome.affectedIds).toEqual(
        expect.arrayContaining(['roads-3-6', 'House-Blue-3-7'])
      );
      expect((await harness.roadAccessOf('House-Blue-3-7')).hasAccess).toBe(true);
      expect(await harness.neighborsOf('House-Blue-3-7')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'roads-3-6',
            isRoad: true,
          }),
        ])
      );
    });

    test('ignore un bâtiment absent de la base', async () => {
      expect(
        await harness.whenBuildingIsPlaced({
          buildingId: 'missing-0-0',
          x: 0,
          y: 0,
          type: 'House-Blue',
        })
      ).toBeNull();
    });
  });

  describe('quand on retire un bâtiment', () => {
    test('supprime la fiche et retire la desserte des voisins', async () => {
      const spatialByTile = new Map([
        ['3,7', []],
      ]);

      harness = createHarness({
        buildings: [
          house(
            'House-Blue-3-7',
            [
              {
                name: 'roads',
                id: 'roads-3-6',
                type: 'roads',
                x: 3,
                y: 6,
                zone: 1,
                isRoad: true,
              },
            ],
            1
          ),
          house(
            'roads-3-6',
            [
              {
                name: 'House-Blue',
                id: 'House-Blue-3-7',
                type: 'House-Blue',
                x: 3,
                y: 7,
                zone: 1,
              },
            ],
            0
          ),
        ],
        spatialByTile,
      });

      const outcome = await harness.whenBuildingIsRemoved({
        buildingId: 'roads-3-6',
      });

      expect(outcome.deleted).toBe(true);
      expect(await harness.repository.findById('roads-3-6')).toBeNull();
      expect((await harness.roadAccessOf('House-Blue-3-7')).hasAccess).toBe(false);
      expect(await harness.neighborsOf('House-Blue-3-7')).toEqual([]);
    });
  });
});
