import journalManager from '../../../../../../js/stores/JournalManager.js';
import { JournalRepository } from '../../../../application/ports/JournalRepository.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
} from '../dexie/journalAggregations.js';

/**
 * Accounting BC — reads journal via session buffer (JournalManager).
 * Keeps BC reads aligned with the in-memory authoritative ledger during play.
 */
export class SessionJournalRepository extends JournalRepository {
  /**
   * @param {object} [deps]
   * @param {import('../../../../../../js/stores/JournalManager.js').JournalManager} [deps.journalManager]
   * @param {import('../../../../application/ports/GameTimePort.js').GameTimePort} deps.gameTimePort
   */
  constructor(deps = {}) {
    super();
    this.journalManager = deps.journalManager ?? journalManager;
    this.gameTimePort = deps.gameTimePort;
    if (!this.gameTimePort) {
      throw new Error('SessionJournalRepository: gameTimePort is required');
    }
  }

  /** @returns {Promise<Array<object>>} */
  async getJournalEntries(maxAge = null) {
    return this.journalManager.getJournalEntries(maxAge);
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
