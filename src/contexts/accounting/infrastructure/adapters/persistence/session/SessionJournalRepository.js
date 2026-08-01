import sessionJournalStore from '../../../session/SessionJournalStore.js';
import { JournalRepository } from '../../../../application/ports/JournalRepository.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
} from '../dexie/journalAggregations.js';

/**
 * Accounting BC — reads journal via session buffer (SessionJournalStore).
 */
export class SessionJournalRepository extends JournalRepository {
  /**
   * @param {object} [deps]
   * @param {import('../../../session/SessionJournalStore.js').SessionJournalStore} [deps.sessionJournalStore]
   * @param {import('../../../../application/ports/GameTimePort.js').GameTimePort} deps.gameTimePort
   */
  constructor(deps = {}) {
    super();
    this.sessionJournalStore = deps.sessionJournalStore ?? sessionJournalStore;
    this.gameTimePort = deps.gameTimePort;
    if (!this.gameTimePort) {
      throw new Error('SessionJournalRepository: gameTimePort is required');
    }
  }

  /** @returns {Promise<Array<object>>} */
  async getJournalEntries(maxAge = null) {
    return this.sessionJournalStore.getJournalEntries(maxAge);
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
