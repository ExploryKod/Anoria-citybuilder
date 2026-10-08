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
    const figures = deriveTreasuryFigures(prefab.journal, { currentTurn: prefab.turn });
    expect(figures.funds).toBe(500);
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
    expect(summary.totalPopulation).toBe(41);
    expect(summary.unemployed).toBeLessThanOrEqual(1);
    // The Warehouse and TradeWarehouse's 4 worker slots each (BuildingRolePolicy's `isHouseType` used to misread
    // their names — "ware**house**" — as a house and zero their need) are now correctly counted. A blanket
    // `lack: 8` would not say which caste is short — the game has three (artisans/merchants/scholars), each
    // holding its own skills — so this pins it to the actual skill both buildings require: `manutention`,
    // which only artisans (House-Red, from their tier 2 on) hold. No other skill is short.
    expect(summary.lack).toBe(8);
    expect(summary.bySkill.manutention).toEqual({ workerNeed: 8, workers: 0, need: 8 });
    for (const [skillId, stats] of Object.entries(summary.bySkill)) {
      if (skillId !== 'manutention') expect(stats.need).toBe(0);
    }
  });
});
