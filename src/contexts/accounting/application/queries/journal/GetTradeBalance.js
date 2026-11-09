import { expandYearClosings } from '../../../domain/policies/YearClosingPolicy.js';
import { tradeBalanceOf, tradeKindOf } from '../../../domain/policies/TradeBalancePolicy.js';

/**
 * Query: the trade balance of a hamlet for a year, read from the journal's trade lines (TradeBalancePolicy.js). Read when the player asks, never on a timer: the screen calls it
 * when it opens, and the result is kept so that looking at another month of the same year, or coming back, does not read the journal again. A year over is final: its result is kept
 * for good. The running year is kept until the month turns (a trade line is written during the month, so the balance of the month in progress moves).
 */
export class GetTradeBalance {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   * @param {() => string} activeHamletId the hamlet whose lines are read
   */
  constructor(journalRepository, gameTimePort, activeHamletId) {
    this.journalRepository = journalRepository;
    this.gameTimePort = gameTimePort;
    this.activeHamletId = activeHamletId;
    /** @type {Map<string, object>} */
    this.kept = new Map();
  }

  /**
   * @param {{ year?: number | null }} [options] the year to read; none: the running one
   * @returns {Promise<ReturnType<typeof tradeBalanceOf> & { currentYear: number, currentMonthIndex: number }>}
   */
  async execute({ year = null } = {}) {
    const now = this.gameTimePort.getTimeInfo(this.gameTimePort.currentTurn());
    const shown = year ?? now.year;
    const hamletId = this.activeHamletId();
    // A past year never changes; the running year (and a year to come) is read again once the month has turned.
    const key = `${hamletId}|${shown}|${shown < now.year ? 'final' : `${now.year}-${now.monthIndex}`}`;
    if (!this.kept.has(key)) {
      const all = await this.journalRepository.getJournalEntries();
      // The hamlet's trade lines, and its year closings (a purged year keeps its totals per type there: they are expanded back to lines of a type, without a partner).
      const ofHamlet = all.filter((entry) => entry.hamletId === hamletId && (entry.type === 'year_closing' || tradeKindOf(entry.type) !== null));
      const entries = expandYearClosings(ofHamlet);
      const balance = tradeBalanceOf({ entries, timeOf: (turn) => this.gameTimePort.getTimeInfo(turn), year: shown });
      this.kept.set(key, { ...balance, currentYear: now.year, currentMonthIndex: now.monthIndex });
    }
    return this.kept.get(key);
  }
}
