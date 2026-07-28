import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../../src/contexts/urban/domain/BuildingSnapshot.js';
import { RecalculateRoadAccessForBuilding } from '../../../../src/contexts/urban/application/commands/RecalculateRoadAccessForBuilding.js';
import { InMemoryDomainEventPublisher } from '../../../../src/infrastructure/events/InMemoryDomainEventPublisher.js';

class InMemoryBuildingRepository {
  constructor(buildings = []) {
    this.buildings = new Map(buildings.map((b) => [b.id, { ...b }]));
    this.saved = [];
  }

  async findById(buildingId) {
    return this.buildings.get(buildingId) ?? null;
  }

  async findAll() {
    return [...this.buildings.values()];
  }

  async saveRoadAccess(buildingId, roadCount) {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.roadCount = roadCount;
      this.saved.push({ buildingId, roadCount });
    }
  }
}

describe('RecalculateRoadAccessForBuilding', () => {
  let repository;
  let events;
  let useCase;

  beforeEach(() => {
    repository = new InMemoryBuildingRepository([
      createBuildingSnapshot({
        id: 'House-Blue-3-7',
        type: 'House-Blue',
        neighbors: [{ name: 'roads', isRoad: true }],
        roadCount: 0,
      }),
    ]);
    events = new InMemoryDomainEventPublisher();
    useCase = new RecalculateRoadAccessForBuilding(repository, events);
  });

  test('met à jour roadCount et publie un événement si changement', async () => {
    const result = await useCase.execute('House-Blue-3-7');

    expect(result.updated).toBe(true);
    expect(result.roadAccess.roadCount).toBe(1);
    expect(repository.saved).toEqual([{ buildingId: 'House-Blue-3-7', roadCount: 1 }]);
    expect(events.getHistory('urban.RoadAccessChanged')).toHaveLength(1);
  });

  test('ne persiste pas si roadCount inchangé', async () => {
    repository.buildings.get('House-Blue-3-7').roadCount = 1;

    const result = await useCase.execute('House-Blue-3-7');

    expect(result.updated).toBe(false);
    expect(repository.saved).toHaveLength(0);
    expect(events.getHistory()).toHaveLength(0);
  });

  test('retourne null si bâtiment inconnu', async () => {
    expect(await useCase.execute('missing')).toBeNull();
  });

  test('ignore les routes (pas d\'accès routier applicable)', async () => {
    repository.buildings.set(
      'roads-1-1',
      createBuildingSnapshot({
        id: 'roads-1-1',
        type: 'roads',
        neighbors: [],
        roadCount: 0,
      })
    );

    const result = await useCase.execute('roads-1-1');
    expect(result.skipped).toBe(true);
    expect(repository.saved).toHaveLength(0);
  });
});
