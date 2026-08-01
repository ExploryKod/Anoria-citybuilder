import db from '../../src/core/persistence/dexie/db.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

export async function clearBuildingsTable() {
  await db.open();
  await db.houses.clear();
}

/**
 * Insert a canonical building row (tests only — no budget debit).
 *
 * @param {object} data — full record or `{ type, x, y, instanceId?, extra? }`
 * @returns {Promise<{ success: boolean, instanceId: string, reason?: string, error?: string }>}
 */
export async function seedBuilding(data) {
  const record = data.instanceId ? data : makeHouseRecord(data);
  const instanceId = record.instanceId;

  try {
    const existing = await db.houses.get(instanceId);
    if (existing) {
      return {
        success: false,
        instanceId,
        reason: 'duplicate',
        error: 'Key already exists in the object store.',
      };
    }

    await db.houses.add(canonicalizeHouseRecord(record));
    return { success: true, instanceId };
  } catch (err) {
    if (err.name === 'ConstraintError' || err.message?.includes('Key already exists')) {
      return {
        success: false,
        instanceId,
        reason: 'duplicate',
        error: 'Key already exists in the object store.',
      };
    }
    throw err;
  }
}

/** @param {string} instanceId */
export async function getBuildingRow(instanceId) {
  return db.houses.get(instanceId);
}
