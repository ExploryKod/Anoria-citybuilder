import { isRoadNeedMet } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Classify buildings for employment roles.
 */

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isHouseType(type) {
  const t = type || '';
  return t.includes('House') || t.includes('house');
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isRoadType(type) {
  const t = type || '';
  return t === 'roads' || t.includes('Road');
}

/**
 * Labor source = house (provides workers from population).
 * @param {{ type?: string }} building
 */
export function isLaborSource(building) {
  return isHouseType(building?.type);
}

/**
 * Workplace = non-house, non-road building that can employ workers.
 * @param {{ type?: string, workerNeed?: number }} building
 */
export function isWorkplace(building) {
  if (!building) return false;
  if (isHouseType(building.type) || isRoadType(building.type)) return false;
  return (building.workerNeed || 0) > 0;
}

/**
 * The building's road need is met: it has a road (Parcels truth persisted as
 * roadCount), or its type needs none — the catalog's `requiresRoad`.
 * @param {{ type?: string, roadCount?: number }} building
 */
export function hasRoadAccess(building) {
  return isRoadNeedMet(building?.type, building?.roadCount);
}

/**
 * Workplace eligible for hiring / employment aggregates: its road need is met
 * (a type the catalog declares `requiresRoad: false` employs without a road).
 *
 * @param {{ type?: string, workerNeed?: number, roadCount?: number }} building
 */
export function isEligibleWorkplace(building) {
  return isWorkplace(building) && hasRoadAccess(building);
}
