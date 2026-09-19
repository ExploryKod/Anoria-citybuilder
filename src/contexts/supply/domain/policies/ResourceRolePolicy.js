import { buildingCatalog, getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

/**
 * Supply's derivation point for `resourceRoles` (see buildingCatalog.js) —
 * which resource categories a building type produces, collects, holds,
 * distributes, or consumes, and at what range. Building selection (which
 * type counts as a "farm" or "market" for a given step) reads this instead
 * of matching on the type's name string.
 */

/**
 * @param {string} buildingType
 * @returns {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts[]}
 */
export function getResourceRoles(buildingType) {
  return getBuildingDefinition(buildingType)?.resourceRoles ?? [];
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
 *   (unbounded/not applicable) when the catalog doesn't declare one.
 */
export function getRangeForRole(buildingType, role, category) {
  return findRoleEntry(buildingType, role, { category })?.range;
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
 * Every distinct category any building declares for a given role, derived
 * from the whole catalog — e.g. "a crop" is just "whatever some building
 * declares as a 'producer' category," not a hand-maintained list that can
 * drift from what farms actually produce.
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
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
 * The one stock shape shared by every building row today: every category any
 * building declares for a role that actually holds its own persistent
 * quantity stock — 'producer' (a farm's own harvest, a pottery workshop's
 * own output), 'collector'/'hub' (a windmill's pooled stock), and
 * 'consumer' in 'quantity' mode (a house's food demand). Categories/totalKey
 * are still a catalog fact, not a hand list — see buildingEconomy.js. A
 * 'distributor' role is excluded on purpose: 'quantity' mode pulls from a
 * linked hub rather than holding its own stock (see hubLink/allocatedStocks
 * on the hub side), and 'flag' mode (a service coverage need) carries no
 * stock at all — see DistributeResourceToConsumers.js.
 *
 * `totalKey` stays a single shared value because only ONE quantity good
 * (food) declares one today — a second independent good (e.g. pottery)
 * that only needs its own categories preserved, not an aggregate total,
 * works fine without one (see plate/pot/amphora in buildingEconomy.js,
 * each its own single-category role with no totalKey). If a second good
 * ever needs its OWN aggregate total (a pottery-collecting kiln/hub), this
 * function would need to return a totalKey PER good rather than one global
 * value — not needed yet.
 * @returns {{ categories: ReadonlyArray<string>, totalKey: string }}
 */
export function getResourceStockShape() {
  const categories = new Set();
  let totalKey;
  const STOCK_BEARING_ROLES = new Set(['producer', 'collector', 'hub']);
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      const isQuantityConsumer = entry.role === 'consumer' && (entry.consumption ?? 'quantity') === 'quantity';
      if (!STOCK_BEARING_ROLES.has(entry.role) && !isQuantityConsumer) continue;
      for (const category of entry.categories) categories.add(category);
      if (entry.totalKey) totalKey = entry.totalKey;
    }
  }
  return { categories: Object.freeze([...categories]), totalKey: totalKey ?? 'total' };
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
export function getHubLinkForRole(buildingType, role) {
  return findRoleEntry(buildingType, role)?.hubLink;
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
 * a house consuming wheat/carrot/cabbage/fruit/game under one 'food' total)
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
