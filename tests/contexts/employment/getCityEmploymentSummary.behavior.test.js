/**
 * Behavior tests — Employment: GetCityEmploymentSummary
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createEmploymentBuildingSnapshot } from '../../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
import {
  workerPopFromHouse,
  citizenPopFromHouse,
  maxTotalPopForHouse,
} from '../../../src/contexts/employment/domain/policies/LaborPoolPolicy.js';
import { computeCityEmploymentSummary } from '../../../src/contexts/employment/domain/computeCityEmploymentSummary.js';
import { GetCityEmploymentSummary } from '../../../src/contexts/employment/application/queries/GetCityEmploymentSummary.js';
import {
  allSocialGroups,
  eligibleSectorsForGroup,
  residentialGroupForType,
} from '../../../src/contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';

class InMemoryEmploymentBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b }]));
  }

  async listAllSnapshots() {
    return [...this.raw.values()];
  }
}

function house(id, pop, roadCount = 1, type = 'House-Blue') {
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

describe('Employment — GetCityEmploymentSummary', () => {
  describe('LaborPoolPolicy', () => {
    test('regular houses: every resident is a citizen and a worker', () => {
      expect(citizenPopFromHouse('House-Blue', 5)).toBe(5);
      expect(workerPopFromHouse('House-Blue', 5)).toBe(5);
    });

    test('a house holds at most 6 residents', () => {
      expect(maxTotalPopForHouse('House-Blue')).toBe(6);
    });

    test('house pop contributes full headcount regardless of level (eligibility is skill-driven, not gated here)', () => {
      expect(citizenPopFromHouse('House-Red', 6)).toBe(6);
      expect(workerPopFromHouse('House-Red', 6)).toBe(6);
      // A `level` argument, if still passed by a caller, is accepted and ignored.
      expect(workerPopFromHouse('House-Red', 6, 1)).toBe(6);
    });
  });

  describe('HouseGroupSectorEligibilityPolicy', () => {
    test('maps each house color to its permanent social group', () => {
      expect(residentialGroupForType('House-Blue')).toBe('merchants');
      expect(residentialGroupForType('House-Red')).toBe('artisans');
      expect(residentialGroupForType('House-Purple')).toBe('scholars');
      expect(residentialGroupForType('Farm-Wheat')).toBeNull();
    });

    test('maps each social group to its eligible employment sectors', () => {
      expect(eligibleSectorsForGroup('artisans')).toEqual([1, 3, 4]);
      expect(eligibleSectorsForGroup('merchants')).toEqual([2]);
      expect(eligibleSectorsForGroup('scholars')).toEqual([6]);
      expect(eligibleSectorsForGroup('unknown-group')).toEqual([]);
    });

    test('exposes all three groups', () => {
      expect(allSocialGroups().sort()).toEqual(['artisans', 'merchants', 'scholars']);
    });
  });

  describe('computeCityEmploymentSummary', () => {
    test('worker pool counts every resident of a road-served house; totalPopulation = worker pool', () => {
      const summary = computeCityEmploymentSummary([
        house('h1', 5, 1),
        house('h2', 7, 1, 'House-Red'),
        house('h3', 4, 0), // no road
      ]);

      expect(summary.workerPool).toBe(12); // 5 + 7 (the house without a road counts for nothing)
      expect(summary).not.toHaveProperty('elitePool');
      expect(summary.totalPopulation).toBe(12);
      expect(summary.civilServantCount).toBe(1);
      expect(summary.laborPool).toBe(11);
      expect(summary.activeCitizenCount).toBe(0);
      expect(summary.unemployed).toBe(11);
    });

    test('lack and understaffed: farms without road count; other workplaces need road', () => {
      const summary = computeCityEmploymentSummary([
        house('h1', 2, 1),
        workplace('farm-no-road', {
          workerNeed: 3,
          sector: 1,
          worker: 0,
          roadCount: 0,
        }),
        workplace('mill-no-road', {
          workerNeed: 4,
          sector: 4,
          roadCount: 0,
          worker: 0,
          type: 'Windmill-001',
        }),
      ]);

      expect(summary.lack).toBe(3);
      expect(summary.understaffedBuildingIds).toEqual(['farm-no-road']);
      expect(summary.unemployed).toBe(2);
    });

    test('new farm without road absorbs unemployed workers', () => {
      const summary = computeCityEmploymentSummary([
        house('h1', 4, 1),
        workplace('farm-a', { workerNeed: 3, sector: 1, worker: 3, roadCount: 0 }),
      ]);
      expect(summary.unemployed).toBe(1);
      expect(summary.lack).toBe(0);

      const afterFarm = computeCityEmploymentSummary([
        house('h1', 4, 1),
        workplace('farm-a', { workerNeed: 3, sector: 1, worker: 3, roadCount: 0 }),
        workplace('farm-b', { workerNeed: 3, sector: 1, worker: 1, roadCount: 0 }),
      ]);
      expect(afterFarm.unemployed).toBe(0);
      expect(afterFarm.lack).toBe(2);
    });

    test('unemployed = pool minus assigned on eligible workplaces', () => {
      const summary = computeCityEmploymentSummary([
        house('h1', 10, 1),
        workplace('farm', { workerNeed: 3, sector: 1, worker: 2 }),
        workplace('market', { workerNeed: 2, sector: 2, worker: 2, type: 'Market-Stall' }),
      ]);

      expect(summary.totalAssigned).toBe(4);
      expect(summary.unemployed).toBe(6);
      expect(summary.unemploymentPercentage).toBe(60);
    });

    test('bySector aggregates eligible workplaces (farms without road included)', () => {
      const summary = computeCityEmploymentSummary([
        workplace('farm', { workerNeed: 3, sector: 1, worker: 1 }),
        workplace('market-no-road', {
          workerNeed: 5,
          sector: 2,
          roadCount: 0,
          worker: 0,
          type: 'Market-Stall',
        }),
      ]);

      expect(summary.bySector[1]).toEqual({ workerNeed: 3, workers: 1, need: 2 });
      expect(summary.bySector[2]).toBeUndefined();
    });

    test('bySkill aggregates by the workplace\'s required skill (the work panel\'s per-tab rows)', () => {
      const summary = computeCityEmploymentSummary([
        workplace('farm-a', { workerNeed: 3, sector: 1, worker: 1, type: 'Farm-Wheat' }),
        workplace('farm-b', { workerNeed: 3, sector: 1, worker: 2, type: 'Farm-Carrot' }),
        workplace('market-a', { workerNeed: 2, sector: 2, worker: 0, type: 'Market-Stall-Red' }),
      ]);

      // Farm-Wheat and Farm-Carrot both require 'fermier' — aggregated together.
      expect(summary.bySkill.fermier).toEqual({ workerNeed: 6, workers: 3, need: 3 });
      expect(summary.bySkill['vente-alimentaire']).toEqual({ workerNeed: 2, workers: 0, need: 2 });
      expect(summary.bySkill.medical).toBeUndefined();
    });

    test('byGroup breaks the pool/assignment down per social group (global aggregate unchanged)', () => {
      const summary = computeCityEmploymentSummary([
        house('red-house', 5, 1, 'House-Red'), // artisans
        house('blue-house', 3, 1, 'House-Blue'), // commerçants
        workplace('farm', { workerNeed: 3, sector: 1, worker: 3 }), // artisans sector
        workplace('market', { workerNeed: 2, sector: 2, worker: 1, type: 'Market-Stall' }), // commerçants sector
      ]);

      expect(summary.byGroup['artisans']).toEqual({
        workerPool: 5,
        assigned: 3,
        unemployed: 2,
      });
      expect(summary.byGroup.merchants).toEqual({
        workerPool: 3,
        assigned: 1,
        unemployed: 2,
      });
      expect(summary.byGroup.scholars).toEqual({
        workerPool: 0,
        assigned: 0,
        unemployed: 0,
      });

      // Global aggregate stays the flat sum, semantics untouched by the breakdown.
      expect(summary.workerPool).toBe(8);
      expect(summary.totalAssigned).toBe(4);
    });

    test('level 1 (autarkic) houses now count toward their group pool (headcount is skill-agnostic here)', () => {
      // computeCityEmploymentSummary's byGroup is a coarse, skill-agnostic
      // pool/assigned breakdown (see its own docstring) — it doesn't know a
      // level-1 house can only actually staff Chapel (sector 6), not this
      // farm (sector 1); DistributeCityWorkers is what enforces that via
      // skill matching, and is covered separately.
      const summary = computeCityEmploymentSummary([
        createEmploymentBuildingSnapshot({
          id: 'red-house',
          type: 'House-Red',
          pop: 5,
          roadCount: 1,
          level: 1,
        }),
        workplace('farm', { workerNeed: 3, sector: 1 }),
      ]);

      expect(summary.byGroup['artisans']).toEqual({
        workerPool: 5,
        assigned: 0,
        unemployed: 5,
      });
      expect(summary.workerPool).toBe(5);
    });
  });

  describe('GetCityEmploymentSummary query', () => {
    let repo;
    let query;

    beforeEach(() => {
      repo = new InMemoryEmploymentBuildingRepository([
        house('House-Blue-1-1', 8, 1),
        workplace('Farm-Wheat-2-2', { workerNeed: 3, sector: 1, worker: 1 }),
      ]);
      query = new GetCityEmploymentSummary(repo);
    });

    test('delegates to repository single read', async () => {
      const summary = await query.execute();
      expect(summary.workerPool).toBe(8);
      expect(summary.totalAssigned).toBe(1);
      expect(summary.unemployed).toBe(7);
    });
  });
});
