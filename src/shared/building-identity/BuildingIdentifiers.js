/**
 * Building identifier primitives — Shared Kernel, transverse to every
 * bounded context. Three tightly-coupled concepts in one file (grid
 * coordinate → display label → instance UUID), not three: BuildingId
 * already depends on TileCoord, and all three are re-exported together as
 * one surface by index.js.
 */

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

// --- TileCoord: an integer grid coordinate ---------------------------------

export function createTileCoord(x, y) {
  const tileX = toGridInteger(x);
  const tileY = toGridInteger(y);
  if (tileX === null || tileY === null) {
    throw new Error(`TileCoord: invalid coordinates (${x}, ${y})`);
  }
  return Object.freeze({ x: tileX, y: tileY });
}

/** @returns {{ x: number, y: number } | null} */
export function tryCreateTileCoord(x, y) {
  try {
    return createTileCoord(x, y);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function toGridInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

// --- BuildingId: display label "{type}-{x}-{y}" (UI / logs only) ----------

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

// --- BuildingInstanceId: stable UUID, immutable for the building's life ---

/** @typedef {string} BuildingInstanceId */

/** @returns {BuildingInstanceId} */
export function createBuildingInstanceId() {
  return uuidv4();
}

/** @param {unknown} value @returns {value is BuildingInstanceId} */
export function isBuildingInstanceId(value) {
  return typeof value === 'string' && validateUuid(value);
}

/**
 * @param {unknown} value
 * @returns {BuildingInstanceId}
 */
export function assertBuildingInstanceId(value) {
  if (!isBuildingInstanceId(value)) {
    throw new Error(`BuildingInstanceId: invalid "${value}"`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {BuildingInstanceId | null}
 */
export function tryBuildingInstanceId(value) {
  return isBuildingInstanceId(value) ? value : null;
}

/** @param {BuildingInstanceId} id @returns {string} */
export function formatInstanceIdForLog(id) {
  return `#${String(id).slice(0, 8)}`;
}
