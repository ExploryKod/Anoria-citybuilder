/**
 * Tests de comportement — accès routier (BC Parcels)
 *
 * Couplés aux scénarios métier, pas à la structure du domaine.
 * On peut refactoriser RoadAccessPolicy, RoadAccess, etc. sans casser ces tests
 * tant que le comportement observable des use cases reste le même.
 *
 * @see https://journal.optivem.com/p/unit-tests-should-not-mirror-source-code-michael-azerhad
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { RecalculateRoadAccessForBuilding } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../../../src/contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { GetBuildingRoadAccess } from '../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';

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

/** Harness : même câblage que createParcelsContext, API orientée scénarios */
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

function house(id, neighbors, roadCount = 0) {
  return createBuildingSnapshot({
    id,
    type: 'House-Blue',
    neighbors,
    roadCount,
  });
}

describe('Accès routier des bâtiments', () => {
  let harness;

  beforeEach(() => {
    harness = createRoadAccessHarness();
  });

  describe('quand on recalcule la desserte d\'un bâtiment', () => {
    test('une maison bordée d\'une route est desservie et enregistrée', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-3-7', [{ name: 'roads', isRoad: true }], 0),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-3-7');

      expect(outcome.roadAccess.hasAccess).toBe(true);
      expect(outcome.roadAccess.roadCount).toBe(1);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: 'House-Blue-3-7', roadCount: 1 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });

    test('une maison isolée n\'est pas desservie', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-1-1', [{ name: 'Farm-Wheat' }], 0),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-1-1');

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(outcome.roadAccess.roadCount).toBe(0);
      expect(outcome.updated).toBe(false);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });

    test('quand une route disparaît, la desserte est corrigée en base', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-1-1', [{ name: 'Farm-Wheat' }], 1),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-1-1');

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: 'House-Blue-1-1', roadCount: 0 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });

    test('si la desserte n\'a pas changé, rien n\'est publié', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-3-7', [{ isRoad: true }], 1),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-3-7');

      expect(outcome.updated).toBe(false);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
      expect(harness.roadAccessChangedEvents()).toHaveLength(0);
    });

    test('un bâtiment inconnu ne déclenche aucune action', async () => {
      expect(await harness.whenRoadAccessIsRecalculatedFor('missing')).toBeNull();
    });

    test('une tuile route n\'est pas concernée par la desserte', async () => {
      harness = createRoadAccessHarness([
        createBuildingSnapshot({
          id: 'roads-1-1',
          type: 'roads',
          neighbors: [{ isRoad: true }],
          roadCount: 0,
        }),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('roads-1-1');

      expect(outcome.skipped).toBe(true);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });
  });

  describe('quand les voisins viennent du format legacy (IndexedDB)', () => {
    test.each([
      ['name "roads"', [{ name: 'roads' }]],
      ['name "Road"', [{ name: 'Road' }]],
      ['buildingId "roads"', [{ buildingId: 'roads' }]],
      ['userData.isRoad', [{ name: 'StonePath', userData: { isRoad: true } }]],
    ])('reconnaît une route via %s', async (_label, neighbors) => {
      harness = createRoadAccessHarness([house('House-Blue-2-2', neighbors, 0)]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-2-2');

      expect(outcome.roadAccess.hasAccess).toBe(true);
      expect(outcome.roadAccess.roadCount).toBe(1);
    });

    test('compte plusieurs routes adjacentes', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-4-4', [{ isRoad: true }, { isRoad: true }, { name: 'Farm' }], 0),
      ]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-4-4');

      expect(outcome.roadAccess.roadCount).toBe(2);
      expect(outcome.roadAccess.hasAccess).toBe(true);
    });

    test('voisins absents ou vides → aucune desserte', async () => {
      harness = createRoadAccessHarness([house('House-Blue-0-0', [], 0)]);

      const outcome = await harness.whenRoadAccessIsRecalculatedFor('House-Blue-0-0');

      expect(outcome.roadAccess.hasAccess).toBe(false);
      expect(outcome.roadAccess.roadCount).toBe(0);
    });
  });

  describe('quand on recalcule la desserte de toute la ville', () => {
    test('seules les maisons sont traitées ; seules les dessertes modifiées sont persistées', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-1-1', [{ isRoad: true }], 0),
        house('House-Red-2-2', [], 0),
        createBuildingSnapshot({ id: 'roads-0-0', type: 'roads', neighbors: [], roadCount: 0 }),
      ]);

      const outcome = await harness.whenAllRoadAccessIsRecalculated();

      expect(outcome.processed).toBe(2);
      expect(outcome.updated).toBe(1);
      expect(harness.persistedRoadCounts()).toEqual([
        { buildingId: 'House-Blue-1-1', roadCount: 1 },
      ]);
      expect(harness.roadAccessChangedEvents()).toHaveLength(1);
    });
  });

  describe('quand on consulte la desserte d\'un bâtiment', () => {
    test('la consultation reflète les voisins en base sans persister', async () => {
      harness = createRoadAccessHarness([
        house('House-Blue-5-5', [{ name: 'roads' }], 0),
      ]);

      const access = await harness.roadAccessOf('House-Blue-5-5');

      expect(access.hasAccess).toBe(true);
      expect(access.roadCount).toBe(1);
      expect(harness.persistedRoadCounts()).toHaveLength(0);
    });
  });
});
