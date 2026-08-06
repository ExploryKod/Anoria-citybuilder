/**
 * Behavior tests — Employment: DistributeCityWorkers
 *
 * Worker distribution is skill-based: each pass staffs workplaces that
 * require a given skill using only level-2 citizens of the matching group.
 * See WorkplaceSkillRequirementPolicy.js and Housing GroupLevel2SkillPolicy (via composition).
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createEmploymentBuildingSnapshot } from '../../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
import { houseCitizenHasSkill } from '../../../src/contexts/housing/domain/policies/GroupLevel2SkillPolicy.js';
import { residentialGroupForType } from '../../../src/contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import {
  hasRoadAccess,
  isEligibleWorkplace,
  isFarmType,
  isHouseType,
  isLaborSource,
  isRoadType,
  isWorkplace,
} from '../../../src/contexts/employment/domain/policies/BuildingRolePolicy.js';
import {
  allocateWorkers,
  orderWorkplacesByPriority,
  resolveSectorPriority,
} from '../../../src/contexts/employment/domain/policies/WorkerAllocationPolicy.js';
import { DistributeCityWorkers } from '../../../src/contexts/employment/application/commands/DistributeCityWorkers.js';

class InMemoryEmploymentBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
        },
      ]),
    );
  }

  async listLaborSources() {
    return [...this.raw.values()].filter((b) => isLaborSource(b));
  }

  async listWorkplaces() {
    return [...this.raw.values()].filter((b) => isWorkplace(b));
  }

  async resetWorkplaceWorkers() {
    for (const b of this.raw.values()) {
      if (isWorkplace(b)) {
        this.raw.set(b.id, { ...b, worker: 0 });
      }
    }
  }

  async saveWorkers(buildingId, workerCount) {
    const b = this.raw.get(buildingId);
    if (!b) return;
    this.raw.set(buildingId, { ...b, worker: workerCount });
  }

  get(id) {
    return this.raw.get(id);
  }
}

function house(id, pop, roadCount = 1, type = 'House-Red', level = 2) {
  return createEmploymentBuildingSnapshot({
    id,
    type,
    pop,
    roadCount,
    level,
  });
}

function workplace(id, { workerNeed, sector, roadCount = 1, worker = 0, type = 'Farm-Wheat' }) {
  return createEmploymentBuildingSnapshot({
    id,
    type,
    workerNeed,
    worker,
    sector,
    roadCount,
  });
}

/** Wires Housing skill rules into Employment (same as composition root). */
function citizenProvidesSkill(house, skillKey) {
  const level = house.level === 1 ? 1 : 2;
  return houseCitizenHasSkill(
    { level, residentialGroup: residentialGroupForType(house.type) },
    skillKey,
  );
}

describe('Employment — DistributeCityWorkers', () => {
  describe('domain policies', () => {
    test('building roles', () => {
      expect(isHouseType('House-Red')).toBe(true);
      expect(isRoadType('roads')).toBe(true);
      expect(isLaborSource({ type: 'House-Red' })).toBe(true);
      expect(isWorkplace({ type: 'Farm-Wheat', workerNeed: 3 })).toBe(true);
      expect(isWorkplace({ type: 'House-Red', workerNeed: 0 })).toBe(false);
      expect(isWorkplace({ type: 'roads', workerNeed: 0 })).toBe(false);
      expect(isFarmType('Farm-Wheat')).toBe(true);
      expect(isEligibleWorkplace({ type: 'Farm-Wheat', workerNeed: 3, roadCount: 0 })).toBe(true);
      expect(isEligibleWorkplace({ type: 'Market-Stall', workerNeed: 2, roadCount: 0 })).toBe(false);
      expect(hasRoadAccess({ roadCount: 1 })).toBe(true);
      expect(hasRoadAccess({ roadCount: 0 })).toBe(false);
    });

    test('sector priority 1 is highest; missing sector is lowest', () => {
      expect(resolveSectorPriority(1, { 1: 1, 2: 6 })).toBe(1);
      expect(resolveSectorPriority(2, { 1: 1, 2: 6 })).toBe(6);
      expect(resolveSectorPriority(0, { 1: 1 })).toBe(99);
    });

    test('allocation fills by priority and respects deficit', () => {
      const rows = orderWorkplacesByPriority(
        [
          workplace('low', { workerNeed: 5, sector: 2 }),
          workplace('high', { workerNeed: 3, sector: 1 }),
        ],
        { 1: 1, 2: 6 },
      );
      expect(rows.map((r) => r.workplace.id)).toEqual(['high', 'low']);

      const { assignments, remaining } = allocateWorkers(4, rows);
      expect(assignments).toEqual([
        { buildingId: 'high', workers: 3 },
        { buildingId: 'low', workers: 1 },
      ]);
      expect(remaining).toBe(0);
    });
  });

  describe('DistributeCityWorkers — fermier skill (artisans)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1),
        house('House-Red-2-2', 3, 0),
        workplace('Farm-Wheat-3-3', { workerNeed: 3, sector: 1, worker: 9 }),
        workplace('Windmill-001-5-5', {
          workerNeed: 4,
          sector: 4,
          roadCount: 1,
          type: 'Windmill-001',
        }),
      ]);
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkill });
    });

    test('houses with roads contribute pop; without roads do not', async () => {
      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result.availableWorkers).toBe(5);
    });

    test('artisans only staff farms, not windmills', async () => {
      const result = await useCase.execute({ sectorPriorities: { 1: 1, 4: 1 } });
      expect(result.assignments.find((a) => a.buildingId === 'Windmill-001-5-5')).toBeUndefined();
      expect(repo.get('Windmill-001-5-5').worker).toBe(0);
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(3);
    });

    test('farms without road access receive workers', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 4, 1),
        workplace('Farm-Wheat-0-0', { workerNeed: 3, sector: 1, roadCount: 0 }),
      ]);
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkill });

      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result.assignments).toEqual([{ buildingId: 'Farm-Wheat-0-0', workers: 3 }]);
    });

    test('level 1 artisan houses contribute no workers', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red', 1),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
      ]);
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkill });

      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result).toEqual({ availableWorkers: 0, assignments: [] });
    });
  });

  describe('DistributeCityWorkers — skill isolation between groups', () => {
    test('each group staffs only its mapped workplaces', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red'),
        house('House-Blue-2-2', 3, 1, 'House-Blue'),
        house('House-Purple-3-3', 4, 1, 'House-Purple'),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
        workplace('Market-Stall-b', { workerNeed: 2, sector: 2, type: 'Market-Stall-Red' }),
        workplace('Windmill-c', { workerNeed: 4, sector: 4, type: 'Windmill-001' }),
        workplace('Chapel-d', { workerNeed: 2, sector: 6, type: 'Chapel' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkill });

      const result = await useCase.execute({ sectorPriorities: { 1: 1, 2: 1, 4: 1, 6: 1 } });

      expect(result.availableWorkers).toBe(12);
      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Market-Stall-b').worker).toBe(2);
      expect(repo.get('Windmill-c').worker).toBe(4);
      expect(repo.get('Chapel-d').worker).toBe(0);
    });

    test('surplus artisans cannot staff commerçant workplaces', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 10, 1, 'House-Red'),
        house('House-Blue-2-2', 1, 1, 'House-Blue'),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
        workplace('Market-Stall-b', { workerNeed: 5, sector: 2, type: 'Market-Stall-Red' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkill });

      await useCase.execute({ sectorPriorities: { 1: 1, 2: 1 } });

      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Market-Stall-b').worker).toBe(1);
    });
  });
});
