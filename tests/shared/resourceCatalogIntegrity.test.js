/**
 * Guard: the economy catalog is the single source of truth for goods, reach
 * and stock ceilings. These tests fail when a value drifts back into code.
 *
 *  - every distributor declares its own reach (`range`), no global fallback;
 *  - every stock-holding market/hub declares its `maxStock`;
 *  - every good a role uses has ONE presentation entry (name, emoji);
 *  - no good's name is written in the code (only catalogs may spell one);
 *  - the food loop can be closed: the catalog's numbers never make feeding a city impossible.
 */

import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from '../../src/shared/population/socialCategoryCatalog.js';
import { CITIZENS_PER_CIVIL_SERVANT } from '../../src/contexts/accounting/domain/policies/ReferenceSalaryPayrollPolicy.js';
import { MONTHS } from '../../src/shared/time/TimeCalendar.js';
import {
  getAllCategoriesForRole,
  getAnnualSupplyEntry,
  getPerCapitaDemand,
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

describe('no catalog id is named in code', () => {
  const SRC_ROOT = path.resolve('src');
  /** Files that legitimately spell an id: the catalogs themselves and the generated/asset registries. */
  const CATALOG_PATHS = [
    'shared/asset-economy/',
    'shared/asset-footprint/',
    'shared/building-catalog/kenney',
    'presentation/three/assets/',
    'contexts/supply/domain/catalogs/ResourceCategoryCatalog.js',
    'shared/building-catalog/assetIdsByCategory.js',
    // Classifiers of the Kenney kit's own asset names ("rock" there is a mesh family, not a deposit).
    'shared/editor-catalog/',
  ];
  /** A catalog, wherever it lives, may name what it declares. */
  const isCatalogFile = (relative) => /(^|\/)catalogs\//.test(relative) || /Catalog\.js$/.test(relative);
  /** Ids too ordinary to grep for: another meaning of the same word is everywhere in the code. */
  const TOO_GENERIC = new Set(['game', 'grass', 'terrain', 'goods', 'food', 'heat']);
  const KNOWN_EXCEPTIONS = ['presentation/dom/compta/bilan/BuildingBreakdownEnrichment.js'];

  const stripComments = (content) => content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  function listJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsFiles(full);
      return entry.name.endsWith('.js') ? [full] : [];
    });
  }

  /** What the catalog makes an id of: economic building types, goods, aggregates and deposit kinds. */
  function catalogIds() {
    const ids = new Set();
    for (const [type, definition] of Object.entries(buildingCatalog)) {
      if (definition.residentialGroup || (definition.resourceRoles ?? []).length > 0) ids.add(type);
      for (const kind of [definition.naturalResource, ...(definition.deposits ?? []), ...Object.keys(definition.tileDeposits ?? {})]) {
        if (kind) ids.add(kind);
      }
      for (const entry of definition.resourceRoles ?? []) {
        for (const category of entry.categories) ids.add(category);
        if (entry.totalKey) ids.add(entry.totalKey);
      }
    }
    return [...ids].filter((id) => !TOO_GENERIC.has(id));
  }

  test('a building type, a good or a deposit is never a quoted string in source code', () => {
    const ids = catalogIds();
    expect(ids.length).toBeGreaterThan(20);
    const escaped = ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(['"\`])(${escaped.join('|')})\\1`, 'g');

    const offenders = [];
    for (const file of listJsFiles(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file).split(path.sep).join('/');
      if (CATALOG_PATHS.some((prefix) => relative.startsWith(prefix)) || isCatalogFile(relative)) continue;
      if (KNOWN_EXCEPTIONS.includes(relative)) continue;
      const named = new Set([...stripComments(fs.readFileSync(file, 'utf8')).matchAll(pattern)].map((match) => match[2]));
      if (named.size > 0) offenders.push(`${relative} → ${[...named].join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('no road is named in code', () => {
  const SRC_ROOT = path.resolve('src');
  const CATALOG_PATHS = [
    'shared/asset-economy/',
    'shared/asset-footprint/',
    'shared/building-catalog/kenney',
    'presentation/three/assets/',
    'shared/building-catalog/assetIdsByCategory.js',
    // A schema migration names the past it migrates: the retired road tile becomes the road tool.
    'core/persistence/dexie/db.js',
  ];
  const stripComments = (content) => content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  function listJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsFiles(full);
      return entry.name.endsWith('.js') ? [full] : [];
    });
  }

  test('the catalog declares its roads, and code asks it (isRoadType) instead of matching a name', () => {
    const roads = Object.entries(buildingCatalog).filter(([, definition]) => definition.isRoad === true).map(([type]) => type);
    expect(roads.length).toBeGreaterThan(0);

    // A road id, or the prefix its variants share, quoted in code: the check belongs to roadQueries.js.
    const prefixes = [...new Set(roads.map((road) => road.split('-')[0]))];
    const pattern = new RegExp(`['"\`](${[...roads, ...prefixes].join('|')})[-'"\`]`);
    const offenders = [];
    for (const file of listJsFiles(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file).split(path.sep).join('/');
      if (CATALOG_PATHS.some((prefix) => relative.startsWith(prefix))) continue;
      if (pattern.test(stripComments(fs.readFileSync(file, 'utf8')))) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Can a city feed itself with these rules? Feeding P inhabitants for a year takes
 * P × (baskets per inhabitant per year ÷ a farm's yield) farms, and each farm needs
 * `workerNeed` farmers holding the farm's skill — a skill only some social groups have.
 * So the farmers a city needs, per inhabitant, must fit inside the labor pool the
 * farm-capable groups provide (every resident works, minus the civil servants).
 * The share of the population that has to be farm-capable is the number to watch:
 * at or above 100 % no city could ever feed itself, whatever the player builds.
 *
 * Trade may one day make that dependence deliberate; the expectation below is then to
 * be changed consciously, not by accident when a number is tuned.
 */
describe('economy catalog — the food loop can be closed', () => {
  const farms = Object.keys(buildingCatalog)
    .filter((type) => getAnnualSupplyEntry(type))
    .map((type) => ({
      type,
      skill: buildingCatalog[type].employment.requiredSkill,
      farmersPerBasket: buildingCatalog[type].employment.workerNeed / getAnnualSupplyEntry(type).amount,
    }));

  const groupsGranting = (skill) =>
    Object.entries(SOCIAL_CATEGORY)
      .filter(([, group]) => Object.values(group.tiers).some((tier) => skill in tier.skills))
      .map(([id]) => id);

  test('every farm asks for a skill some social group can hold', () => {
    expect(farms.length).toBeGreaterThan(0);
    for (const { type, skill } of farms) {
      expect({ type, groups: groupsGranting(skill).length > 0 }).toEqual({ type, groups: true });
    }
  });

  test('the farmers needed per inhabitant fit in the labor pool of the farm-capable groups', () => {
    const basketsPerInhabitantPerYear = getPerCapitaDemand() * MONTHS.length;
    const workersPerInhabitant = 1 - 1 / CITIZENS_PER_CIVIL_SERVANT;

    for (const { type, farmersPerBasket } of farms) {
      const farmersPerInhabitant = basketsPerInhabitantPerYear * farmersPerBasket;
      const farmCapableShareNeeded = farmersPerInhabitant / workersPerInhabitant;
      // Below 1: a city made only of farm-capable residents can feed itself
      expect({ type, soluble: farmCapableShareNeeded < 1 }).toEqual({ type, soluble: true });
    }
  });
});
