/**
 * Regression tests for the central building catalog and its BC-owned
 * derivations. Guards against the exact drift this file was created to fix
 * (e.g. house price duplicated between `assetsPrices` and `HouseTypeCatalog`).
 */

import { describe, test, expect } from '@jest/globals';
import { buildingCatalog, getBuildingDefinition } from '../../src/shared/building-catalog/buildingCatalog.js';
import { assetsPrices } from '../../src/shared/building-catalog/assetsPrices.js';
import {
  BUILDING_SECTOR_MAP,
  BUILDING_EMPLOYEE_NEEDS,
} from '../../src/contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import { DEFAULT_MAINTENANCE_COSTS } from '../../src/contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import {
  RESIDENTIAL_HOUSE_PRICES,
  HOUSE_TYPE_BLUE,
  HOUSE_TYPE_RED,
  HOUSE_TYPE_PURPLE,
  HOUSE_TYPE_PALACE,
} from '../../src/contexts/housing/domain/HouseTypeCatalog.js';
import { getBuildingDisplayName } from '../../src/presentation/dom/shell/BuildingNotifications.js';

describe('buildingCatalog — pure data contract', () => {
  test('is frozen at every level (no behavior can mutate it)', () => {
    expect(Object.isFrozen(buildingCatalog)).toBe(true);
    expect(Object.isFrozen(buildingCatalog['Farm-Wheat'])).toBe(true);
    expect(Object.isFrozen(buildingCatalog['Farm-Wheat'].construction)).toBe(true);
  });

  test('every entry only has data fields, never functions', () => {
    for (const [id, def] of Object.entries(buildingCatalog)) {
      for (const section of Object.values(def)) {
        if (typeof section === 'object') {
          for (const value of Object.values(section)) {
            expect(typeof value).not.toBe('function');
          }
        }
        expect(typeof section).not.toBe('function');
      }
      expect(typeof id).toBe('string');
    }
  });

  test('getBuildingDefinition looks up by id and returns undefined otherwise', () => {
    expect(getBuildingDefinition('Farm-Wheat')).toBe(buildingCatalog['Farm-Wheat']);
    expect(getBuildingDefinition('Unknown-Type')).toBeUndefined();
    expect(getBuildingDefinition(null)).toBeUndefined();
  });
});

describe('assetsPrices — derived from buildingCatalog', () => {
  test('matches construction facts for a sample of types', () => {
    expect(assetsPrices['House-Blue']).toEqual({ price: 10, category: 'houses', gridSize: 1 });
    expect(assetsPrices['Barn-001']).toEqual({ price: 40, category: 'industry', gridSize: 2 });
    expect(assetsPrices['roads']).toEqual({ price: 5, category: 'infrastructure', gridSize: 1 });
  });

  test('has exactly the entries that declare a construction fact', () => {
    const expectedIds = Object.entries(buildingCatalog)
      .filter(([, def]) => def.construction)
      .map(([id]) => id)
      .sort();
    expect(Object.keys(assetsPrices).sort()).toEqual(expectedIds);
  });
});

describe('HouseTypeCatalog — no more duplicated house prices', () => {
  test('RESIDENTIAL_HOUSE_PRICES matches assetsPrices for every house type', () => {
    for (const type of [HOUSE_TYPE_BLUE, HOUSE_TYPE_RED, HOUSE_TYPE_PURPLE, HOUSE_TYPE_PALACE]) {
      expect(RESIDENTIAL_HOUSE_PRICES[type]).toBe(assetsPrices[type].price);
    }
  });
});

describe('EmploymentSectorCatalog — derived employment facts', () => {
  test('sector map matches catalog for a sample of types', () => {
    expect(BUILDING_SECTOR_MAP['Farm-Wheat']).toBe(1);
    expect(BUILDING_SECTOR_MAP['Market-Stall']).toBe(2);
    expect(BUILDING_SECTOR_MAP['Winery-001']).toBe(3);
    expect(BUILDING_SECTOR_MAP['Barn-001']).toBe(4);
    expect(BUILDING_SECTOR_MAP['roads']).toBe(5);
  });

  test('static employee needs match catalog values', () => {
    expect(BUILDING_EMPLOYEE_NEEDS['Farm-Wheat']).toEqual({ worker_need: 3, elite_need: 0 });
    expect(BUILDING_EMPLOYEE_NEEDS['Windmill-001']).toEqual({ worker_need: 4, elite_need: 2 });
    expect(BUILDING_EMPLOYEE_NEEDS['roads']).toEqual({ worker_need: 0, elite_need: 0 });
  });

  test('Barn-001 needs stay dynamic (not baked into the static catalog)', () => {
    expect(buildingCatalog['Barn-001'].employment.workerNeed).toBeUndefined();
    expect(BUILDING_EMPLOYEE_NEEDS['Barn-001'].worker_need).toBeGreaterThan(0);
  });
});

describe('BuildingMaintenanceBreakdownPolicy — derived maintenance facts', () => {
  test('matches catalog for roads and houses', () => {
    expect(DEFAULT_MAINTENANCE_COSTS.roads).toBe(buildingCatalog.roads.accounting.maintenance);
    expect(DEFAULT_MAINTENANCE_COSTS['House-Blue']).toBe(
      buildingCatalog['House-Blue'].accounting.maintenance
    );
  });
});

describe('BuildingNotifications — derived display names', () => {
  test('resolves catalog display names', () => {
    expect(getBuildingDisplayName('House-Blue')).toBe('Maison bleue');
    expect(getBuildingDisplayName('Farm-Wheat')).toBe('Champ de blé');
  });

  test('keeps the legacy "Road" alias not present in the catalog', () => {
    expect(getBuildingDisplayName('Road')).toBe('Route');
    expect(buildingCatalog.Road).toBeUndefined();
  });
});
