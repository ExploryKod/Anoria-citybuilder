/**
 * Monthly maintenance breakdown carries the rate it was charged at, and the journal export keeps every stored field.
 */

import { describe, test, expect } from '@jest/globals';
import { buildTurnBudgetMaintenanceSnapshot, DEFAULT_MAINTENANCE_COSTS } from '../../../src/contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { buildJournalExportPayload } from '../../../src/contexts/accounting/presentation/JournalExportViewModel.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';
import { primaryRoadType } from '../../../src/shared/building-catalog/roadQueries.js';

describe('maintenance breakdown — unit rates come from the catalog', () => {
  test('each category carries the rate it is priced at', () => {
    const { maintenanceBreakdown } = buildTurnBudgetMaintenanceSnapshot([primaryRoadType(), primaryRoadType()]);
    expect(maintenanceBreakdown.roads.count).toBe(2);
    expect(maintenanceBreakdown.roads.unitCost).toBe(buildingCatalog[primaryRoadType()].accounting.maintenance);
    expect(maintenanceBreakdown.roads.cost).toBe(2 * DEFAULT_MAINTENANCE_COSTS.roads);
    expect(maintenanceBreakdown.farms.unitCost).toBe(DEFAULT_MAINTENANCE_COSTS.Farm);
    expect(maintenanceBreakdown.houses.unitCost).toBeNull();
  });
});

describe('journal export — every stored field is kept', () => {
  test('hamletId, year, month, businessKey and buildingInstanceId survive the export', () => {
    const stored = {
      id: 7,
      turn: 165,
      date: '2026-10-04T09:25:18.840Z',
      type: 'salary',
      amount: 300,
      description: 'Salaires fonctionnaires - Octobre 2 ap JC',
      hamletId: 'a1b2c3d4-0000-4000-8000-000000000000',
      year: 2,
      month: 10,
      businessKey: 'salary:2:9',
      buildingInstanceId: 'bld-1',
    };
    const payload = buildJournalExportPayload({
      entries: [stored],
      yearlySummary: [],
      yearEndBalances: [],
    });
    expect(payload.entries[0]).toEqual(stored);
  });
});
