import { buildingCatalog, getBuildingDefinition } from './buildingCatalog.js';

/**
 * Catalog-derived questions about goods and stocks that MORE THAN ONE
 * bounded context needs (Supply owns the flows, Housing reads the
 * resulting house stocks, composition builds empty rows). Everything here
 * is computed from `resourceRoles` in buildingEconomy.js — no good's name
 * ("wheat", "fruit", …) is written anywhere in code, so a new good is a
 * catalog edit and nothing else. Read-only, no side effects, no imports
 * from `src/contexts/**` (same rules as buildingCatalog.js).
 */

/**
 * @param {string} buildingType
 * @returns {import('./buildingCatalog.js').ResourceRoleFacts[]}
 */
export function getResourceRoles(buildingType) {
  return getBuildingDefinition(buildingType)?.resourceRoles ?? [];
}

/**
 * @param {import('./buildingCatalog.js').ResourceRoleFacts} entry
 * @returns {boolean} True for a consumer that drains a numeric stock (the default mode).
 */
function isQuantityConsumer(entry) {
  return entry.role === 'consumer' && (entry.consumption ?? 'quantity') === 'quantity';
}

/**
 * @param {string} buildingType
 * @returns {boolean} True when the type drains a numeric stock for its inhabitants (a house).
 */
export function hasQuantityConsumer(buildingType) {
  return getResourceRoles(buildingType).some(isQuantityConsumer);
}

/**
 * Every distinct category any building declares for a given role — e.g.
 * "a crop" is whatever some building declares as a 'producer' category,
 * not a hand-maintained list that can drift from what farms produce.
 * @param {import('./buildingCatalog.js').ResourceRoleKind} role
 * @returns {ReadonlyArray<string>}
 */
export function getAllCategoriesForRole(role) {
  const categories = new Set();
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.role !== role) continue;
      for (const category of entry.categories) categories.add(category);
    }
  }
  return Object.freeze([...categories]);
}

/**
 * The one stock shape shared by every building row: every category any
 * building declares for a role that actually holds its own persistent
 * quantity stock — 'producer', 'collector'/'hub', and a 'quantity'
 * 'consumer'. A 'distributor' is excluded on purpose (it pulls from a
 * linked hub instead of holding its own stock, or carries no stock at all
 * in 'flag' mode).
 *
 * `totalKey` stays a single shared value because only ONE aggregated good
 * declares one today; a good with no aggregate (single-category role) just
 * has its own categories preserved. If a second good ever needs its own
 * aggregate total, this would have to return a totalKey PER good.
 * @returns {{ categories: ReadonlyArray<string>, totalKey: string }}
 */
export function getResourceStockShape() {
  const categories = new Set();
  let totalKey;
  const STOCK_BEARING_ROLES = new Set(['producer', 'collector', 'hub']);
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (!STOCK_BEARING_ROLES.has(entry.role) && !isQuantityConsumer(entry)) continue;
      for (const category of entry.categories) categories.add(category);
      if (entry.totalKey) totalKey = entry.totalKey;
    }
  }
  return { categories: Object.freeze([...categories]), totalKey: totalKey ?? 'total' };
}

/**
 * A fresh, all-zero stock row in the shared shape (every category + the
 * aggregate total) — what a newly placed building starts with.
 * @returns {Record<string, number>}
 */
export function createEmptyStocks() {
  const { categories, totalKey } = getResourceStockShape();
  const stocks = {};
  for (const category of categories) stocks[category] = 0;
  stocks[totalKey] = 0;
  return stocks;
}

/**
 * The 'quantity' consumer entry a building type declares (e.g. a house's
 * daily need), or, when no type is given / it declares none, the first one
 * declared anywhere in the catalog.
 * @param {string} [buildingType]
 * @returns {import('./buildingCatalog.js').ResourceRoleFacts | undefined}
 */
export function getQuantityConsumerEntry(buildingType) {
  const own = getResourceRoles(buildingType).find(isQuantityConsumer);
  if (own) return own;
  for (const definition of Object.values(buildingCatalog)) {
    const found = (definition.resourceRoles ?? []).find(isQuantityConsumer);
    if (found) return found;
  }
  return undefined;
}

/**
 * Units one inhabitant needs per period, straight from the catalog's
 * consumer `amount` — the single source for "how much does a citizen
 * eat", so no policy ever has to assume it.
 * @param {string} [buildingType]
 * @returns {number}
 */
export function getPerCapitaDemand(buildingType) {
  const amount = getQuantityConsumerEntry(buildingType)?.amount;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Categories a house-like building can consume (union over every type).
 * @returns {ReadonlyArray<string>}
 */
export function getConsumableCategories() {
  const categories = new Set();
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (!isQuantityConsumer(entry)) continue;
      for (const category of entry.categories) categories.add(category);
    }
  }
  return Object.freeze([...categories]);
}

/**
 * Consumable categories a consumer produces for ITSELF (its own 'producer'
 * entry, e.g. household gathering) — as opposed to goods that must be
 * supplied to it through the distribution chain.
 * @returns {ReadonlyArray<string>}
 */
export function getSelfProducedCategories() {
  const categories = new Set();
  for (const definition of Object.values(buildingCatalog)) {
    const entries = definition.resourceRoles ?? [];
    if (!entries.some(isQuantityConsumer)) continue;
    for (const entry of entries) {
      if (entry.role !== 'producer') continue;
      for (const category of entry.categories) categories.add(category);
    }
  }
  return Object.freeze([...categories]);
}

/**
 * Consumable categories that arrive through the distribution chain
 * (consumable minus self-produced).
 * @returns {ReadonlyArray<string>}
 */
export function getSuppliedCategories() {
  const own = new Set(getSelfProducedCategories());
  return Object.freeze(getConsumableCategories().filter((category) => !own.has(category)));
}

/**
 * The 'producer' entry through which a building type feeds the distribution
 * chain once per year (a supplied good with a `year` period lock), or
 * `undefined` — what makes a building "a farm" without naming one.
 * @param {string} buildingType
 * @returns {import('./buildingCatalog.js').ResourceRoleFacts | undefined}
 */
export function getAnnualSupplyEntry(buildingType) {
  const supplied = new Set(getSuppliedCategories());
  return getResourceRoles(buildingType).find(
    (entry) =>
      entry.role === 'producer' &&
      entry.periodLock?.unit === 'year' &&
      entry.categories.some((category) => supplied.has(category))
  );
}

/**
 * When those producers harvest (the schedule of the first one the catalog
 * declares), or `null`.
 * @returns {{ unit: string, values?: string[] } | null}
 */
export function getAnnualHarvestSchedule() {
  for (const type of Object.keys(buildingCatalog)) {
    const entry = getAnnualSupplyEntry(type);
    if (entry) return entry.schedule ?? null;
  }
  return null;
}

/**
 * Units one such producer yields per harvest year, straight from the
 * catalog: the smallest `amount` among them (conservative when crops
 * differ). `0` when the catalog declares no such producer.
 * @returns {number}
 */
export function getAnnualYieldPerProducer() {
  const amounts = Object.keys(buildingCatalog)
    .map((type) => getAnnualSupplyEntry(type)?.amount)
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  return amounts.length > 0 ? Math.min(...amounts) : 0;
}

/**
 * Stock ceiling declared for a building type: the first `maxStock` found
 * on any of its role entries. `undefined` means the catalog declares no
 * ceiling (unbounded) — there is deliberately no hidden default.
 * @param {string} buildingType
 * @returns {number | undefined}
 */
export function getMaxStockForBuilding(buildingType) {
  const entry = getResourceRoles(buildingType).find(
    (candidate) => Number.isFinite(candidate.maxStock) && candidate.maxStock > 0
  );
  return entry?.maxStock;
}

/**
 * Every category the catalog files under one aggregate `totalKey` (e.g.
 * everything a citizen can eat, whether farmed or gathered) — the shape a
 * stock write must use so it updates the aggregate consistently.
 * @param {string} totalKey
 * @returns {ReadonlyArray<string>}
 */
export function getCategoriesForTotalKey(totalKey) {
  const categories = new Set();
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.totalKey !== totalKey) continue;
      for (const category of entry.categories) categories.add(category);
    }
  }
  return Object.freeze([...categories]);
}
