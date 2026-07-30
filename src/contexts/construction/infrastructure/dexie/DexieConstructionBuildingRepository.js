import db from '../../../../core/persistence/dexie/db.js';
import {
  canonicalizeHouseRecord,
  createBuildingInstanceId,
  footprintFromRecord,
  footprintOccupiesTile,
} from '../../../../shared/building-identity/index.js';

/** Construction adapter — direct Dexie (table `houses`). */
export class DexieConstructionBuildingRepository {
  async findAtTile(x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const rows = await db.houses.toArray();
    return (
      rows.find((row) => {
        const footprint = footprintFromRecord(row);
        return footprint && footprintOccupiesTile(footprint, tileX, tileY);
      }) ?? null
    );
  }

  async findById(instanceId) {
    if (!instanceId) return null;
    return db.houses.get(instanceId);
  }

  /**
   * @param {object} data
   * @returns {Promise<{ success: boolean, instanceId?: string, error?: string, reason?: string }>}
   */
  async addRecord(data) {
    const instanceId = data.instanceId ?? data.id ?? createBuildingInstanceId();

    try {
      const existing = await db.houses.get(instanceId);
      if (existing) {
        return {
          success: false,
          error: 'Key already exists in the object store.',
          reason: 'duplicate',
        };
      }

      const record = canonicalizeHouseRecord({ ...data, instanceId });
      await db.houses.add(record);
      return { success: true, instanceId };
    } catch (err) {
      if (err.name === 'ConstraintError' || err.message?.includes('Key already exists')) {
        return {
          success: false,
          error: 'Key already exists in the object store.',
          reason: 'duplicate',
        };
      }
      return { success: false, error: err.message, reason: 'database_error' };
    }
  }

  /**
   * @param {string} instanceId
   * @param {Record<string, unknown>} updates
   */
  async updateFields(instanceId, updates) {
    const row = await db.houses.get(instanceId);
    if (!row) return;

    const next = { ...row };
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined) {
        next[key] = updates[key];
      }
    }

    await db.houses.put(canonicalizeHouseRecord(next));
  }

  /**
   * @param {string} instanceId
   * @param {string} field
   * @param {number} increment
   * @param {{ limit?: number } | false} [condition]
   */
  async incrementField(instanceId, field, increment, condition = false) {
    const row = await db.houses.get(instanceId);
    if (!row || row[field] === undefined) return;

    if (!condition || row[field] < condition.limit) {
      row[field] += increment;
      await db.houses.put(canonicalizeHouseRecord(row));
    }
  }
}
