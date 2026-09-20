/**
 * Guard: the economy catalog is the single source of truth for goods, reach
 * and stock ceilings. These tests fail when a value drifts back into code.
 *
 *  - every distributor declares its own reach (`range`), no global fallback;
 *  - every stock-holding market/hub declares its `maxStock`;
 *  - every good a role uses has ONE presentation entry (name, emoji);
 *  - no good's name is written in the code (only catalogs may spell one).
 */

import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';
import {
  getAllCategoriesForRole,
  getResourceRoles,
  getResourceStockShape,
  getMaxStockForBuilding,
} from '../../src/shared/building-catalog/resourceRoleQueries.js';
import { RESOURCE_CATEGORY_PRESENTATION } from '../../src/contexts/supply/domain/catalogs/ResourceCategoryCatalog.js';

const entriesOf = (role) =>
  Object.entries(buildingCatalog).flatMap(([type, definition]) =>
    (definition.resourceRoles ?? [])
      .filter((entry) => entry.role === role)
      .map((entry) => ({ type, entry }))
  );

describe('economy catalog — reach', () => {
  test('every distributor declares a range (a number, Infinity for "everywhere")', () => {
    const distributors = entriesOf('distributor');
    expect(distributors.length).toBeGreaterThan(0);
    for (const { type, entry } of distributors) {
      expect({ type, range: typeof entry.range }).toEqual({ type, range: 'number' });
      expect(entry.range).toBeGreaterThan(0);
    }
  });
});

describe('economy catalog — stock ceilings', () => {
  test('every hub and every stock-holding distributor declares a positive maxStock', () => {
    const holders = [
      ...entriesOf('hub'),
      ...entriesOf('distributor').filter(({ entry }) => (entry.consumption ?? 'quantity') === 'quantity'),
    ];
    expect(holders.length).toBeGreaterThan(0);
    for (const { type } of holders) {
      expect({ type, cap: getMaxStockForBuilding(type) > 0 }).toEqual({ type, cap: true });
    }
  });

  test('a building with no declared ceiling is unbounded, never silently capped', () => {
    expect(getMaxStockForBuilding('House-Blue')).toBeUndefined();
  });

  test('a multi-category quantity role names its aggregate (totalKey)', () => {
    for (const role of ['producer', 'collector', 'hub', 'consumer', 'distributor']) {
      for (const { type, entry } of entriesOf(role)) {
        if ((entry.consumption ?? 'quantity') !== 'quantity' || entry.categories.length <= 1) continue;
        expect({ type, role, totalKey: Boolean(entry.totalKey) }).toEqual({ type, role, totalKey: true });
      }
    }
  });
});

describe('economy catalog — goods', () => {
  test('every category a role uses has a presentation entry (its one name/emoji)', () => {
    const used = new Set(
      ['producer', 'collector', 'hub', 'distributor', 'consumer'].flatMap((role) => getAllCategoriesForRole(role))
    );
    for (const category of used) {
      expect({ category, declared: Boolean(RESOURCE_CATEGORY_PRESENTATION[category]) }).toEqual({
        category,
        declared: true,
      });
    }
  });

  test('every stock category shares one aggregate, declared by the catalog', () => {
    const { categories, totalKey } = getResourceStockShape();
    expect(categories.length).toBeGreaterThan(0);
    expect(typeof totalKey).toBe('string');
    expect(getResourceRoles('House-Blue').some((entry) => entry.totalKey === totalKey)).toBe(true);
  });
});

describe('no good is named in code', () => {
  const SRC_ROOT = path.resolve('src');
  /** Files that legitimately spell a good: the catalogs themselves and generated/asset registries. */
  const CATALOG_PATHS = [
    'shared/asset-economy/',
    'shared/asset-footprint/',
    'shared/building-catalog/kenney',
    'presentation/three/assets/',
    'contexts/supply/domain/catalogs/ResourceCategoryCatalog.js',
  ];
  /**
   * Known, documented exceptions — a per-farm-type accounting screen whose rows
   * are bound to fixed DOM ids ('wheat-fields-value', …). Anything else is a bug.
   */
  const KNOWN_EXCEPTIONS = ['presentation/dom/compta/bilan/BuildingBreakdownEnrichment.js'];

  const stripComments = (content) =>
    content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  function listJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsFiles(full);
      return entry.name.endsWith('.js') ? [full] : [];
    });
  }

  test('goods declared by producers and consumers never appear as a word in source code', () => {
    // Words distinctive enough to grep for; a generic word ("plate", "game") would false-positive.
    const goods = ['wheat', 'carrot', 'cabbage', 'fruit', 'amphora', 'dattes'];
    const declared = new Set(getAllCategoriesForRole('producer').concat(getAllCategoriesForRole('consumer')));
    for (const good of goods) expect(declared.has(good) || good === 'dattes').toBe(true);

    const pattern = new RegExp(`(?<![\\w-])(${goods.join('|')})(?![\\w-])`);
    const offenders = [];
    for (const file of listJsFiles(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file).split(path.sep).join('/');
      if (CATALOG_PATHS.some((prefix) => relative.startsWith(prefix))) continue;
      if (KNOWN_EXCEPTIONS.includes(relative)) continue;
      if (pattern.test(stripComments(fs.readFileSync(file, 'utf8')))) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });
});
