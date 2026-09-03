import { hasResourceRole } from './ResourceRolePolicy.js';

/**
 * Manhattan distance in tiles.
 */
export function manhattanDistance(a, b) {
  if (a?.x == null || a?.y == null || b?.x == null || b?.y == null) {
    return Infinity;
  }
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {number} maxDistance
 */
export function isWithinRange(a, b, maxDistance) {
  return manhattanDistance(a, b) <= maxDistance;
}

/**
 * Buildings holding a given resource role (optionally for one category),
 * within Manhattan range of an origin point and with road access.
 * Resource-agnostic and role-agnostic — replaces the old market/farm/house
 * name-matching helpers (isFarmNeighborRef, isMarketNeighborRef, ...),
 * which read the building's own type string instead of its catalog role.
 *
 * @param {{ x?: number, y?: number }} origin
 * @param {object[]} buildings
 * @param {object} params
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} params.role
 * @param {string} [params.category]
 * @param {number} params.maxDistance
 * @returns {object[]}
 */
export function findBuildingsWithRoleInRange(origin, buildings, { role, category, maxDistance }) {
  if (!origin || origin.x == null || origin.y == null) {
    return [];
  }

  return buildings.filter((building) => {
    if (!hasResourceRole(building.type, role, category)) return false;
    if (building.x == null || building.y == null) return false;
    if (!isWithinRange(origin, { x: building.x, y: building.y }, maxDistance)) return false;
    const roadCount = building.roads ?? building.roadCount ?? 0;
    return roadCount > 0;
  });
}
