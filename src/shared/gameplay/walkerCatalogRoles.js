/**
 * Reads the `walker` fact from buildingCatalog.js — the only place that
 * knows which building ids are walker origins or destinations. Adding a
 * new walker-capable building is a catalog edit; nothing here changes.
 */
import { getBuildingDefinition } from '../building-catalog/buildingCatalog.js';

/**
 * @param {string} buildingId
 * @returns {'origin' | 'destination' | undefined}
 */
export function getWalkerRole(buildingId) {
  return getBuildingDefinition(buildingId)?.walker?.role;
}

/** @param {string} buildingId */
export function isWalkerOrigin(buildingId) {
  return getWalkerRole(buildingId) === 'origin';
}

/** @param {string} buildingId */
export function isWalkerDestination(buildingId) {
  return getWalkerRole(buildingId) === 'destination';
}

/**
 * Whether a walker origin/destination must have road access. Defaults to
 * true when the fact is omitted (the common case — see buildingCatalog.js).
 *
 * @param {string} buildingId
 */
export function walkerRequiresRoad(buildingId) {
  return getBuildingDefinition(buildingId)?.walker?.requiresRoad !== false;
}
