import { tryCreateBuildingId } from './value-objects/BuildingId.js';
import { tryCreateTileCoord } from './value-objects/TileCoord.js';
import { assertBuildingInstanceId } from '../../../shared/building-identity/BuildingIdentifiers.js';

/**
 * Lecture immuable d'un bâtiment pour les use cases Parcels.
 *
 * - `id` : Dexie PK (`instanceId` UUID)
 * - `buildingId` : VO display `{type}-{x}-{y}` when derivable (UI only)
 * - `tile` : TileCoord
 */
export function createBuildingSnapshot({
  id,
  type,
  roadCount = 0,
  x = null,
  y = null,
  rotationStep = 0,
}) {
  if (!id || typeof id !== 'string') {
    throw new Error('BuildingSnapshot: id is required');
  }

  const persistedId = assertBuildingInstanceId(id);
  const buildingId =
    typeof type === 'string' && type.length > 0
      ? tryCreateBuildingId(type, x, y)
      : null;

  const resolvedType =
    (typeof type === 'string' && type.length > 0 ? type : null) ||
    buildingId?.type ||
    '';

  const tile =
    buildingId != null
      ? tryCreateTileCoord(buildingId.x, buildingId.y)
      : tryCreateTileCoord(x, y);

  return Object.freeze({
    id: persistedId,
    buildingId: buildingId ?? null,
    tile,
    type: resolvedType,
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    x: tile?.x ?? null,
    y: tile?.y ?? null,
    rotationStep: Number.isInteger(rotationStep) ? rotationStep : 0,
  });
}
