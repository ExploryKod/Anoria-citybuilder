import { describe, test, expect } from '@jest/globals';
import { buildingMaintenanceCost } from '../../../src/contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';

// Regression: a plant hands out a quantity, so it reads as a market by kind and used to pay the market default (2) whatever its
// catalog said. It pays what it declares.
describe('an energy plant pays the upkeep its catalog entry declares', () => {
  test.each(['CoalPlant', 'PetrolPlant', 'NuclearPlant'])('%s', (type) => {
    expect(buildingCatalog[type].accounting.maintenance).toBeGreaterThan(2);
    expect(buildingMaintenanceCost(type)).toBe(buildingCatalog[type].accounting.maintenance);
  });
});
