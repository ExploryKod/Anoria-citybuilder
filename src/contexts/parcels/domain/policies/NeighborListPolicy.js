import {
  fromLegacyNeighbor,
  toLegacyNeighborRecord,
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
    .filter((neighbor) => neighbor && typeof neighbor === 'object')
    .map(fromLegacyNeighbor);
}

/**
 * Neighbor[] → forme persistée IndexedDB (sans stocks / deltas).
 * @param {unknown} neighbors
 */
export function toPersistedNeighborList(neighbors) {
  return normalizeNeighborList(neighbors).map(toLegacyNeighborRecord);
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
