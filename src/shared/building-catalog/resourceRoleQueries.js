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
 * Whether a type hands out a stock (a market): it holds a 'distributor' entry that moves a quantity, as opposed to
 * a service that only marks coverage.
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isQuantityDistributorType(buildingType) {
  return getResourceRoles(buildingType).some(
    (entry) => entry.role === 'distributor' && (entry.consumption ?? 'quantity') === 'quantity'
  );
}

/**
 * The stock ceiling the catalog declares on the first building holding a role for some of these goods (the
 * ceiling of "the hub of what citizens eat", "a market stall"), or undefined when none declares one.
 * @param {import('./buildingCatalog.js').ResourceRoleKind} role
 * @param {ReadonlyArray<string>} categories
 * @returns {number | undefined}
 */
export function getMaxStockOfRole(role, categories) {
  for (const [type, definition] of Object.entries(buildingCatalog)) {
    const held = (definition.resourceRoles ?? []).some(
      (entry) => entry.role === role && entry.categories.some((category) => categories.includes(category))
    );
    if (held) return getMaxStockForBuilding(type);
  }
  return undefined;
}

/**
 * The code the city map writes for a type: the first two letters of the name
 * the player reads (the catalog's `displayName`, accents dropped, upper case) —
 * never of the id the code uses. A type without a display name gets the "…"
 * marker, not a code made of its id. Nothing is declared per building: renaming one renames its code.
 * @param {string | null | undefined} buildingType
 * @returns {string}
 */
export function getMapCode(buildingType) {
  if (!buildingType) return '';
  const name = getBuildingDefinition(buildingType)?.displayName;
  if (!name) return '…';
  return name
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Whether a building type depends on a road to do anything at all — the
 * catalog's `requiresRoad` (true unless it says `false`). Unknown types keep
 * the default (a road is required).
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function requiresRoad(buildingType) {
  return getBuildingDefinition(buildingType)?.requiresRoad !== false;
}

/**
 * Manhattan tiles, from any tile of a building's footprint, within which a road connects it — the
 * catalog's `roadRange`, 1 (a road touching it) when it declares none.
 * @param {string | null | undefined} buildingType
 * @returns {number}
 */
export function getRoadRange(buildingType) {
  const range = getBuildingDefinition(buildingType)?.roadRange;
  return Number.isFinite(range) && range >= 1 ? Math.floor(range) : 1;
}

/**
 * Whether a building type is a workplace: the catalog gives it staff to hire. A type that lists an
 * `employment` with no staff to hire (a road piece) is not one.
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isWorkplaceType(buildingType) {
  return (getBuildingDefinition(buildingType)?.employment?.workerNeed ?? 0) > 0;
}

/**
 * The road side of "can this building act": true when the type needs no road,
 * or when it has one. Every context asks this instead of comparing road counts.
 * @param {string | null | undefined} buildingType
 * @param {number | null | undefined} roadCount
 * @returns {boolean}
 */
export function isRoadNeedMet(buildingType, roadCount) {
  return !requiresRoad(buildingType) || (Number.isFinite(roadCount) ? roadCount : 0) > 0;
}

/**
 * The kind of natural resource a building type IS (a tree is 'wood'), or
 * undefined for anything that is not a natural resource.
 * @param {string | null | undefined} buildingType
 * @returns {string | undefined}
 */
export function getNaturalResourceKind(buildingType) {
  return getBuildingDefinition(buildingType)?.naturalResource;
}

/**
 * The natural sources a building type depends on: the `source` fact of each of
 * its 'producer' entries (see buildingCatalog.js), empty for anything else.
 * @param {string | null | undefined} buildingType
 * @returns {Array<{ resource: string, range: number, consume?: number }>}
 */
export function getNaturalSources(buildingType) {
  return getResourceRoles(buildingType)
    .filter((entry) => entry.role === 'producer' && entry.source)
    .map((entry) => entry.source);
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
 * `totalKeys` lists EVERY aggregate the catalog declares, because a row can
 * hold more than one: a diet total ("can a citizen eat") and a warehouse's
 * capacity total ("how full is it") are different questions about different
 * goods, and neither may overwrite the other.
 *
 * `totalKey` is the aggregate the quantity CONSUMER declares — the total a
 * citizen cares about — which is what a caller asking for "the total" means
 * (house and market info, traceability, the city map). A caller that wants a
 * specific good's aggregate asks that good's own role instead
 * (getTotalKeyForRole), never this one.
 * @returns {{ categories: ReadonlyArray<string>, totalKey: string, totalKeys: ReadonlyArray<string> }}
 */
export function getResourceStockShape() {
  const categories = new Set();
  const totalKeys = new Set();
  let consumerTotalKey;
  const STOCK_BEARING_ROLES = new Set(['producer', 'collector', 'hub']);
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      const consumesQuantity = isQuantityConsumer(entry);
      if (!STOCK_BEARING_ROLES.has(entry.role) && !consumesQuantity) continue;
      for (const category of entry.categories) categories.add(category);
      if (!entry.totalKey) continue;
      totalKeys.add(entry.totalKey);
      // The first quantity consumer declared is the citizens' primary need (their diet): a later
      // one (another good they use up) must not take its place as "the total".
      if (consumesQuantity) consumerTotalKey ??= entry.totalKey;
    }
  }
  const totalKey = consumerTotalKey ?? 'total';
  totalKeys.add(totalKey);
  return {
    categories: Object.freeze([...categories]),
    totalKey,
    totalKeys: Object.freeze([...totalKeys]),
  };
}

/**
 * A fresh, all-zero stock row in the shared shape (every category + every
 * aggregate total the catalog declares) — what a newly placed building
 * starts with.
 * @returns {Record<string, number>}
 */
export function createEmptyStocks() {
  const { categories, totalKeys } = getResourceStockShape();
  const stocks = {};
  for (const category of categories) stocks[category] = 0;
  for (const totalKey of totalKeys) stocks[totalKey] = 0;
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
 * Every 'quantity' consumer entry a building type declares, in declaration order — one per thing
 * it uses up (its diet, the goods it wears out...). The first is its primary need.
 * @param {string} buildingType
 * @returns {import('./buildingCatalog.js').ResourceRoleFacts[]}
 */
export function getQuantityConsumerEntries(buildingType) {
  return getResourceRoles(buildingType).filter(isQuantityConsumer);
}

/**
 * The distinct 'quantity' consumer entries declared anywhere in the catalog, keyed by their first
 * category (one per thing a citizen uses up) — what a city-wide consumption pass iterates.
 * @returns {ReadonlyArray<import('./buildingCatalog.js').ResourceRoleFacts>}
 */
export function listQuantityConsumerNeeds() {
  const byKey = new Map();
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (isQuantityConsumer(entry) && !byKey.has(entry.categories[0])) byKey.set(entry.categories[0], entry);
    }
  }
  return Object.freeze([...byKey.values()]);
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
    // The primary need only (the first quantity consumer entry): what else a building uses up is
    // reached through `getQuantityConsumerEntries`.
    const primary = (definition.resourceRoles ?? []).find(isQuantityConsumer);
    if (!primary) continue;
    for (const category of primary.categories) categories.add(category);
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
 * The aggregate a good is filed under (e.g. 'wheat' → 'food'), or the good
 * itself when the catalog files it under none — a single-category good is
 * its own total (same rule as ResourceRolePolicy.getTotalKeyForRole).
 *
 * The symmetric counterpart of getCategoriesForTotalKey, for a caller that
 * starts from the good rather than from the aggregate: a recipe names the
 * good it consumes (see ProduceResource's `inputs`), and the stock write
 * that takes it must still keep the right aggregate in sync.
 * @param {string} category
 * @returns {string}
 */
export function getTotalKeyForCategory(category) {
  // A good can be filed under one aggregate where it is stored (a hub's `goods`) and another where it is
  // used up (a house's `heat`): the aggregate of where it is held comes first.
  const STORING_ROLES = new Set(['producer', 'collector', 'hub']);
  for (const storing of [true, false]) {
    for (const definition of Object.values(buildingCatalog)) {
      for (const entry of definition.resourceRoles ?? []) {
        if (STORING_ROLES.has(entry.role) !== storing) continue;
        if (entry.totalKey && entry.categories.includes(category)) return entry.totalKey;
      }
    }
  }
  return category;
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
