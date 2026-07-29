import { tryCreateTileCoord } from './TileCoord.js';
import {
  isBuildingInstanceId,
  assertBuildingInstanceId,
} from '../../../../shared/building-identity/BuildingInstanceId.js';

/**
 * Voisin sur la grille (domaine Parcels).
 * `instanceId` = UUID Dexie du bâtiment voisin (seule clé de référence).
 * `type` + `tile` = données spatiales / filtres (pas des clés).
 */

/**
 * @param {object} [params]
 * @returns {Readonly<{
 *   instanceId: string,
 *   type: string,
 *   tile: Readonly<{ x: number, y: number }> | null,
 *   isRoad: boolean,
 *   zone: number | null,
 * }>}
 */
export function createNeighbor({
  instanceId = '',
  type = '',
  tile = null,
  isRoad = false,
  zone = null,
} = {}) {
  const id =
    typeof instanceId === 'string' && isBuildingInstanceId(instanceId)
      ? instanceId
      : '';

  return Object.freeze({
    instanceId: id,
    type: typeof type === 'string' ? type : '',
    tile: tile ? Object.freeze({ x: tile.x, y: tile.y }) : null,
    isRoad: Boolean(isRoad),
    zone: typeof zone === 'number' && Number.isFinite(zone) ? zone : null,
  });
}

/**
 * Normalise un blob scan grille / Dexie → Neighbor domaine.
 * Ignore les entrées sans UUID (pas de fallback type-x-y).
 *
 * @param {unknown} raw
 * @returns {import('../../../../shared/building-identity/BuildingInstanceId.js').BuildingInstanceId | null}
 */
export function resolveNeighborInstanceId(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const candidates = [raw.instanceId, raw.id, raw.buildingId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isBuildingInstanceId(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof createNeighbor>}
 */
export function normalizeNeighborFromRef(raw) {
  if (!raw || typeof raw !== 'object') {
    return createNeighbor();
  }

  // Déjà un Neighbor domaine
  if (
    raw.tile !== undefined &&
    typeof raw.instanceId === 'string' &&
    typeof raw.type === 'string' &&
    raw.x === undefined
  ) {
    return createNeighbor({
      instanceId: resolveNeighborInstanceId(raw) ?? raw.instanceId,
      type: raw.type,
      tile: raw.tile,
      isRoad: raw.isRoad,
      zone: raw.zone,
    });
  }

  const instanceId = resolveNeighborInstanceId(raw);
  const type =
    (typeof raw.type === 'string' && raw.type) ||
    (typeof raw.name === 'string' && raw.name && !isBuildingInstanceId(raw.name)
      ? raw.name
      : '') ||
    (raw.buildingId === 'roads' ? 'roads' : '');

  const tile = tryCreateTileCoord(raw.x, raw.y);

  const isRoad = Boolean(
    raw.isRoad ||
    raw.userData?.isRoad ||
    type === 'roads' ||
    type === 'Road' ||
    (type && type.startsWith('StonePath-')) ||
    raw.name === 'roads' ||
    raw.name === 'Road' ||
    (raw.name && raw.name.startsWith('StonePath-')) ||
    raw.buildingId === 'roads'
  );

  return createNeighbor({
    instanceId: instanceId ?? '',
    type,
    tile,
    isRoad,
    zone: raw.zone,
  });
}

/**
 * Neighbor → enregistrement IndexedDB (UUID + champs spatiaux).
 */
export function toPersistedNeighborRecord(neighbor) {
  const n =
    neighbor?.tile !== undefined && neighbor?.x === undefined
      ? createNeighbor(neighbor)
      : normalizeNeighborFromRef(neighbor);

  if (!n.instanceId) {
    return null;
  }

  return {
    instanceId: n.instanceId,
    type: n.type,
    x: n.tile?.x ?? null,
    y: n.tile?.y ?? null,
    zone: n.zone,
    isRoad: n.isRoad,
  };
}

/** @deprecated Use normalizeNeighborFromRef */
export const fromLegacyNeighbor = normalizeNeighborFromRef;

/** @deprecated Use toPersistedNeighborRecord */
export const toLegacyNeighborRecord = toPersistedNeighborRecord;
