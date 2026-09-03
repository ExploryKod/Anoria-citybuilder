import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

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
 * @param {string} [category] When given, also require this role to cover the category.
 * @returns {boolean}
 */
export function hasResourceRole(buildingType, role, category) {
  return getResourceRoles(buildingType).some(
    (entry) => entry.role === role && (!category || entry.categories.includes(category))
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
