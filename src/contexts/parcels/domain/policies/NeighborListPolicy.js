import {
  normalizeNeighborFromRef,
  toPersistedNeighborRecord,
} from '../value-objects/Neighbor.js';

/**
 * Liste de voisins → Neighbor[] (domaine Parcels).
 * @param {unknown} neighbors
 */
export function normalizeNeighborList(neighbors) {
  if (!neighbors || !Array.isArray(neighbors)) {
    return [];
  }
  return neighbors
    .map(normalizeNeighborFromRef)
    .filter((neighbor) => neighbor.instanceId.length > 0);
}

/**
 * Neighbor[] → forme persistée IndexedDB (UUID + type + tuile).
 * @param {unknown} neighbors
 */
export function toPersistedNeighborList(neighbors) {
  return normalizeNeighborList(neighbors)
    .map(toPersistedNeighborRecord)
    .filter(Boolean);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function neighborListsEqual(a, b) {
  const left = toPersistedNeighborList(a);
  const right = toPersistedNeighborList(b);
  if (left.length !== right.length) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
