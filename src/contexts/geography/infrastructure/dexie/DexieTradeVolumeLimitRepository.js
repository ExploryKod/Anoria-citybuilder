import db from '../../../../core/persistence/dexie/db.js';

/**
 * The volume limits the city sets by law (units a month of a traded good, in one flow, whoever the partner): one row per flow and good. A setting of the game; the cycle reads
 * it each month, and the month's use is not kept (it is the cycle's own count).
 */
export class DexieTradeVolumeLimitRepository {
  /** @param {'export' | 'import'} flow @param {string} good @returns {Promise<number | null>} units a month, null when no limit is set */
  async limitOf(flow, good) {
    const row = await db.tradeVolumeLimits.get([flow, good]);
    return row ? row.perMonth : null;
  }

  /** @returns {Promise<Array<{ flow: 'export' | 'import', good: string, perMonth: number }>>} every limit set */
  async list() {
    return db.tradeVolumeLimits.toArray();
  }

  /** @param {'export' | 'import'} flow @param {string} good @param {number} perMonth a whole number of units, at least 1 @returns {Promise<void>} */
  async set(flow, good, perMonth) {
    if (!Number.isInteger(perMonth) || perMonth < 1) throw new Error(`[trade] a volume limit is a whole number of units a month, at least 1, got ${perMonth}`);
    await db.tradeVolumeLimits.put({ flow, good, perMonth });
  }

  /** @param {'export' | 'import'} flow @param {string} good @returns {Promise<void>} */
  async remove(flow, good) {
    await db.tradeVolumeLimits.delete([flow, good]);
  }
}
