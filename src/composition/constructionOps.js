/**
 * Composition ops — migrated from facades/construction.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
 */

import {
  createConstructionContext,
  getOrCreateConstructionContext,
} from './createConstructionContext.js';

export { createConstructionContext, getOrCreateConstructionContext };

/**
 * @param {{ x: number, y: number }} params
 * @returns {Promise<{ instanceId: string, type: string, x: number | null, y: number | null } | null>}
 */
export async function findBuildingAtTile({ x, y }) {
  return getOrCreateConstructionContext().findBuildingAtTile({ x, y });
}

/**
 * Persist a new building row after construction expense.
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function placeBuildingWithPayment(data) {
  return getOrCreateConstructionContext().placeBuildingWithPayment(data);
}

/**
 * Player click placement: footprint + pay + stamp city tiles.
 *
 * @param {{ city: object, x: number, y: number, buildingType: string, gameTurn: number }} params
 * @returns {Promise<object>}
 */
export async function placeBuildingAtTile(params) {
  return getOrCreateConstructionContext().placeBuildingAtTile(params);
}

/**
 * Player bulldoze: clear footprint + Dexie remove via Parcels.
 *
 * @param {{ city: object, x: number, y: number, meshInstanceId?: string | null }} params
 * @returns {Promise<object>}
 */
export async function bulldozeBuildingAtTile(params) {
  return getOrCreateConstructionContext().bulldozeBuildingAtTile(params);
}

/**
 * Remove ghost Dexie rows on visually empty tiles before player placement.
 *
 * @param {{ city: object, x: number, y: number, gridSize?: number }} params
 * @returns {Promise<string[]>} reclaimed instanceIds
 */
export async function reclaimStaleBuildingRecordsForPlacement(params) {
  return getOrCreateConstructionContext().reclaimStaleBuildingRecordsForPlacement(params);
}

/** Persist row without budget debit (nature spawns, admin). */
export async function placeBuildingRecord(data) {
  return getOrCreateConstructionContext().placeBuildingRecord(data);
}

/** @param {string} instanceId */
export async function getBuildingById(instanceId) {
  return getOrCreateConstructionContext().getBuildingById(instanceId);
}

/** @param {string} instanceId @param {Record<string, unknown>} fields */
export async function updateBuildingFields(instanceId, fields) {
  return getOrCreateConstructionContext().updateBuildingFields(instanceId, fields);
}

/**
 * @param {string} instanceId
 * @param {string} key
 */
export async function getBuildingField(instanceId, key) {
  return getOrCreateConstructionContext().getBuildingField(instanceId, key);
}

/**
 * @param {{ instanceId: string, field: string, increment: number, condition?: { limit: number } | false }} params
 */
export async function incrementBuildingField(params) {
  return getOrCreateConstructionContext().incrementBuildingField(params);
}

/** All building rows (orphan detection, events). */
export async function listAllBuildingRows() {
  return getOrCreateConstructionContext().listAllBuildingRows();
}

/** Hard delete — use `syncRemovedBuilding` from Parcels when neighbor refresh is needed. */
export async function removeBuildingRecord(instanceId) {
  return getOrCreateConstructionContext().removeBuildingRecord(instanceId);
}

/**
 * Bind live Three.js grid for scene building inventory (turn-budget maintenance input).
 *
 * @param {{ city: { size: number }, buildings: object[][] }} ctx
 */
export function bindSceneBuildingGrid(ctx) {
  getOrCreateConstructionContext().bindSceneBuildingGrid(ctx);
}

/** @returns {string[]} */
export function listSceneBuildingTypes() {
  return getOrCreateConstructionContext().listSceneBuildingTypes();
}
