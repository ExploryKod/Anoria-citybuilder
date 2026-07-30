import db from '../../../../../../core/persistence/dexie/db.js';
import { JournalRepository } from '../../../../application/ports/JournalRepository.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
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

  /** @returns {Promise<Array<object>>} */
  async getYearlyFinancialSummary() {
    const entries = await this.getJournalEntries();
    const monthlyData = buildMonthlyFinancialSummary(entries, (turn) =>
      this.gameTimePort.getTimeInfo(turn)
    );
    return buildYearlyFinancialSummary(monthlyData);
  }

  /** @returns {Promise<number>} */
  async getCurrentBalance() {
    const entries = await this.getJournalEntries();
    return computeJournalCurrentBalance(entries, (turn) =>
      this.gameTimePort.getTimeInfo(turn)
    );
  }
}
