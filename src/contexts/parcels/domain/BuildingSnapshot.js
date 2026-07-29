import { fromLegacyNeighbor } from './value-objects/Neighbor.js';
import {
  tryParseBuildingId,
  tryCreateBuildingId,
} from './value-objects/BuildingId.js';
import { tryCreateTileCoord } from './value-objects/TileCoord.js';
import { isBuildingInstanceId } from '../../../shared/building-identity/BuildingInstanceId.js';

/**
 * Lecture immuable d'un bâtiment pour les use cases Parcels.
 *
 * - `id` : Dexie PK (`instanceId` UUID) or legacy Published Language (`"{type}-{x}-{y}"`)
 * - `buildingId` : VO BuildingId (display / tile) when derivable from type + coords
 * - `tile` : TileCoord
 * - `neighbors` : Neighbor[] (domaine Parcels)
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

  const parsed = tryParseBuildingId(id);
  const fromCoords =
    !parsed && type ? tryCreateBuildingId(type, x, y) : null;
  const buildingId = parsed ?? fromCoords;

  // UUID instanceId is the Dexie PK — do not replace with type-x-y display label
  const persistedId = isBuildingInstanceId(id)
    ? id
    : (buildingId?.value ?? id);

  const resolvedType =
    (typeof type === 'string' && type.length > 0 ? type : null) ||
    buildingId?.type ||
    '';

  const tile =
    buildingId != null
      ? tryCreateTileCoord(buildingId.x, buildingId.y)
      : tryCreateTileCoord(x, y);

  const normalizedNeighbors = (neighbors || [])
    .filter((neighbor) => neighbor && typeof neighbor === 'object')
    .map(fromLegacyNeighbor);

  return Object.freeze({
    id: persistedId,
    buildingId: buildingId ?? null,
    tile,
    type: resolvedType,
    neighbors: Object.freeze(normalizedNeighbors),
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    x: tile?.x ?? null,
    y: tile?.y ?? null,
  });
}
