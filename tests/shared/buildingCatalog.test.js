/**
 * Regression tests for the central building catalog and its BC-owned
 * derivations. Guards against the exact drift this file was created to fix
 * (e.g. house price duplicated between `assetsPrices` and `HouseTypeCatalog`).
 */

import { describe, test, expect } from '@jest/globals';
import { buildingCatalog, getBuildingDefinition } from '../../src/shared/building-catalog/buildingCatalog.js';
import { assetsPrices } from '../../src/shared/asset-placement/buildingPlacementCatalog.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../../src/shared/building-catalog/kenneyCityKitRegistry.generated.js';
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
    expect(assetsPrices['House-Blue']).toEqual({
      price: 10, category: 'houses', gridSize: 1, footprintWidth: 1, footprintDepth: 1,
    });
    expect(assetsPrices['Barn-001']).toEqual({
      price: 40, category: 'industry', gridSize: 2, footprintWidth: 2, footprintDepth: 2,
    });
    expect(assetsPrices['StonePath-001']).toEqual({
      price: 5, category: 'infrastructure', gridSize: 1, footprintWidth: 1, footprintDepth: 1,
    });
  });

  test('the legacy roads id is fully retired — StonePath is the only road tool', () => {
    expect(buildingCatalog.roads).toBeUndefined();
    expect(assetsPrices.roads).toBeUndefined();
  });

  test('has exactly the entries that declare a construction fact (buildingCatalog already merges village + Kenney)', () => {
    const expectedIds = Object.entries(buildingCatalog)
      .filter(([, def]) => def.construction)
      .map(([id]) => id)
      .sort();
    expect(Object.keys(assetsPrices).sort()).toEqual(expectedIds);
  });

  test('buildingCatalog itself includes Kenney ids — no separate merge needed downstream', () => {
    expect(buildingCatalog['Kenney-Commercial-building-a']).toBeDefined();
    expect(
      Object.keys(KENNEY_BUILDING_CATALOG_ENTRIES).every((id) => buildingCatalog[id] !== undefined)
    ).toBe(true);
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
    expect(BUILDING_SECTOR_MAP['StonePath-001']).toBe(5);
  });

  test('roads is aliased to StonePath-001 — every placed road, whichever rotation variant, gets its runtime type marker set to \'roads\' for connectivity', () => {
    expect(BUILDING_SECTOR_MAP['roads']).toBe(BUILDING_SECTOR_MAP['StonePath-001']);
    expect(BUILDING_EMPLOYEE_NEEDS['roads']).toEqual(BUILDING_EMPLOYEE_NEEDS['StonePath-001']);
  });

  test('static employee needs match catalog values', () => {
    expect(BUILDING_EMPLOYEE_NEEDS['Farm-Wheat']).toEqual({ worker_need: 3, elite_need: 0 });
    expect(BUILDING_EMPLOYEE_NEEDS['Windmill-001']).toEqual({ worker_need: 4, elite_need: 2 });
    expect(BUILDING_EMPLOYEE_NEEDS['StonePath-001']).toEqual({ worker_need: 0, elite_need: 0 });
  });

  test('Barn-001 needs stay dynamic (not baked into the static catalog)', () => {
    expect(buildingCatalog['Barn-001'].employment.workerNeed).toBeUndefined();
    expect(BUILDING_EMPLOYEE_NEEDS['Barn-001'].worker_need).toBeGreaterThan(0);
  });
});

describe('BuildingMaintenanceBreakdownPolicy — derived maintenance facts', () => {
  test('matches catalog for roads (aliased to StonePath-001) and houses', () => {
    expect(DEFAULT_MAINTENANCE_COSTS.roads).toBe(
      buildingCatalog['StonePath-001'].accounting.maintenance
    );
    expect(DEFAULT_MAINTENANCE_COSTS['House-Blue']).toBe(
      buildingCatalog['House-Blue'].accounting.maintenance
    );
  });
});

describe('assetsPrices — every buildingCatalog entry with a construction fact is playable', () => {
  test('includes Kenney, village buildings, and StonePath — no separate playable allowlist', () => {
    expect(assetsPrices['Kenney-Suburban-building-type-a']).toBeDefined();
    expect(assetsPrices['Farm-Wheat']).toBeDefined();
    expect(assetsPrices['StonePath-001']).toBeDefined();
    expect(assetsPrices.roads).toBeUndefined();
    expect(assetsPrices['House-Blue']).toBeDefined();
    expect(assetsPrices['Market-Stall']).toBeDefined();
    expect(assetsPrices['Barn-001']).toBeDefined();
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
