import { createGeneralLedgerView } from '../../../domain/read-models/GeneralLedgerView.js';
import { assembleGeneralLedgerView } from './assembleGeneralLedgerView.js';

/**
 * @typedef {object} GeneralLedgerFilters
 * @property {number|null} [periodDays] — max entry age in days; null = all history
 * @property {string[]|null} [types] — entry type filters (supports trailing `_` prefix)
 * @property {string|null} [hamletId] — only entries of this hamlet; null = every hamlet
 */

/**
 * Query: journal UI — chronological journal grouped by month/year.
 *
 * PCG note: this is the **journal** (livre chronologique), NOT the grand livre
 * (classé par compte). Rename target: GetJournal / JournalView.
 */
export class GetGeneralLedger {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/TreasuryRepository.js').TreasuryRepository} treasuryRepository
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalRepository, treasuryRepository, gameTimePort) {
    this.journalRepository = journalRepository;
    this.treasuryRepository = treasuryRepository;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {GeneralLedgerFilters} [filters]
   * @returns {Promise<import('../../../domain/read-models/GeneralLedgerView.js').GeneralLedgerView>}
   */
  async execute(filters = {}) {
    const periodDays = filters.periodDays ?? null;
    const types = filters.types ?? null;
    const hamletId = filters.hamletId ?? null;

    const allEntries = await this.journalRepository.getJournalEntries(periodDays);
    const entries = hamletId ? allEntries.filter((entry) => entry.hamletId === hamletId) : allEntries;
    const currentTurn = allEntries.length > 0 ? allEntries[0].turn : 0;
    const timeInfo = this.gameTimePort.getTimeInfo(currentTurn);
    const currentYear = timeInfo?.year ?? 0;

    let currentTreasuryBalance = 0;
    try {
      currentTreasuryBalance = await this.treasuryRepository.getTreasuryBalance();
    } catch {
      currentTreasuryBalance = await this.journalRepository.getCurrentBalance();
    }

    const view = assembleGeneralLedgerView({
      entries,
      getTimeInfo: (turn) => this.gameTimePort.getTimeInfo(turn),
      currentYear,
      currentTreasuryBalance,
      types,
    });

    return createGeneralLedgerView(view);
  }
}
