import { v4 as uuidv4, validate as validateUuid } from 'uuid';

/**
 * Stable building instance identifier (immutable for the life of the building).
 *
 * @typedef {string} BuildingInstanceId
 */

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
