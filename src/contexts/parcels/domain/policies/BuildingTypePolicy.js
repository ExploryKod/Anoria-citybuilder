import { requiresRoad } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Règles liées au type de bâtiment dans le contexte Urban.
 */
export function needsRoadAccess(buildingType) {
  if (!buildingType || typeof buildingType !== 'string') {
    return false;
  }
  return !buildingType.includes('roads') && !buildingType.includes('Road');
}

/**
 * A road access seen through the building's road need. The measured road count
 * is kept as is; `hasAccess` reads "the need is met", so a type the catalog
 * declares `requiresRoad: false` always has access and is never flagged for
 * lacking a road.
 * @param {string} buildingType
 * @param {Readonly<{ roadCount: number, hasAccess: boolean }>} roadAccess
 */
export function withRoadNeed(buildingType, roadAccess) {
  return requiresRoad(buildingType) ? roadAccess : Object.freeze({ ...roadAccess, hasAccess: true });
}
