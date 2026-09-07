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
 * @returns {string[]} Categories declared for this role, or [] if the building doesn't hold it.
 */
export function getCategoriesForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.categories ?? [];
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {number | undefined} Manhattan range for that role, or undefined
 *   (unbounded/not applicable) when the catalog doesn't declare one.
 */
export function getRangeForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.range;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {number | undefined} Max linked distributors for that role (only
 *   meaningful for 'hub'), or undefined when the catalog doesn't declare one.
 */
export function getLinkCapacityForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.linkCapacity;
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
 * building declares as a 'consumer' category, aggregated under the totalKey
 * those entries declare (categories/totalKey are still a catalog fact, not a
 * hand list — see buildingEconomy.js). A second, independently-tracked
 * resource would need its own totalKey partition here; not needed yet.
 * @returns {{ categories: ReadonlyArray<string>, totalKey: string }}
 */
export function getResourceStockShape() {
  const categories = new Set();
  let totalKey;
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.role !== 'consumer') continue;
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
 * @returns {{ field: string, unit: 'year' | 'month' } | undefined} Once-per-period
 *   lock field/unit for this role, or undefined when the role doesn't lock
 *   (e.g. a distributor with no schedule). See PeriodLockPolicy.js.
 */
export function getPeriodLockForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.periodLock;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {{ sourceLinkField?: string, linksField?: string, linkTargetIdField?: string, allocationField?: string } | undefined}
 *   Hub-link storage field names for this role, or undefined when the role
 *   doesn't participate in a hub link. See TransferHubToHub.js.
 */
export function getHubLinkForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.hubLink;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {{ unit: string } | undefined} When this role only fires on a
 *   schedule (see ResourceSchedulePolicy.js) — undefined means unconditional.
 */
export function getScheduleForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.schedule;
}

/**
 * @param {string} buildingType
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @returns {number | undefined} Units this role produces/moves per scheduled
 *   occurrence (e.g. a farm's annual yield), or undefined when not applicable.
 */
export function getAmountForRole(buildingType, role) {
  return getResourceRoles(buildingType).find((entry) => entry.role === role)?.amount;
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
 * @returns {string} The resolved total key.
 * @throws {Error} When more than one category is declared and no `totalKey` is set.
 */
export function getTotalKeyForRole(buildingType, role) {
  const entry = getResourceRoles(buildingType).find((e) => e.role === role);
  const categories = entry?.categories ?? [];
  if (entry?.totalKey) return entry.totalKey;
  if (categories.length <= 1) return categories[0] ?? 'total';
  throw new Error(
    `[ResourceRolePolicy] "${buildingType}" role "${role}" spans multiple categories (${categories.join(', ')}) but declares no totalKey`
  );
}
