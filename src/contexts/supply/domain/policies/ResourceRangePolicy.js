import { hasResourceRole } from './ResourceRolePolicy.js';
import { isRoadNeedMet, getNaturalResourceKind } from '../../../../shared/building-catalog/resourceRoleQueries.js';

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
 * @param {number | ((building: object) => number)} params.maxDistance A flat
 *   range, or a function resolving it per candidate (e.g. that candidate's
 *   own catalog range) — for the caller that scans many candidates whose
 *   range can differ per type, not just one already-resolved distance.
 * @returns {object[]}
 */
export function findBuildingsWithRoleInRange(origin, buildings, { role, category, maxDistance }) {
  if (!origin || origin.x == null || origin.y == null) {
    return [];
  }

  return buildings.filter((building) => {
    if (!hasResourceRole(building.type, role, category)) return false;
    if (building.x == null || building.y == null) return false;
    const distance = typeof maxDistance === 'function' ? maxDistance(building) : maxDistance;
    if (!isWithinRange(origin, { x: building.x, y: building.y }, distance)) return false;
    return isRoadNeedMet(building.type, building.roads ?? building.roadCount ?? 0);
  });
}

/**
 * The natural sources of one resource kind within Manhattan range of a
 * building, nearest first (stable tie-break, so which one gets used up is
 * deterministic). Kind-agnostic: "wood" is only ever a catalog value.
 *
 * @param {{ x?: number, y?: number }} origin
 * @param {Array<{ id: string, type: string, x?: number, y?: number }>} candidates Any placed buildings; the ones that are not this natural resource are ignored.
 * @param {{ resource: string, range: number }} source The producer's `source` catalog fact.
 * @returns {Array<{ id: string, type: string, x: number, y: number }>}
 */
export function findNaturalSourcesInRange(origin, candidates, { resource, range }) {
  if (origin?.x == null || origin?.y == null) return [];
  return candidates
    .filter(
      (c) =>
        c.x != null &&
        c.y != null &&
        getNaturalResourceKind(c.type) === resource &&
        isWithinRange(origin, c, range)
    )
    .sort(
      (a, b) =>
        manhattanDistance(origin, a) - manhattanDistance(origin, b) ||
        a.y - b.y ||
        a.x - b.x ||
        String(a.id).localeCompare(String(b.id))
    );
}
