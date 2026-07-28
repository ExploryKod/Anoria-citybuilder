import { fromLegacyNeighbor } from './value-objects/NeighborRef.js';

/**
 * Lecture immuable d'un bâtiment pour les use cases Urban.
 * Ce n'est pas l'aggregate root complet — snapshot pour recalcul d'accès routier.
 */
export function createBuildingSnapshot({
  id,
  type,
  neighbors = [],
  roadCount = 0,
  x = null,
  y = null,
}) {
  if (!id || typeof id !== 'string') {
    throw new Error('BuildingSnapshot: id is required');
  }

  const normalizedNeighbors = neighbors.map((neighbor) =>
    neighbor.isRoad !== undefined ? neighbor : fromLegacyNeighbor(neighbor)
  );

  return Object.freeze({
    id,
    type: type || '',
    neighbors: Object.freeze(normalizedNeighbors),
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    x,
    y,
  });
}
