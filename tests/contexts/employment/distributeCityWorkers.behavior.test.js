/**
 * Behavior tests — Employment: DistributeCityWorkers
 *
 * Since the social-groups redesign, worker distribution runs one pass per
 * permanent house group (artisans-ouvriers / commerçants / savants), each
 * scoped to its own eligible sectors — groups never compete for the same
 * jobs (see `HouseGroupSectorEligibilityPolicy`).
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createEmploymentBuildingSnapshot } from '../../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
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
      ])
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

/** Defaults to House-Red (artisans-ouvriers) — sectors 1 (Farm)/3/4 (Windmill). */
function house(id, pop, roadCount = 1, type = 'House-Red') {
  return createEmploymentBuildingSnapshot({
    id,
    type,
    pop,
    roadCount,
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
        { 1: 1, 2: 6 }
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

  describe('DistributeCityWorkers — single group (artisans-ouvriers: sectors 1/3/4)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1),
        house('House-Red-2-2', 3, 0), // no road — ignored
        workplace('Farm-Wheat-3-3', { workerNeed: 3, sector: 1, worker: 9 }),
        workplace('Windmill-001-5-5', {
          workerNeed: 4,
          sector: 4,
          roadCount: 0,
          type: 'Windmill-001',
        }),
      ]);
      useCase = new DistributeCityWorkers(repo);
    });

    test('houses with roads contribute pop; without roads do not', async () => {
      const result = await useCase.execute({
        sectorPriorities: { 1: 1, 4: 3 },
      });
      // Only House-Red-1-1 (pop 5); House-Red-2-2 has no road
      expect(result.availableWorkers).toBe(5);
    });

    test('workplaces without roads are skipped except farms', async () => {
      const result = await useCase.execute({
        sectorPriorities: { 1: 1, 4: 3 },
      });
      expect(result.assignments.find((a) => a.buildingId === 'Windmill-001-5-5')).toBeUndefined();
      expect(repo.get('Windmill-001-5-5').worker).toBe(0);
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(3);
    });

    test('farms without road access receive workers', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 4, 1),
        workplace('Farm-Wheat-0-0', { workerNeed: 3, sector: 1, roadCount: 0 }),
      ]);
      useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result.availableWorkers).toBe(4);
      expect(result.assignments).toEqual([{ buildingId: 'Farm-Wheat-0-0', workers: 3 }]);
      expect(repo.get('Farm-Wheat-0-0').worker).toBe(3);
    });

    test('priority 1 filled before lower priorities within the group; capped at workerNeed', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1),
        workplace('Farm-Wheat-3-3', { workerNeed: 3, sector: 1 }),
        workplace('Windmill-001-5-5', { workerNeed: 2, sector: 4, type: 'Windmill-001' }),
      ]);
      useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({
        sectorPriorities: { 1: 1, 4: 6 },
      });

      expect(result.assignments).toEqual([
        { buildingId: 'Farm-Wheat-3-3', workers: 3 },
        { buildingId: 'Windmill-001-5-5', workers: 2 },
      ]);
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(3);
      expect(repo.get('Windmill-001-5-5').worker).toBe(2);
    });

    test('exhausted pool stops allocation', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 2, 1),
        workplace('Farm-Wheat-3-3', { workerNeed: 3, sector: 1 }),
        workplace('Windmill-001-5-5', { workerNeed: 2, sector: 4, type: 'Windmill-001' }),
      ]);
      useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({
        sectorPriorities: { 1: 1, 4: 2 },
      });

      expect(result.availableWorkers).toBe(2);
      expect(result.assignments).toEqual([{ buildingId: 'Farm-Wheat-3-3', workers: 2 }]);
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(2);
      expect(repo.get('Windmill-001-5-5').worker).toBe(0);
    });

    test('resets previous workers before allocating', async () => {
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(9);
      await useCase.execute({ sectorPriorities: { 1: 1, 4: 6 } });
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(3);
    });

    test('returns empty assignments when no labor', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 0, 1),
        workplace('Farm-Wheat-3-3', { workerNeed: 3, sector: 1 }),
      ]);
      useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result).toEqual({ availableWorkers: 0, assignments: [] });
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(0);
    });
  });

  describe('DistributeCityWorkers — social groups never compete for jobs', () => {
    test('each group is allocated independently against its own eligible sectors', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red'), // artisans-ouvriers
        house('House-Blue-2-2', 3, 1, 'House-Blue'), // commerçants
        house('House-Purple-3-3', 4, 1, 'House-Purple'), // savants
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }), // artisans-ouvriers only
        workplace('Market-Stall-b', { workerNeed: 2, sector: 2, type: 'Market-Stall' }), // commerçants only
        workplace('Chapel-c', { workerNeed: 2, sector: 6, type: 'Chapel' }), // savants only
      ]);
      const useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({
        sectorPriorities: { 1: 1, 2: 1, 6: 1 },
      });

      expect(result.availableWorkers).toBe(12); // 5 + 3 + 4
      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Market-Stall-b').worker).toBe(2);
      expect(repo.get('Chapel-c').worker).toBe(2);
    });

    test("a group's surplus workers cannot fill another group's understaffed workplace", async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 10, 1, 'House-Red'), // artisans-ouvriers: plenty of workers
        house('House-Blue-2-2', 1, 1, 'House-Blue'), // commerçants: barely any
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
        workplace('Market-Stall-b', { workerNeed: 5, sector: 2, type: 'Market-Stall' }),
      ]);
      const useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({ sectorPriorities: { 1: 1, 2: 1 } });

      expect(repo.get('Farm-Wheat-a').worker).toBe(3); // artisans fully staff their own sector
      expect(repo.get('Market-Stall-b').worker).toBe(1); // commerçants stay understaffed — no cross-group borrowing
      expect(result.availableWorkers).toBe(11);
    });

    test('level 1 (autarkic) houses contribute no workers to any group', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        createEmploymentBuildingSnapshot({
          id: 'House-Red-1-1',
          type: 'House-Red',
          pop: 5,
          roadCount: 1,
          level: 1,
        }),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
      ]);
      const useCase = new DistributeCityWorkers(repo);

      const result = await useCase.execute({ sectorPriorities: { 1: 1 } });
      expect(result).toEqual({ availableWorkers: 0, assignments: [] });
      expect(repo.get('Farm-Wheat-a').worker).toBe(0);
    });
  });
});
