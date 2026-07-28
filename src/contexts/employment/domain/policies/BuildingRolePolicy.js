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
 * Building has road access (Parcels truth persisted as roadCount).
 * @param {{ roadCount?: number }} building
 */
export function hasRoadAccess(building) {
  return (building?.roadCount || 0) > 0;
}
