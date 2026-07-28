/**
 * Tests de comportement — voisinage (BC Parcels)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { createNeighbor, fromLegacyNeighbor } from '../../../src/contexts/parcels/domain/value-objects/Neighbor.js';
import { UpdateNeighborsForBuilding } from '../../../src/contexts/parcels/application/commands/UpdateNeighborsForBuilding.js';
import { GetBuildingNeighbors } from '../../../src/contexts/parcels/application/queries/GetBuildingNeighbors.js';
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

function house(id, neighbors = []) {
  return createBuildingSnapshot({
    id,
    type: 'House-Blue',
    neighbors,
    roadCount: 0,
  });
}

describe('Voisinage des bâtiments', () => {
  let harness;

  beforeEach(() => {
    harness = createNeighborsHarness();
  });

  describe('modèle Neighbor (domaine Parcels)', () => {
    test('extrait seulement les champs parcels depuis un blob legacy', () => {
      const neighbor = fromLegacyNeighbor({
        name: 'Farm-Wheat',
        id: 'Farm-Wheat-4-7',
        x: 4,
        y: 7,
        zone: 1,
        isRoad: false,
        stocks: { wheat: 10 },
        time: 99,
        deltaX: 1,
        deltaZ: 0,
      });

      expect(neighbor).toEqual(
        createNeighbor({
          buildingId: 'Farm-Wheat-4-7',
          type: 'Farm-Wheat',
          tile: { x: 4, y: 7 },
          isRoad: false,
          zone: 1,
        })
      );
      expect(neighbor.stocks).toBeUndefined();
      expect(neighbor.deltaX).toBeUndefined();
    });

    test('détecte une route via name legacy', () => {
      expect(fromLegacyNeighbor({ name: 'roads', x: 1, y: 2, zone: 1 }).isRoad).toBe(true);
    });
  });

  describe('quand on met à jour les voisins d\'un bâtiment', () => {
    test('persiste la forme parcels (sans stocks) et publie NeighborsChanged', async () => {
      harness = createNeighborsHarness([house('House-Blue-3-7', [])]);

      const outcome = await harness.whenNeighborsAreUpdated('House-Blue-3-7', [
        {
          name: 'roads',
          id: 'roads-3-6',
          x: 3,
          y: 6,
          zone: 1,
          isRoad: true,
          stocks: { food: 1 },
        },
        { name: 'Farm-Wheat', id: 'Farm-Wheat-4-7', x: 4, y: 7, zone: 1 },
      ]);

      expect(outcome.updated).toBe(true);
      expect(outcome.neighborCount).toBe(2);

      const saved = harness.persistedNeighbors()[0].neighbors;
      expect(saved).toEqual([
        {
          id: 'roads-3-6',
          name: 'roads',
          type: 'roads',
          x: 3,
          y: 6,
          zone: 1,
          isRoad: true,
        },
        {
          id: 'Farm-Wheat-4-7',
          name: 'Farm-Wheat',
          type: 'Farm-Wheat',
          x: 4,
          y: 7,
          zone: 1,
          isRoad: false,
        },
      ]);
      expect(saved[0].stocks).toBeUndefined();
      expect(harness.neighborsChangedEvents()).toHaveLength(1);
    });

    test('ne réécrit pas si la liste parcels est inchangée', async () => {
      const legacy = [
        { name: 'roads', id: 'roads-0-1', x: 0, y: 1, zone: 1, isRoad: true },
      ];
      harness = createNeighborsHarness([house('House-Blue-2-2', legacy)]);
      harness.repository.raw.get('House-Blue-2-2').neighbors = [
        {
          id: 'roads-0-1',
          name: 'roads',
          type: 'roads',
          x: 0,
          y: 1,
          zone: 1,
          isRoad: true,
        },
      ];

      const outcome = await harness.whenNeighborsAreUpdated('House-Blue-2-2', legacy);

      expect(outcome.updated).toBe(false);
      expect(harness.persistedNeighbors()).toHaveLength(0);
    });

    test('ignore un bâtiment inconnu', async () => {
      expect(await harness.whenNeighborsAreUpdated('missing', [])).toBeNull();
    });

    test('traite une liste absente comme vide', async () => {
      harness = createNeighborsHarness([house('House-Blue-0-0', [])]);
      harness.repository.raw.get('House-Blue-0-0').neighbors = [
        { id: 'roads-0-1', name: 'roads', type: 'roads', x: 0, y: 1, zone: 1, isRoad: true },
      ];

      const outcome = await harness.whenNeighborsAreUpdated('House-Blue-0-0', null);

      expect(outcome.updated).toBe(true);
      expect(outcome.neighborCount).toBe(0);
      expect(await harness.rawNeighborsOf('House-Blue-0-0')).toEqual([]);
    });
  });

  describe('quand on interroge les voisins (query CQRS)', () => {
    test('retourne un read model plat pour l\'UI', async () => {
      harness = createNeighborsHarness([
        house('House-Blue-3-7', [
          { id: 'roads-3-6', name: 'roads', type: 'roads', x: 3, y: 6, zone: 1, isRoad: true },
          { id: 'Farm-Wheat-4-7', name: 'Farm-Wheat', type: 'Farm-Wheat', x: 4, y: 7, zone: 1 },
        ]),
      ]);

      const result = await harness.whenNeighborsAreQueried('House-Blue-3-7');

      expect(result).toEqual({
        buildingId: 'House-Blue-3-7',
        neighbors: [
          {
            buildingId: 'roads-3-6',
            type: 'roads',
            x: 3,
            y: 6,
            isRoad: true,
            zone: 1,
          },
          {
            buildingId: 'Farm-Wheat-4-7',
            type: 'Farm-Wheat',
            x: 4,
            y: 7,
            isRoad: false,
            zone: 1,
          },
        ],
      });
    });

    test('retourne null pour un bâtiment inconnu', async () => {
      expect(await harness.whenNeighborsAreQueried('missing')).toBeNull();
    });
  });
});
