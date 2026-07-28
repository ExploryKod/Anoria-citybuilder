import { createRoadAccess } from '../value-objects/RoadAccess.js';

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
