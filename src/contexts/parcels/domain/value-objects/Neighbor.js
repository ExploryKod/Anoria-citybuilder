import { tryCreateTileCoord } from './TileCoord.js';
import { toBuildingIdString } from './BuildingId.js';

/**
 * Voisin sur la grille (domaine Parcels).
 * Champs parcels uniquement — pas de stocks, meshes, ni deltas Three.js.
 */

/**
 * @param {object} [params]
 * @returns {Readonly<{
 *   buildingId: string,
 *   type: string,
 *   tile: Readonly<{ x: number, y: number }> | null,
 *   isRoad: boolean,
 *   zone: number | null,
 * }>}
 */
export function createNeighbor({
  buildingId = '',
  type = '',
  tile = null,
  isRoad = false,
  zone = null,
} = {}) {
  return Object.freeze({
    buildingId: typeof buildingId === 'string' ? buildingId : '',
    type: typeof type === 'string' ? type : '',
    tile: tile ? Object.freeze({ x: tile.x, y: tile.y }) : null,
    isRoad: Boolean(isRoad),
    zone: typeof zone === 'number' && Number.isFinite(zone) ? zone : null,
  });
}

/**
 * Legacy IndexedDB / scan grille → Neighbor Parcels.
 * Ignore stocks, time, deltaX/deltaZ.
 */
export function fromLegacyNeighbor(raw) {
  if (!raw || typeof raw !== 'object') {
    return createNeighbor();
  }

  // Déjà un Neighbor domaine (pas de x plat — la tuile est dans tile)
  if (
    raw.tile !== undefined &&
    typeof raw.buildingId === 'string' &&
    typeof raw.type === 'string' &&
    raw.x === undefined
  ) {
    return createNeighbor({
      buildingId: raw.buildingId,
      type: raw.type,
      tile: raw.tile,
      isRoad: raw.isRoad,
      zone: raw.zone,
    });
  }

  const type = raw.type || raw.name || (raw.buildingId === 'roads' ? 'roads' : '');
  const tile = tryCreateTileCoord(raw.x, raw.y);
  const buildingId =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.buildingId === 'string' && raw.buildingId) ||
    (type && tile ? toBuildingIdString(type, tile.x, tile.y) : '') ||
    type;

  const isRoad = Boolean(
    raw.isRoad ||
    raw.userData?.isRoad ||
    type === 'roads' ||
    type === 'Road' ||
    raw.name === 'roads' ||
    raw.name === 'Road' ||
    raw.buildingId === 'roads'
  );

  return createNeighbor({
    buildingId,
    type,
    tile,
    isRoad,
    zone: raw.zone,
  });
}

/**
 * Neighbor → enregistrement IndexedDB (compat lecteurs legacy Food/UI).
 * `name` reprend `type` pour les filtres existants.
 */
export function toLegacyNeighborRecord(neighbor) {
  const n =
    neighbor?.tile !== undefined && neighbor?.x === undefined
      ? createNeighbor(neighbor)
      : fromLegacyNeighbor(neighbor);

  return {
    id: n.buildingId,
    name: n.type,
    type: n.type,
    x: n.tile?.x ?? null,
    y: n.tile?.y ?? null,
    zone: n.zone,
    isRoad: n.isRoad,
  };
}
