import { createTileCoord, tryCreateTileCoord } from './TileCoord.js';

/**
 * Identifiant métier d'un bâtiment : "{type}-{x}-{y}"
 *
 * **Shared Kernel** — Published Language transverse (Parcels, Supply, Employment, Dexie).
 * La string `.value` / `toPublishedBuildingId()` est la source de vérité unique.
 */

export function createBuildingId(type, x, y) {
  if (!type || typeof type !== 'string' || type.length === 0) {
    throw new Error(`BuildingId: invalid type "${type}"`);
  }
  const tile = createTileCoord(x, y);
  return Object.freeze({
    type,
    x: tile.x,
    y: tile.y,
    value: `${type}-${tile.x}-${tile.y}`,
  });
}

/** @returns {Readonly<{ type: string, x: number, y: number, value: string }> | null} */
export function tryCreateBuildingId(type, x, y) {
  try {
    return createBuildingId(type, x, y);
  } catch {
    return null;
  }
}

/** @returns {string | null} */
export function toBuildingIdString(type, x, y) {
  return tryCreateBuildingId(type, x, y)?.value ?? null;
}

/**
 * @param {string | Readonly<{ value: string }> | null | undefined} buildingId
 * @returns {string}
 */
export function toPublishedBuildingId(buildingId) {
  if (typeof buildingId === 'string' && buildingId.length > 0) {
    return buildingId;
  }
  if (buildingId && typeof buildingId.value === 'string' && buildingId.value.length > 0) {
    return buildingId.value;
  }
  throw new Error(`BuildingId: cannot publish "${buildingId}"`);
}

export function parseBuildingId(value) {
  if (!value || typeof value !== 'string') {
    throw new Error(`BuildingId: invalid value "${value}"`);
  }
  const parts = value.split('-');
  if (parts.length < 3) {
    throw new Error(`BuildingId: cannot parse "${value}"`);
  }
  const y = Number(parts.pop());
  const x = Number(parts.pop());
  const type = parts.join('-');
  return createBuildingId(type, x, y);
}

/** @returns {Readonly<{ type: string, x: number, y: number, value: string }> | null} */
export function tryParseBuildingId(value) {
  try {
    return parseBuildingId(value);
  } catch {
    return null;
  }
}

/** @param {unknown} value */
export function isPublishedBuildingIdString(value) {
  return typeof value === 'string' && value.length > 0 && tryParseBuildingId(value) !== null;
}

/**
 * Resolve Published Language id from a Dexie row, neighbor blob, or legacy ref.
 *
 * Priority: `id` → `buildingId` → published `name` → `{type}-{x}-{y}` → bare `name`.
 */
export function resolvePublishedBuildingIdFromRef(ref) {
  if (!ref || typeof ref !== 'object') return null;

  if (typeof ref.id === 'string' && ref.id.length > 0) {
    return ref.id;
  }

  if (typeof ref.buildingId === 'string' && ref.buildingId.length > 0) {
    return ref.buildingId;
  }

  if (typeof ref.name === 'string' && isPublishedBuildingIdString(ref.name)) {
    return ref.name;
  }

  const type =
    (typeof ref.type === 'string' && ref.type.length > 0 && ref.type) ||
    (typeof ref.name === 'string' && ref.name.length > 0 && !isPublishedBuildingIdString(ref.name) && ref.name) ||
    null;

  if (type && ref.x != null && ref.y != null) {
    const x = Number(ref.x);
    const y = Number(ref.y);
    if (Number.isInteger(x) && Number.isInteger(y)) {
      return toBuildingIdString(type, x, y);
    }
  }

  if (typeof ref.name === 'string' && ref.name.length > 0) {
    return ref.name;
  }

  return null;
}

export { tryCreateTileCoord };
