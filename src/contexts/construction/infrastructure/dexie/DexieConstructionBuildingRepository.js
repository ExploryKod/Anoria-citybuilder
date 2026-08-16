import db from '../../../../core/persistence/dexie/db.js';
import {
  getActiveHamletId,
  isActiveHamletRow,
} from '../../../../core/persistence/hamlet/hamletSession.js';
import {
  canonicalizeHouseRecord,
  createBuildingInstanceId,
  footprintFromRecord,
  footprintOccupiesTile,
} from '../../../../shared/building-identity/index.js';

/** @type {Set<string>} */
const anchorsBeingWritten = new Set();

function anchorLockKey(anchorX, anchorY) {
  return `${Math.floor(anchorX)},${Math.floor(anchorY)}`;
}

function isConstraintError(err) {
  return (
    err?.name === 'ConstraintError' ||
    err?.inner?.name === 'ConstraintError' ||
    (typeof err?.message === 'string' && err.message.includes('Key already exists'))
  );
}

/** Construction adapter — direct Dexie (table `houses`). */
export class DexieConstructionBuildingRepository {
  async findByAnchor(x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const matches = await db.houses.where('[anchorX+anchorY]').equals([tileX, tileY]).toArray();
    return matches.find(isActiveHamletRow) ?? null;
  }

  async findAtTile(x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    const atAnchor = await this.findByAnchor(tileX, tileY);
    if (atAnchor) {
      return atAnchor;
    }

    const rows = await db.houses.toArray();
    return (
      rows.find((row) => {
        if (!isActiveHamletRow(row)) return false;
        const footprint = footprintFromRecord(row);
        return footprint && footprintOccupiesTile(footprint, tileX, tileY);
      }) ?? null
    );
  }

  async findById(instanceId) {
    if (!instanceId) return null;
    return db.houses.get(instanceId);
  }

  async #clearAnchorOccupant(anchorX, anchorY, keepInstanceId) {
    if (typeof anchorX !== 'number' || typeof anchorY !== 'number') {
      return;
    }

    const atAnchor = await db.houses
      .where('[anchorX+anchorY]')
      .equals([anchorX, anchorY])
      .toArray();

    const occupant = atAnchor.find(isActiveHamletRow);
    if (occupant && occupant.instanceId !== keepInstanceId) {
      await db.houses.delete(occupant.instanceId);
    }
  }

  /**
   * @param {object} data
   * @returns {Promise<{ success: boolean, instanceId?: string, error?: string, reason?: string }>}
   */
  async addRecord(data) {
    const instanceId = data.instanceId ?? data.id ?? createBuildingInstanceId();

    let record;
    try {
      record = canonicalizeHouseRecord({
        ...data,
        instanceId,
        hamletId: data.hamletId || getActiveHamletId(),
      });
    } catch (err) {
      return { success: false, error: err.message, reason: 'database_error' };
    }

    const lockKey = anchorLockKey(record.anchorX, record.anchorY);
    if (anchorsBeingWritten.has(lockKey)) {
      return {
        success: false,
        error: 'Building is already being added at this anchor',
        reason: 'duplicate',
      };
    }

    anchorsBeingWritten.add(lockKey);

    try {
      await this.#clearAnchorOccupant(record.anchorX, record.anchorY, instanceId);
      await db.houses.put(record);
      return { success: true, instanceId };
    } catch (err) {
      if (isConstraintError(err)) {
        return {
          success: false,
          error: 'Key already exists in the object store.',
          reason: 'duplicate',
        };
      }
      return { success: false, error: err.message, reason: 'database_error' };
    } finally {
      anchorsBeingWritten.delete(lockKey);
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

    try {
      await db.houses.put(canonicalizeHouseRecord(next));
    } catch (err) {
      if (isConstraintError(err)) {
        console.warn(
          `[Construction] Skipped update for ${instanceId}: constraint conflict`,
          err
        );
        return;
      }
      throw err;
    }
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
      try {
        await db.houses.put(canonicalizeHouseRecord(row));
      } catch (err) {
        if (isConstraintError(err)) {
          console.warn(
            `[Construction] Skipped increment for ${instanceId}.${field}: constraint conflict`,
            err
          );
          return;
        }
        throw err;
      }
    }
  }

  async listAllRows() {
    const rows = await db.houses.toArray();
    return rows.filter(isActiveHamletRow);
  }

  /** @param {string} instanceId */
  async deleteById(instanceId) {
    if (!instanceId) return;
    await db.houses.delete(instanceId);
  }
}

/** @internal Tests only */
export function resetConstructionAnchorLocksForTests() {
  anchorsBeingWritten.clear();
}
