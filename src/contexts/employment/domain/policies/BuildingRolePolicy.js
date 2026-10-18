import { isRoadType as isRoadTypeInCatalog } from '../../../../shared/building-catalog/roadQueries.js';
import { isRoadNeedMet } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/index.js';

/**
 * Classify buildings for employment roles.
 */

/**
 * A house is what the catalog declares `residentialGroup` on (see BuildingKind.js), never a name guess: a
 * building whose type merely contains "house" as a substring (TradeWarehouse, Warehouse — "ware**house**")
 * is not one, and used to be misread as one here, which zeroed its catalog worker need (see
 * BuildingEmploymentDefaults.js) and excluded it from `isWorkplace` below.
 * @param {string} type
 * @returns {boolean}
 */
export function isHouseType(type) {
  return resolveBuildingKind(type) === BUILDING_KIND_HOUSE;
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isRoadType(type) {
  return isRoadTypeInCatalog(type);
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
