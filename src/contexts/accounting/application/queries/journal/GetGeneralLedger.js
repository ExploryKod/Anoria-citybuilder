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
   * @param {{ execute: () => Promise<{ funds: number }> }} getTreasurySnapshot
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalRepository, getTreasurySnapshot, gameTimePort) {
    this.journalRepository = journalRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
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

    const currentTreasuryBalance = (await this.getTreasurySnapshot.execute()).funds;

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
