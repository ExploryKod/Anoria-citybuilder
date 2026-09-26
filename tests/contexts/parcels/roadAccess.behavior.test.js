/**
 * Tests de comportement — accès routier (BC Parcels)
 *
 * La règle : un bâtiment est desservi s'il y a une route à portée de Manhattan de N'IMPORTE QUELLE
 * case de son empreinte (`roadRange` du catalogue, 1 par défaut) — pas des voisins vus depuis sa case d'origine.
 */

import { describe, test, expect } from '@jest/globals';
import { createBuildingSnapshot } from '../../../src/contexts/parcels/domain/BuildingSnapshot.js';
import { evaluateRoadAccessByRange } from '../../../src/contexts/parcels/domain/policies/RoadAccessPolicy.js';
import { RecalculateRoadAccessForBuilding } from '../../../src/contexts/parcels/application/commands/RecalculateRoadAccessForBuilding.js';
import { RecalculateAllRoadAccess } from '../../../src/contexts/parcels/application/commands/RecalculateAllRoadAccess.js';
import { GetBuildingRoadAccess } from '../../../src/contexts/parcels/application/queries/GetBuildingRoadAccess.js';
import { InMemoryDomainEventPublisher } from '../../../src/contexts/parcels/infrastructure/events/InMemoryDomainEventPublisher.js';
import { createBuildingInstanceId, makeParcelHouseSnapshot } from '../../fixtures/parcelsFixtures.js';

const road = (x, y) => ({ x, y });

describe('Accès routier par distance de Manhattan depuis l\'empreinte', () => {
  // A one-tile building (a house is 2x2): the distance from its single tile is easy to read.
  const house = (x, y) => ({ type: 'Doctor', x, y });

  test('une route contiguë dessert, une route en diagonale ne dessert pas', () => {
    expect(evaluateRoadAccessByRange(house(3, 7), [road(3, 6)]).hasAccess).toBe(true);
    expect(evaluateRoadAccessByRange(house(3, 7), [road(4, 6)])).toMatchObject({ roadCount: 0, hasAccess: false });
  });

  test('une route loin ne dessert pas', () => {
    expect(evaluateRoadAccessByRange(house(3, 7), [road(3, 5), road(9, 9)]).hasAccess).toBe(false);
  });

  test('la distance se mesure depuis toute l\'empreinte : la route contre la dernière case d\'un grand bâtiment compte', () => {
    // Warehouse: 3 wide, 2 deep — it covers x 10..12, y 10..11.
    const warehouse = { type: 'Warehouse', x: 10, y: 10 };
    expect(evaluateRoadAccessByRange(warehouse, [road(12, 12)]).hasAccess).toBe(true); // under its far corner
    expect(evaluateRoadAccessByRange(warehouse, [road(13, 11)]).hasAccess).toBe(true); // beside its far side
    expect(evaluateRoadAccessByRange(warehouse, [road(9, 12)]).hasAccess).toBe(false); // diagonal to the corner
  });

  test('une rotation d\'un quart de tour échange largeur et profondeur', () => {
    const rotated = { type: 'Warehouse', x: 10, y: 10, rotationStep: 1 }; // now x 10..11, y 10..12
    expect(evaluateRoadAccessByRange(rotated, [road(11, 13)]).hasAccess).toBe(true);
    expect(evaluateRoadAccessByRange(rotated, [road(12, 10)]).hasAccess).toBe(true);
    expect(evaluateRoadAccessByRange(rotated, [road(13, 10)]).hasAccess).toBe(false);
  });

  test('le nombre de routes à portée est compté', () => {
    expect(evaluateRoadAccessByRange(house(3, 7), [road(3, 6), road(3, 8), road(2, 7)]).roadCount).toBe(3);
  });

  test('un type sans empreinte déclarée est une erreur, pas une case supposée', () => {
    expect(() => evaluateRoadAccessByRange({ type: 'Unknown-Building', x: 1, y: 1 }, [])).toThrow(/No footprint declared/);
  });

  test('une case de route ne compte pas elle-même', () => {
    expect(evaluateRoadAccessByRange({ type: 'StonePath-001', x: 1, y: 1 }, [road(1, 1)]).hasAccess).toBe(false);
  });
});

describe('Recalcul et consultation de l\'accès routier', () => {
  class InMemoryBuildingRepository {
    constructor(buildings = [], roadTiles = []) {
      this.buildings = new Map(buildings.map((b) => [b.id, { ...b }]));
      this.roadTiles = roadTiles;
      this.savedRoadAccess = [];
    }

    async findById(id) {
      return this.buildings.get(id) ?? null;
    }

    async findAll() {
      return [...this.buildings.values()];
    }

    async findRoadTiles() {
      return this.roadTiles;
    }

    async saveRoadAccess(id, roadCount) {
      const building = this.buildings.get(id);
      if (building) {
        building.roadCount = roadCount;
        this.savedRoadAccess.push({ instanceId: id, roadCount });
      }
    }
  }

  function harnessFor(buildings, roadTiles) {
    const repository = new InMemoryBuildingRepository(buildings, roadTiles);
    const events = new InMemoryDomainEventPublisher();
    return {
      repository,
      events,
      recalculate: (id) => new RecalculateRoadAccessForBuilding(repository, events).execute(id),
      recalculateAll: () => new RecalculateAllRoadAccess(repository, events).execute(),
      read: (id) => new GetBuildingRoadAccess(repository).execute(id),
    };
  }

  test('une maison contre une route est desservie, enregistrée, et publiée une fois', async () => {
    const id = createBuildingInstanceId();
    const h = harnessFor([makeParcelHouseSnapshot({ instanceId: id, x: 3, y: 7 })], [road(3, 6)]);

    const outcome = await h.recalculate(id);

    expect(outcome.roadAccess).toMatchObject({ hasAccess: true, roadCount: 1 });
    expect(h.repository.savedRoadAccess).toEqual([{ instanceId: id, roadCount: 1 }]);
    expect(h.events.getHistory('parcels.RoadAccessChanged')).toHaveLength(1);

    // Nothing changed: nothing written, nothing published.
    await h.recalculate(id);
    expect(h.repository.savedRoadAccess).toHaveLength(1);
    expect(h.events.getHistory('parcels.RoadAccessChanged')).toHaveLength(1);
  });

  test('quand la route disparaît, la desserte est corrigée', async () => {
    const id = createBuildingInstanceId();
    const h = harnessFor([makeParcelHouseSnapshot({ instanceId: id, x: 3, y: 7, roadCount: 1 })], []);

    const outcome = await h.recalculate(id);

    expect(outcome.roadAccess.hasAccess).toBe(false);
    expect(h.repository.savedRoadAccess).toEqual([{ instanceId: id, roadCount: 0 }]);
  });

  test('un champ reste desservi sans route : le catalogue dit route non requise', async () => {
    const fieldId = createBuildingInstanceId();
    const marketId = createBuildingInstanceId();
    const h = harnessFor(
      [
        makeParcelHouseSnapshot({ instanceId: fieldId, type: 'Farm-Wheat' }),
        makeParcelHouseSnapshot({ instanceId: marketId, type: 'Market-Stall' }),
      ],
      []
    );

    expect((await h.recalculate(fieldId)).roadAccess).toMatchObject({ roadCount: 0, hasAccess: true });
    expect((await h.recalculate(marketId)).roadAccess.hasAccess).toBe(false);
  });

  test('un bâtiment inconnu ne déclenche aucune action', async () => {
    expect(await harnessFor([], []).recalculate(createBuildingInstanceId())).toBeNull();
  });

  test('le recalcul de toute la ville ne persiste que ce qui change', async () => {
    const served = createBuildingInstanceId();
    const isolated = createBuildingInstanceId();
    const h = harnessFor(
      [
        makeParcelHouseSnapshot({ instanceId: served, x: 3, y: 7 }),
        makeParcelHouseSnapshot({ instanceId: isolated, x: 20, y: 20 }),
        createBuildingSnapshot({ id: createBuildingInstanceId(), type: 'roads', x: 1, y: 1 }),
      ],
      [road(3, 6)]
    );

    const outcome = await h.recalculateAll();

    expect(outcome.updated).toBe(1);
    expect(h.repository.savedRoadAccess).toEqual([{ instanceId: served, roadCount: 1 }]);
  });

  test('la consultation reflète les routes à portée sans rien persister', async () => {
    const id = createBuildingInstanceId();
    const h = harnessFor([makeParcelHouseSnapshot({ instanceId: id, x: 3, y: 7 })], [road(2, 7)]);

    const result = await h.read(id);

    expect(result.roadAccess).toMatchObject({ hasAccess: true, roadCount: 1 });
    expect(h.repository.savedRoadAccess).toHaveLength(0);
  });
});
