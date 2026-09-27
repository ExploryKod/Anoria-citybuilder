import { createRoadAccess } from '../value-objects/RoadAccess.js';
import { resolveFootprint } from '../../../../shared/asset-footprint/resolveFootprint.js';
import { getRoadRange } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Calcule l'accès routier à partir des voisins.
 * Règle métier : roadCount = nombre de voisins route ; hasAccess = roadCount > 0.
 *
 * @param {ReadonlyArray<{ isRoad: boolean }>} neighbors
 * @returns {Readonly<{ roadCount: number, hasAccess: boolean }>}
 */
export function evaluateRoadAccess(neighbors) {
  if (!neighbors || !Array.isArray(neighbors)) {
    return createRoadAccess(0);
  }

  const roadCount = neighbors.filter((neighbor) => neighbor.isRoad).length;
  return createRoadAccess(roadCount);
}

/**
 * The tiles a building covers: its footprint from its origin tile (the minimum corner), swapped on an odd
 * rotation. A type with no declared footprint is an error (`resolveFootprint` throws): it is never
 * guessed to be one tile.
 *
 * @param {{ type: string, x: number, y: number, rotationStep?: number }} building
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function footprintRect(building) {
  let { width, depth } = resolveFootprint(building.type);
  if ((building.rotationStep ?? 0) % 2 === 1) [width, depth] = [depth, width];
  return { minX: building.x, minY: building.y, maxX: building.x + width - 1, maxY: building.y + depth - 1 };
}

/**
 * Road access by distance: `roadCount` is how many road tiles lie within the building's road range
 * (catalog `roadRange`) in Manhattan tiles, measured from ANY tile of its footprint — not from its
 * origin tile, and not from where its mesh happens to be centred. `hasAccess` = at least one.
 *
 * @param {{ type: string, x: number | null, y: number | null, rotationStep?: number }} building
 * @param {ReadonlyArray<{ x: number, y: number }>} roadTiles
 * @returns {Readonly<{ roadCount: number, hasAccess: boolean }>}
 */
export function evaluateRoadAccessByRange(building, roadTiles) {
  if (!Number.isFinite(building?.x) || !Number.isFinite(building?.y)) {
    return createRoadAccess(0);
  }
  const range = getRoadRange(building.type);
  const { minX, minY, maxX, maxY } = footprintRect(building);

  let roadCount = 0;
  for (const road of roadTiles) {
    const dx = Math.max(minX - road.x, 0, road.x - maxX);
    const dy = Math.max(minY - road.y, 0, road.y - maxY);
    const distance = dx + dy;
    // Distance 0 is the building's own tile (a road piece counting itself), not a road beside it.
    if (distance >= 1 && distance <= range) roadCount += 1;
  }
  return createRoadAccess(roadCount);
}
