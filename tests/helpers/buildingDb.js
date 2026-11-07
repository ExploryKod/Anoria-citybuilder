import db from '../../src/core/persistence/dexie/db.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { drawArrivingCitizen } from '../../src/shared/citizens/Citizen.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';
import { inTestHamlet } from './testHamlet.js';

/**
 * Give a house `count` residents (tests only): the residents of a house are its citizens, there is no count to set on the row.
 * @param {string} houseId @param {string} hamletId @param {number} count
 */
export async function seedResidents(houseId, hamletId, count) {
  if (!(count > 0)) return;
  const arrivals = Array.from({ length: count }, () => drawArrivingCitizen({ houseId, hamletId, turn: 0, random: Math.random, newId: () => crypto.randomUUID() }));
  await db.citizens.bulkAdd(arrivals.map((citizen) => ({ ...citizen })));
}

export async function clearBuildingsTable() {
  await db.open();
  await db.houses.clear();
  await db.citizens.clear();
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

    // A house carries no count of residents: they are its citizens. A record that says `pop: n` gets its n citizens.
    const row = canonicalizeHouseRecord(inTestHamlet(record));
    await db.transaction('rw', db.houses, db.citizens, async () => {
      await db.houses.add(row);
      await seedResidents(instanceId, row.hamletId, record.pop ?? 0);
    });
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
