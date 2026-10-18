/**
 * Regression guard for the prefab "anoria-tour-61": its exported buildings keep their positions, and its
 * journal gives back the balance the game showed at the moment of the export.
 */

import { describe, test, expect } from '@jest/globals';
import { PREFABS } from '../../src/shared/prefabs/prefabCatalog.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { deriveTreasuryFigures } from '../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { createEmploymentBuildingSnapshot } from '../../src/contexts/employment/domain/EmploymentBuildingSnapshot.js';
import { computeCityEmploymentSummary } from '../../src/contexts/employment/domain/computeCityEmploymentSummary.js';

const prefab = PREFABS['anoria-tour-116'];

describe('prefab anoria-tour-116 — its state is the saved one', () => {
  test('every exported building keeps the anchor it was saved at, in its hamlet', () => {
    for (const building of prefab.city.buildings) {
      const record = canonicalizeHouseRecord(building);
      expect(record.anchorX).toBe(building.x);
      expect(record.anchorY).toBe(building.y);
      expect(record.hamletId).toBe(prefab.hamletId);
    }
  });

  test('its journal starts clean, at the same capital a new game starts with (no inherited deficit)', () => {
    // The city's own account: the founding capital it paid its companies is already in the journal, so it starts at the capital of a new game.
    const figures = deriveTreasuryFigures(prefab.journal.filter((line) => !line.accountBuildingId), { currentTurn: prefab.turn });
    expect(figures.funds).toBeCloseTo(2000, 2);
  });

  test('its merchant and scholar housing is sized to the jobs actually built: no chronic mass unemployment', () => {
    const snapshots = prefab.city.buildings.map((building) => {
      const employees = building.employees || {};
      return createEmploymentBuildingSnapshot({
        id: building.instanceId,
        type: building.type || '',
        roadCount: building.roads ?? 0,
        pop: building.pop ?? 0,
        level: building.level ?? 1,
        worker: employees.worker ?? 0,
        workerNeed: employees.worker_need ?? 0,
        sector: employees.sector ?? 0,
        workerSources: employees.workerSources ?? {},
      });
    });
    const summary = computeCityEmploymentSummary(snapshots);
    // The starter city is a level-1 village (cabanes of at most 6 inhabitants, one water tank): its people all work, and
    // it has more jobs than hands (the lack below), never more hands than jobs.
    expect(summary.totalPopulation).toBe(23);
    expect(summary.unemployed).toBeLessThanOrEqual(4);
    // The trades the first level holds are fully staffed: food storage and sale, and the water tank (hydraulique).
    for (const skillId of ['stockage-alimentaire', 'vente-alimentaire', 'hydraulique']) {
      expect(summary.bySkill[skillId].need).toBe(0);
    }
    // The warehouses ask for `manutention`, which only merchants hold, from their second level: nobody can staff them yet.
    expect(summary.bySkill.manutention).toEqual({ workerNeed: 8, workers: 0, need: 8 });
  });
});
