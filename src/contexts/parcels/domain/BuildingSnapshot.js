import { fromLegacyNeighbor } from './value-objects/Neighbor.js';
import {
  tryParseBuildingId,
  tryCreateBuildingId,
} from './value-objects/BuildingId.js';
import { tryCreateTileCoord } from './value-objects/TileCoord.js';

/**
 * Lecture immuable d'un bâtiment pour les use cases Parcels.
 *
 * - `id` : Published Language (string IndexedDB)
 * - `buildingId` : VO BuildingId si parseable
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
    !parsed && type
      ? tryCreateBuildingId(type, x, y)
      : null;
  const buildingId = parsed ?? fromCoords;

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
    id: buildingId?.value ?? id,
    buildingId: buildingId ?? null,
    tile,
    type: resolvedType,
    neighbors: Object.freeze(normalizedNeighbors),
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    x: tile?.x ?? null,
    y: tile?.y ?? null,
  });
}
