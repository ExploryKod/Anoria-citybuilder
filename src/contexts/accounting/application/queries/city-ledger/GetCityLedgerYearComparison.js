import { createCityLedgerComparison } from '../../../domain/read-models/CityLedgerComparison.js';
import { cityLedgerYearLinesFromCashFlows } from '../../../domain/policies/CityLedgerLineMappingPolicy.js';
import { financialStatusMessageForCityLedger } from '../../../domain/policies/CityLedgerFinancialStatusPolicy.js';
import { enrichCityLedgerYearLinesWithNetColumns } from '../../../domain/policies/CityLedgerNetColumnsPolicy.js';

/**
 * Query: César 3 admin livret — fiscal year comparison (N vs N-1).
 *
 * The livret is read from the fold of the journal's legs (LegsFold), the one derivation the treasury, the grand livre and the balance read too: each year's
 * lines are what moved the city's cash that year, by M57 account, and its cash is the balance of the cash account. No line of the ledger is a second reading of
 * the journal.
 */
export class GetCityLedgerYearComparison {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {{ cashOf: (scope?: object) => Promise<number> }} getTreasurySnapshot
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalRepository, getTreasurySnapshot, gameTimePort) {
    this.journalRepository = journalRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {{ hamletId?: string|null }} [options] — null = the whole city; a hamlet id = that hamlet's lines only.
   *   The balance is the cash of the same scope: one derivation of the journal, for every figure.
   * @returns {Promise<import('../../../domain/read-models/CityLedgerComparison.js').CityLedgerComparison>}
   */
  async execute({ hamletId = null } = {}) {
    // The current turn is the game's clock, never the date of the last journal line.
    const currentYear = this.gameTimePort.getTimeInfo(this.gameTimePort.currentTurn()).year;

    // Two figures per year, kept apart: the treasury (cash at the end of the year, now for the current one) and the
    // year's net flow (its result). The result is what the net columns carry from one year to the next.
    const cashNow = await this.getTreasurySnapshot.cashOf({ hamletId });
    const cashAtEndOf = (year) => this.getTreasurySnapshot.cashOf({ hamletId, untilYear: year });
    // Read after the cash: a brand-new game has no journal until its capital is written.
    const fold = await this.journalRepository.getLegsFold();
    const flowsOf = (year) => fold.cashFlowsOf({ hamletId, accountKey: null, year });
    // A year without any line has no flow: its net is zero.
    const netOf = (year) => {
      let centimes = 0;
      for (const flow of flowsOf(year).values()) centimes += flow.in - flow.out;
      return centimes / 100;
    };
    const yearLines = async (year, balance, carried) =>
      enrichCityLedgerYearLinesWithNetColumns(
        cityLedgerYearLinesFromCashFlows(year, flowsOf(year), { balanceForYear: balance, previousNetFlow: netOf(year - 1) }),
        carried
      );

    const twoYearsAgo = await yearLines(currentYear - 2, await cashAtEndOf(currentYear - 2), 0);
    const lastYear = await yearLines(currentYear - 1, await cashAtEndOf(currentYear - 1), netOf(currentYear - 2));
    const thisYear = await yearLines(currentYear, cashNow, netOf(currentYear - 1));

    return createCityLedgerComparison({
      thisYear,
      lastYear,
      twoYearsAgo,
      debt: cashNow < 0 ? Math.abs(cashNow) : 0,
      message: financialStatusMessageForCityLedger(thisYear, lastYear),
    });
  }
}
