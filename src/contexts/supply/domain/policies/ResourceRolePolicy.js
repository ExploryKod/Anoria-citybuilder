import { buildingCatalog, getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getShelfLifeMonths } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { shelfLifeTurnsOf } from './StockAgingPolicy.js';
import {
  getResourceRoles,
  getAllCategoriesForRole,
  getResourceStockShape,
  getMaxStockForBuilding,
  getCategoriesForTotalKey,
  getTotalKeyForCategory,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Supply's derivation point for `resourceRoles` (see buildingCatalog.js) —
 * which resource categories a building type produces, collects, holds,
 * distributes, or consumes, and at what range. Building selection (which
 * type counts as a "farm" or "market" for a given step) reads this instead
 * of matching on the type's name string. The catalog-wide questions that
 * other contexts also need (stock shape, all categories of a role, stock
 * ceiling) live in shared/building-catalog/resourceRoleQueries.js and are
 * re-exported here so Supply keeps a single import point.
 */
export { getResourceRoles, getAllCategoriesForRole, getResourceStockShape, getMaxStockForBuilding };

/**
 * The categories and aggregate a stock write about `category` must use, so that the right total stays in sync: the entry's own `totalKey` when it
 * declares one, otherwise the aggregate the catalog files that good under (the good itself when it belongs to none, e.g. pottery today). Every write to a
 * stock (a harvest, a recipe, a loss to spoilage) uses this one rule, so what goes in and what comes out are read and written the same way: a role that
 * names only its own good (a farm's) would otherwise take units out of a total of its own and leave the shared one (the food) standing.
 *
 * @param {string} category
 * @param {string} [declaredTotalKey]
 * @returns {{ categories: readonly string[], totalKey: string }}
 */
export function stockShapeFor(category, declaredTotalKey) {
  const totalKey = declaredTotalKey ?? getTotalKeyForCategory(category);
  const filedUnder = getCategoriesForTotalKey(totalKey);
  return { categories: filedUnder.length > 0 ? filedUnder : [category], totalKey };
}

/**
 * Resolves the one `resourceRoles` entry an accessor means, when a building
 * type can hold the same role more than once (e.g. a house is both a
 * 'quantity' food consumer and a 'flag' service consumer). With a single
 * matching entry, `category`/`consumption` are irrelevant and it's returned
 * as-is — every existing single-role-entry building type is unaffected.
 *
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {object} [filter]
 * @param {string} [filter.category] Entry must cover this category.
 * @param {'quantity' | 'flag'} [filter.consumption] Entry's `consumption`
 *   mode must match (missing `consumption` on the entry means 'quantity').
 * @returns {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts | undefined}
 */
function findRoleEntry(buildingType, role, { category, consumption } = {}) {
  const entries = getResourceRoles(buildingType).filter((entry) => entry.role === role);
  if (entries.length <= 1) return entries[0];
  return entries.find(
    (entry) =>
      (category == null || entry.categories.includes(category)) &&
      (consumption == null || (entry.consumption ?? 'quantity') === consumption)
  );
}

/**
 * The role entry a caller means (see `findRoleEntry`), for the facts that have no accessor of their own.
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {{ category?: string, consumption?: 'quantity' | 'flag' }} [filter]
 * @returns {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts | undefined}
 */
export function getRoleEntry(buildingType, role, filter) {
  return findRoleEntry(buildingType, role, filter);
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string | string[]} [category] When given, also require this role
 *   to cover the category — an array matches if any category overlaps
 *   (e.g. selecting "any food distributor" by passing all crop names).
 * @returns {boolean}
 */
export function hasResourceRole(buildingType, role, category) {
  const wanted = category == null ? null : Array.isArray(category) ? category : [category];
  return getResourceRoles(buildingType).some(
    (entry) => entry.role === role && (!wanted || wanted.some((c) => entry.categories.includes(c)))
  );
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption
 *   mode instead of/alongside category — e.g. ConsumeResource wants "the
 *   quantity consumer entry" without knowing its category up front.
 * @returns {string[]} Categories declared for this role, or [] if the building doesn't hold it.
 */
export function getCategoriesForRole(buildingType, role, category, consumption) {
  return findRoleEntry(buildingType, role, { category, consumption })?.categories ?? [];
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @returns {number | undefined} Manhattan range for that role, or undefined
 *   when the catalog doesn't declare one (see `requireRangeForRole` for the
 *   strict variant a distributor must use).
 */
export function getRangeForRole(buildingType, role, category) {
  return findRoleEntry(buildingType, role, { category })?.range;
}

/**
 * A role's reach, or a loud error when the catalog forgot to declare it.
 * `range` is the ONE place a building's reach lives (use `Infinity` for
 * "everywhere") — there is deliberately no global fallback, so a missing
 * declaration is a catalog bug to fix, never something to paper over.
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category]
 * @returns {number}
 * @throws {Error} When the catalog declares no `range` for this role.
 */
export function requireRangeForRole(buildingType, role, category) {
  const range = getRangeForRole(buildingType, role, category);
  if (range === undefined) {
    throw new Error(
      `[ResourceRolePolicy] "${buildingType}" role "${role}" declares no range in buildingEconomy.js`
    );
  }
  return range;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {number | undefined} Max linked distributors for that role (only
 *   meaningful for 'hub'), or undefined when the catalog doesn't declare one.
 */
export function getLinkCapacityForRole(buildingType, role) {
  return findRoleEntry(buildingType, role)?.linkCapacity;
}

/**
 * @param {string} buildingType
 * @returns {import('../../../../shared/building-catalog/buildingCatalog.js').PlacementRequirement[]}
 */
export function getPlacementRequirements(buildingType) {
  return getBuildingDefinition(buildingType)?.placementRequires ?? [];
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption mode.
 * @returns {{ field: string, unit: 'year' | 'month' } | undefined} Once-per-period
 *   lock field/unit for this role, or undefined when the role doesn't lock
 *   (e.g. a distributor with no schedule). See PeriodLockPolicy.js.
 */
export function getPeriodLockForRole(buildingType, role, category, consumption) {
  return findRoleEntry(buildingType, role, { category, consumption })?.periodLock;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {{ sourceLinkField?: string, linksField?: string, linkTargetIdField?: string, allocationField?: string } | undefined}
 *   Hub-link storage field names for this role, or undefined when the role
 *   doesn't participate in a hub link. See TransferHubToHub.js.
 */
export function getHubLinkForRole(buildingType, role, category) {
  return findRoleEntry(buildingType, role, { category })?.hubLink;
}

/**
 * Every entry a building type declares for a role, in declaration order — a market holds one
 * 'distributor' entry per thing it distributes, each with its own goods, ceiling and hub link.
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts[]}
 */
export function listRoleEntries(buildingType, role) {
  return getResourceRoles(buildingType).filter((entry) => entry.role === role);
}

/**
 * Stock ceiling of the role entry covering `category` (a market's ceiling for one thing it distributes).
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category]
 * @returns {number | undefined}
 */
export function getMaxStockForRole(buildingType, role, category) {
  return findRoleEntry(buildingType, role, { category })?.maxStock;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption mode.
 * @returns {{ unit: string } | undefined} When this role only fires on a
 *   schedule (see ResourceSchedulePolicy.js) — undefined means unconditional.
 */
export function getScheduleForRole(buildingType, role, category, consumption) {
  return findRoleEntry(buildingType, role, { category, consumption })?.schedule;
}

/**
 * The life of a good in the place a building keeps it, in turns: its months in the calendar's days, times the `shelfLifeFactor` of the hub role that keeps it (1 where there is none: a field, a stall).
 * The one rule the aging of the stocks and the price of a fresh or stale unit both read.
 * @param {string} buildingType
 * @param {string} category
 * @param {number} daysPerMonth
 * @returns {number} `Infinity` for a good that never goes bad
 */
export function shelfLifeTurnsAt(buildingType, category, daysPerMonth) {
  const factor = listRoleEntries(buildingType, 'hub').find((hub) => hub.categories.includes(category))?.shelfLifeFactor ?? 1;
  return shelfLifeTurnsOf({ shelfLifeMonths: getShelfLifeMonths(category), factor, daysPerMonth });
}

/**
 * The same life in months, before the calendar turns it into days: the span a seller's stock keeps a good, which its price carries the risk of (see unsoldRiskDiscount).
 * @param {string} buildingType
 * @param {string} category
 * @returns {number} `Infinity` for a good that never goes bad
 */
export function shelfLifeMonthsAt(buildingType, category) {
  const factor = listRoleEntries(buildingType, 'hub').find((hub) => hub.categories.includes(category))?.shelfLifeFactor ?? 1;
  return getShelfLifeMonths(category) * factor;
}

const MONTHS_OF_THE_YEAR = Object.freeze(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);

/** @type {Map<string, { unit: string, values?: ReadonlyArray<string> }>} the derived collection schedules (the catalog does not change while the game runs) */
const collectionSchedules = new Map();

/**
 * The months a collector (a granary) collects in. One that declares a `schedule` keeps it. One that declares none collects in the months its sources sell in: the union of the
 * `sale` windows of the producers of the goods it collects, in the order of the year (a producer with no window sells whenever the hub collects, so the hub then collects all
 * year). Each window is declared once, on its producer: a crop sold in a month its granary does not collect in would otherwise never be bought, and nothing would say so.
 *
 * @param {string} hubType
 * @returns {{ unit: string, values?: ReadonlyArray<string> } | undefined} undefined when the type is no collector
 */
export function getCollectionSchedule(hubType) {
  const collector = findRoleEntry(hubType, 'collector');
  if (!collector) return undefined;
  if (collector.schedule) return collector.schedule;
  if (!collectionSchedules.has(hubType)) collectionSchedules.set(hubType, deriveCollectionSchedule(hubType, collector));
  return collectionSchedules.get(hubType);
}

function deriveCollectionSchedule(hubType, collector) {
  const months = new Set();
  let producers = 0;
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.role !== 'producer' || !entry.categories.some((category) => collector.categories.includes(category))) continue;
      producers += 1;
      if (!entry.sale) return Object.freeze({ unit: 'always' });
      const window = entry.sale.schedule;
      if (window?.unit !== 'month' || !Array.isArray(window.values)) {
        throw new Error(`[ResourceRolePolicy] a producer of ${entry.categories.join('/')} sells in a window that is not a list of months: ${hubType}'s collection months cannot be derived from it`);
      }
      for (const month of window.values) months.add(month);
    }
  }
  if (producers === 0) throw new Error(`[ResourceRolePolicy] ${hubType} collects ${collector.categories.join('/')}, declares no schedule, and no producer makes any of it`);
  return Object.freeze({ unit: 'month', values: Object.freeze(MONTHS_OF_THE_YEAR.filter((month) => months.has(month))) });
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption mode.
 * @returns {number | undefined} Units this role produces/moves per scheduled
 *   occurrence (e.g. a farm's annual yield), or undefined when not applicable.
 */
export function getAmountForRole(buildingType, role, category, consumption) {
  return findRoleEntry(buildingType, role, { category, consumption })?.amount;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @returns {'quantity' | 'flag'} Whether this role's transfers move a
 *   depleting numeric stock ('quantity', the default) or just mark the
 *   consumer "served this period" with no stock movement ('flag'). See
 *   DistributeResourceToConsumers.js.
 */
export function getConsumptionModeForRole(buildingType, role, category) {
  return findRoleEntry(buildingType, role, { category })?.consumption ?? 'quantity';
}

/**
 * Resolves which stock field aggregates this role's categories.
 *
 * Explicit in the catalog when the role spans more than one category (e.g.
 * a house consuming wheat/carrot/cabbage under one 'food' total)
 * — required in that case, since nothing safe can be inferred. A role with
 * zero or exactly one category needs no `totalKey` at all: it's its own
 * total (or there's nothing to total), so a catalog author can't get this
 * wrong by omission the way they could with an ambiguous multi-category role.
 *
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption mode.
 * @returns {string} The resolved total key.
 * @throws {Error} When more than one category is declared and no `totalKey` is set.
 */
export function getTotalKeyForRole(buildingType, role, category, consumption) {
  const entry = findRoleEntry(buildingType, role, { category, consumption });
  const categories = entry?.categories ?? [];
  if (entry?.totalKey) return entry.totalKey;
  if (categories.length <= 1) return categories[0] ?? 'total';
  throw new Error(
    `[ResourceRolePolicy] "${buildingType}" role "${role}" spans multiple categories (${categories.join(', ')}) but declares no totalKey`
  );
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {string} [category] Disambiguates when this role appears more than once.
 * @param {'quantity' | 'flag'} [consumption] Disambiguates by consumption mode.
 * @returns {{ periods: number } | undefined} How many periods of its own demand
 *   this role wants to hold, or undefined when it holds no target (takes whatever it is given).
 */
export function getStockTargetForRole(buildingType, role, category, consumption) {
  return findRoleEntry(buildingType, role, { category, consumption })?.stockTarget;
}

/**
 * What a consumer eats in one period: inhabitants × the per-capita `amount` of its
 * 'quantity' consumer role. The single formula behind both the meal (ConsumeResource)
 * and the deficit a distributor fills (`computeConsumerDeficit`).
 *
 * @param {{ type: string, pop?: number }} building
 * @param {string} [category] Any good the need covers, to pick which of the building's needs (default: its primary one).
 * @returns {number}
 */
export function computeConsumerDemand(building, category) {
  const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
  const perCapita = getAmountForRole(building.type, 'consumer', category, 'quantity') ?? 0;
  return pop * perCapita;
}

/**
 * Units a consumer can still receive to reach the stock it wants to hold
 * (`stockTarget.periods` × its demand, minus what it already holds). Infinity when
 * its role declares no target — such a consumer takes whatever it is offered.
 *
 * @param {{ type: string, pop?: number, stocks?: Record<string, number> }} building
 * @returns {number}
 */
export function computeConsumerDeficit(building, category) {
  const target = getStockTargetForRole(building.type, 'consumer', category, 'quantity');
  if (!target) return Infinity;
  const totalKey = getTotalKeyForRole(building.type, 'consumer', category, 'quantity');
  const held = Math.max(0, building.stocks?.[totalKey] ?? 0);
  return Math.max(0, Math.ceil(computeConsumerDemand(building, category) * target.periods) - held);
}
