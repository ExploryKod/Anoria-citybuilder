/**
 * ACL Construction — placement orchestration from legacy `src/js/`.
 *
 * Spatial neighbors / road access: Parcels BC after mesh sync.
 * Payment: acl/budget.js → Accounting BC.
 */

import {
  createConstructionContext,
  getOrCreateConstructionContext,
} from '../../composition/createConstructionContext.js';

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
  const row = await getBuildingById(instanceId);
  if (row && key in row) {
    return row[key];
  }

  const defaults = {
    stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
    neighbors: [],
    pop: 0,
    roads: 0,
    worldTime: 0,
  };

  if (defaults[key] !== undefined) {
    return defaults[key];
  }

  return false;
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
