import db from '../../../../../../core/persistence/dexie/db.js';
import { JournalRepository } from '../../../../application/ports/JournalRepository.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  filterJournalEntriesByHamlet,
  filterAndSortJournalEntries,
} from './journalAggregations.js';

/**
 * Accounting BC — direct Dexie access to `db.journal` (read path).
 */
export class DexieJournalRepository extends JournalRepository {
  /**
   * @param {object} [deps]
   * @param {import('dexie').Dexie} [deps.db]
   * @param {import('../../../../application/ports/GameTimePort.js').GameTimePort} deps.gameTimePort
   */
  constructor(deps = {}) {
    super();
    this.db = deps.db ?? db;
    this.gameTimePort = deps.gameTimePort;
    if (!this.gameTimePort) {
      throw new Error('DexieJournalRepository: gameTimePort is required');
    }
  }

  /** @returns {Promise<Array<object>>} */
  async getJournalEntries(maxAge = null) {
    const entries = await this.db.journal.toArray();
    return filterAndSortJournalEntries(entries, maxAge);
  }

  /**
   * @param {{ hamletId?: string|null }} [options] — only this hamlet's entries; null = every hamlet
   * @returns {Promise<Array<object>>}
   */
  async getYearlyFinancialSummary({ hamletId = null } = {}) {
    const entries = filterJournalEntriesByHamlet(await this.getJournalEntries(), hamletId);
    const monthlyData = buildMonthlyFinancialSummary(entries, (turn) =>
      this.gameTimePort.getTimeInfo(turn)
    );
    return buildYearlyFinancialSummary(monthlyData);
  }
}
