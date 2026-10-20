import { expandYearClosings } from '../../../domain/policies/YearClosingPolicy.js';
import { createGeneralLedgerView } from '../../../domain/read-models/GeneralLedgerView.js';
import { assembleGeneralLedgerView } from './assembleGeneralLedgerView.js';

/**
 * @typedef {object} GeneralLedgerFilters
 * @property {number|null} [periodDays] — max entry age in days; null = all history
 * @property {string[]|null} [types] — entry type filters (supports trailing `_` prefix)
 * @property {string|null} [hamletId] — only entries of this hamlet; null = every hamlet
 * @property {'city'|'private'|null} [accountScope] — 'city': the city's lines (no account), 'private': the lines of a building's
 *   account; null = both. One journal, two views: the city's books and the private flows.
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
    const accountScope = filters.accountScope ?? null;

    // A turn is a day: a period of N days is the entries of the last N turns, counted from the running game's turn.
    const now = this.gameTimePort.currentTurn();
    const allEntries = await this.journalRepository.getJournalEntries();
    const inPeriod = periodDays === null ? allEntries : allEntries.filter((entry) => entry.turn > now - periodDays);
    // A closed year is listed as its per-type totals (its sub-totals), not as one net line.
    const scopedEntries = expandYearClosings(
      hamletId ? inPeriod.filter((entry) => entry.hamletId === hamletId) : inPeriod
    );
    const entries = accountScope === null
      ? scopedEntries
      : scopedEntries.filter((entry) => ((entry.accountBuildingId ?? null) === null) === (accountScope === 'city'));
    const currentYear = this.gameTimePort.getTimeInfo(now).year;

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
