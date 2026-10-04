import sessionJournalStore from '../../../session/SessionJournalStore.js';
import { JournalRepository } from '../../../../application/ports/JournalRepository.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
  filterJournalEntriesByHamlet,
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

  /**
   * @param {{ hamletId?: string|null }} [options] — only this hamlet's entries; null = every hamlet
   * @returns {Promise<number>}
   */
  async getCurrentBalance({ hamletId = null } = {}) {
    const entries = filterJournalEntriesByHamlet(await this.getJournalEntries(), hamletId);
    return computeJournalCurrentBalance(entries, (turn) =>
      this.gameTimePort.getTimeInfo(turn)
    );
  }
}
