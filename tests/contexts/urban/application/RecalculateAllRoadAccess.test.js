import { describe, test, expect, beforeEach } from '@jest/globals';
import { createBuildingSnapshot } from '../../../../src/contexts/urban/domain/BuildingSnapshot.js';
import { RecalculateAllRoadAccess } from '../../../../src/contexts/urban/application/commands/RecalculateAllRoadAccess.js';
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

describe('RecalculateAllRoadAccess', () => {
  let repository;
  let events;
  let useCase;

  beforeEach(() => {
    repository = new InMemoryBuildingRepository([
      createBuildingSnapshot({
        id: 'House-Blue-1-1',
        type: 'House-Blue',
        neighbors: [{ isRoad: true }],
        roadCount: 0,
      }),
      createBuildingSnapshot({
        id: 'House-Red-2-2',
        type: 'House-Red',
        neighbors: [],
        roadCount: 0,
      }),
      createBuildingSnapshot({
        id: 'roads-0-0',
        type: 'roads',
        neighbors: [],
        roadCount: 0,
      }),
    ]);
    events = new InMemoryDomainEventPublisher();
    useCase = new RecalculateAllRoadAccess(repository, events);
  });

  test('recalcule tous les bâtiments hors routes', async () => {
    const result = await useCase.execute();

    expect(result.processed).toBe(2);
    expect(result.updated).toBe(1);
    expect(repository.saved).toHaveLength(1);
    expect(events.getHistory('urban.RoadAccessChanged')).toHaveLength(1);
  });
});
