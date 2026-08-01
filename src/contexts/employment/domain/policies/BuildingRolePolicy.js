/**
 * Classify buildings for employment roles.
 */

/** @param {string} type */
export function isFarmType(type) {
  const t = type || '';
  return t.includes('Farm') || t.includes('farm');
}

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
 * Building has road access (Parcels truth persisted as roadCount).
 * @param {{ roadCount?: number }} building
 */
export function hasRoadAccess(building) {
  return (building?.roadCount || 0) > 0;
}

/**
 * Workplace eligible for hiring / employment aggregates.
 * Farms employ without road access; other workplaces require roadCount > 0.
 *
 * @param {{ type?: string, workerNeed?: number, roadCount?: number }} building
 */
export function isEligibleWorkplace(building) {
  if (!isWorkplace(building)) return false;
  if (isFarmType(building.type)) return true;
  return hasRoadAccess(building);
}
