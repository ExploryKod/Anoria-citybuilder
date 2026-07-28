import { createTileCoord, tryCreateTileCoord } from './TileCoord.js';

/**
 * Identifiant métier d'un bâtiment : "{type}-{x}-{y}"
 * Published Language entre BC / IndexedDB : la string `.value`
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

/**
 * Forme string pour IndexedDB / legacy.
 * @returns {string | null}
 */
export function toBuildingIdString(type, x, y) {
  return tryCreateBuildingId(type, x, y)?.value ?? null;
}

/**
 * Normalise VO ou string vers Published Language.
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

export { tryCreateTileCoord };
