/**
 * Behavior tests — Employment: DistributeCityWorkers
 *
 * Worker distribution is skill-based: each pass staffs workplaces that
 * require a given skill (at a given level) using citizens whose house
 * provides that skill. See WorkplaceSkillRequirementPolicy.js and Housing
 * GroupSkillPolicy (via composition).
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { requiresRoad } from '../../../src/shared/building-catalog/resourceRoleQueries.js';
import { createEmploymentBuildingSnapshot } from '../../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
import { houseCitizenHasSkillAtLevel } from '../../../src/contexts/housing/domain/policies/GroupSkillPolicy.js';
import { residentialGroupForType } from '../../../src/contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import {
  hasRoadAccess,
  isEligibleWorkplace,
  isHouseType,
  isLaborSource,
  isRoadType,
  isWorkplace,
} from '../../../src/contexts/employment/domain/policies/BuildingRolePolicy.js';
import {
  allocateWorkers,
  orderSkillsByPriority,
  orderWorkplacesByPriority,
  resolveSkillPriority,
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

/**
 * Wires Housing skill rules into Employment (same as composition root —
 * see createHousingContext.js's citizenProvidesSkillAtLevel). The house's
 * real tier (1-5) is passed straight through, NOT collapsed to "1 or 2":
 * a skill level granted only from tier 5 onward (e.g. `medical` 2) must
 * stay reachable.
 */
function citizenProvidesSkillAtLevel(house, skillKey, requiredLevel) {
  return houseCitizenHasSkillAtLevel(
    { level: house.level ?? 2, residentialGroup: residentialGroupForType(house.type) },
    skillKey,
    requiredLevel,
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
      // The road need is the catalog's call: fields declare `requiresRoad: false`, a market does not
      expect(requiresRoad('Farm-Wheat')).toBe(false);
      expect(requiresRoad('Market-Stall')).toBe(true);
      expect(isEligibleWorkplace({ type: 'Farm-Wheat', workerNeed: 3, roadCount: 0 })).toBe(true);
      expect(isEligibleWorkplace({ type: 'Market-Stall', workerNeed: 2, roadCount: 0 })).toBe(false);
      expect(hasRoadAccess({ roadCount: 1 })).toBe(true);
      expect(hasRoadAccess({ roadCount: 0 })).toBe(false);
    });

    test('skill priority 1 is highest; missing skill is lowest', () => {
      expect(resolveSkillPriority('fermier', { fermier: 1, 'vente-alimentaire': 6 })).toBe(1);
      expect(resolveSkillPriority('vente-alimentaire', { fermier: 1, 'vente-alimentaire': 6 })).toBe(6);
      expect(resolveSkillPriority('unranked', { fermier: 1 })).toBe(99);
    });

    test('orderSkillsByPriority sorts ascending — this decides which skill DistributeCityWorkers visits first', () => {
      expect(
        orderSkillsByPriority(['vente-alimentaire', 'fermier'], { fermier: 1, 'vente-alimentaire': 6 }),
      ).toEqual(['fermier', 'vente-alimentaire']);
    });

    test('orderWorkplacesByPriority only computes deficits now (priority moved one level up, to the skill)', () => {
      const rows = orderWorkplacesByPriority([
        workplace('low', { workerNeed: 5, sector: 2 }),
        workplace('high', { workerNeed: 3, sector: 1 }),
      ]);
      // No sort — every workplace here already shares one (skill, level)
      // bucket by construction in DistributeCityWorkers, so input order
      // (not a sector lookup) is all that's left to preserve.
      expect(rows.map((r) => r.workplace.id)).toEqual(['low', 'high']);

      const { assignments, remaining } = allocateWorkers(4, rows);
      expect(assignments).toEqual([{ buildingId: 'low', workers: 4 }]);
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
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });
    });

    test('houses with roads contribute pop; without roads do not', async () => {
      const result = await useCase.execute({});
      expect(result.availableWorkers).toBe(5);
    });

    test('artisans only staff farms, not windmills', async () => {
      const result = await useCase.execute({});
      expect(result.assignments.find((a) => a.buildingId === 'Windmill-001-5-5')).toBeUndefined();
      expect(repo.get('Windmill-001-5-5').worker).toBe(0);
      expect(repo.get('Farm-Wheat-3-3').worker).toBe(3);
    });

    test('farms without road access receive workers', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 4, 1),
        workplace('Farm-Wheat-0-0', { workerNeed: 3, sector: 1, roadCount: 0 }),
      ]);
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      const result = await useCase.execute({});
      expect(result.assignments).toEqual([{ buildingId: 'Farm-Wheat-0-0', workers: 3 }]);
    });

    test('level 1 artisan houses count as headcount but cannot staff fermier-gated farms (spiritual only)', async () => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red', 1),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
      ]);
      useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      const result = await useCase.execute({});
      // Tier 1 grants 'spiritual' + 'subsistence-forager', not 'fermier' —
      // so this house's 5 citizens count toward `availableWorkers` (total
      // city headcount) but leave the farm at 0, with nothing to spend them
      // on (no Chapel in this repo).
      expect(result).toEqual({ availableWorkers: 5, assignments: [] });
      expect(repo.get('Farm-Wheat-a').worker).toBe(0);
    });
  });

  describe('DistributeCityWorkers — skill isolation between groups', () => {
    test('each group staffs its mapped workplace; Chapel is shared via everyone\'s tier-1 spiritual skill', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red'),
        house('House-Blue-2-2', 3, 1, 'House-Blue'),
        house('House-Purple-3-3', 4, 1, 'House-Purple'),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
        workplace('Market-Stall-b', { workerNeed: 2, sector: 2, type: 'Market-Stall-Red' }),
        workplace('Windmill-c', { workerNeed: 4, sector: 4, type: 'Windmill-001' }),
        workplace('Chapel-d', { workerNeed: 2, sector: 6, type: 'Chapel' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      const result = await useCase.execute({});

      expect(result.availableWorkers).toBe(12);
      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Market-Stall-b').worker).toBe(2);
      expect(repo.get('Windmill-c').worker).toBe(4);
      // The bug this whole file used to pin: Chapel has no group of its
      // own (every group grants 'spiritual' at tier 1), so it must get
      // staffed from the shared pool — not stay at 0 forever.
      expect(repo.get('Chapel-d').worker).toBe(2);
    });

    test('surplus artisans cannot staff commerçant workplaces', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 10, 1, 'House-Red'),
        house('House-Blue-2-2', 1, 1, 'House-Blue'),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1 }),
        workplace('Market-Stall-b', { workerNeed: 5, sector: 2, type: 'Market-Stall-Red' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({});

      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Market-Stall-b').worker).toBe(1);
    });

    test('a skill shared by two groups lets both staff the same workplace', async () => {
      // No group pre-filter — citizenProvidesSkillAtLevel alone decides
      // eligibility, so a skill catalog that grants 'fermier' to more than
      // one group (not the case in production data today, but a supported
      // shape) must let both groups' houses staff a fermier-requiring
      // workplace.
      const sharedSkill = (house, skillKey) =>
        skillKey === 'fermier' && (house.type === 'House-Red' || house.type === 'House-Blue');

      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 2, 1, 'House-Red'),
        house('House-Blue-2-2', 2, 1, 'House-Blue'),
        workplace('Farm-Wheat-a', { workerNeed: 4, sector: 1 }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel: sharedSkill });

      const result = await useCase.execute({});

      expect(result.availableWorkers).toBe(4);
      expect(repo.get('Farm-Wheat-a').worker).toBe(4);
    });
  });

  describe('DistributeCityWorkers — cold-start deadlock regression', () => {
    test('a single tier-1 house can staff Chapel from turn one, with no other building placed', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 5, 1, 'House-Red', 1),
        workplace('Chapel-x', { workerNeed: 2, sector: 6, type: 'Chapel' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      const result = await useCase.execute({});

      expect(result.availableWorkers).toBe(5);
      expect(result.assignments).toEqual([{ buildingId: 'Chapel-x', workers: 2 }]);
      expect(repo.get('Chapel-x').worker).toBe(2);
    });
  });

  describe('DistributeCityWorkers — skill levels (medical: Doctor vs Hospital)', () => {
    test('a level-2 citizen can also fill a level-1 job, spending the higher-level job first', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Purple-hi', 6, 1, 'House-Purple', 5), // tier 5: medical level 2
        workplace('Doctor-a', { workerNeed: 2, sector: 6, type: 'Doctor' }),
        workplace('Hospital-a', { workerNeed: 4, sector: 6, type: 'Hospital' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({});

      // 6 citizens total: Hospital (level 2, processed first) takes its
      // full deficit of 4, leaving exactly 2 for Doctor (level 1).
      expect(repo.get('Hospital-a').worker).toBe(4);
      expect(repo.get('Doctor-a').worker).toBe(2);
    });

    test('a level-1-only citizen cannot staff a level-2 job, even with a surplus', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Purple-lo', 3, 1, 'House-Purple', 2), // tier 2: medical level 1 only
        house('House-Purple-hi', 2, 1, 'House-Purple', 5), // tier 5: medical level 2
        workplace('Doctor-a', { workerNeed: 4, sector: 6, type: 'Doctor' }),
        workplace('Hospital-a', { workerNeed: 1, sector: 6, type: 'Hospital' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({});

      // Hospital (level 2) can only draw from the level-2 house: 1 of its
      // 2 citizens. Doctor (level 1) then draws from BOTH the level-1-only
      // house (3) and the level-2 house's 1 leftover citizen = 4, exactly
      // its deficit — proving the level-1-only house never touches Hospital.
      expect(repo.get('Hospital-a').worker).toBe(1);
      expect(repo.get('Doctor-a').worker).toBe(4);
    });
  });

  describe('DistributeCityWorkers — the School is staffable BEFORE tier 5 (no tier-gate deadlock)', () => {
    test('tier-5 coverage needs a running School, so tier-4 scholars (education level 1) must be able to staff it', async () => {
      const repo = new InMemoryEmploymentBuildingRepository([
        house('House-Purple-lo', 8, 1, 'House-Purple', 4), // tier 4: the highest tier reachable without a School
        workplace('School-a', { workerNeed: 3, sector: 6, type: 'School' }),
      ]);
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({});

      expect(repo.get('School-a').worker).toBe(3);
    });
  });

  describe('DistributeCityWorkers — skill priority (2026-09-10 per-group redesign)', () => {
    // A dual-skilled artisans house (fermier + artisanat, same tier-2 grant
    // — see socialCategoryCatalog.js) is the one real case where priority
    // now does something: not enough of its own population for both a farm
    // AND a pottery workshop, so whichever skill the player ranked higher
    // in the artisans tab gets first claim on the shared labor.
    function dualSkillRepo() {
      return new InMemoryEmploymentBuildingRepository([
        house('House-Red-1-1', 4, 1, 'House-Red'),
        workplace('Farm-Wheat-a', { workerNeed: 3, sector: 1, type: 'Farm-Wheat' }),
        workplace('Factory-Plate-a', { workerNeed: 3, sector: 3, type: 'Factory-Plate' }),
      ]);
    }

    test('ranking artisanat above fermier sends the shared labor to the factory first', async () => {
      const repo = dualSkillRepo();
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({ skillPriorities: { artisanat: 1, fermier: 2 } });

      expect(repo.get('Factory-Plate-a').worker).toBe(3);
      expect(repo.get('Farm-Wheat-a').worker).toBe(1);
    });

    test('flipping the ranking sends the shared labor to the farm instead', async () => {
      const repo = dualSkillRepo();
      const useCase = new DistributeCityWorkers(repo, { citizenProvidesSkillAtLevel });

      await useCase.execute({ skillPriorities: { fermier: 1, artisanat: 2 } });

      expect(repo.get('Farm-Wheat-a').worker).toBe(3);
      expect(repo.get('Factory-Plate-a').worker).toBe(1);
    });
  });
});
