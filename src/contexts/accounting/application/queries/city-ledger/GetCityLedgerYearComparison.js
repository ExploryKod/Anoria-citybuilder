import { createCityLedgerComparison } from '../../../domain/read-models/CityLedgerComparison.js';
import { createEmptyCityLedgerYearLines } from '../../../domain/value-objects/CityLedgerYearLines.js';
import { cityLedgerYearLinesFromJournalSummary } from '../../../domain/policies/CityLedgerLineMappingPolicy.js';
import { financialStatusMessageForCityLedger } from '../../../domain/policies/CityLedgerFinancialStatusPolicy.js';
import { enrichCityLedgerYearLinesWithNetColumns } from '../../../domain/policies/CityLedgerNetColumnsPolicy.js';

/**
 * Query: César 3 admin livret — fiscal year comparison (N vs N-1).
 */
export class GetCityLedgerYearComparison {
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
   * @param {{ hamletId?: string|null }} [options] — null = the whole city; a hamlet id = that hamlet's lines only.
   *   The balance is the treasury snapshot of the same scope: one derivation of the journal, for every figure.
   * @returns {Promise<import('../../../domain/read-models/CityLedgerComparison.js').CityLedgerComparison>}
   */
  async execute({ hamletId = null } = {}) {
    // The current turn is the game's clock (the snapshot's turn), never the date of the last journal line.
    const treasuryNow = await this.getTreasurySnapshot.execute({ hamletId });
    const currentYear = this.gameTimePort.getTimeInfo(treasuryNow.turn).year;

    const yearlyData = await this.journalRepository.getYearlyFinancialSummary({ hamletId });

    // Two figures per year, kept apart: the treasury (cash at the end of the year, now for the current one) and the
    // year's net flow (its result). The result is what the net columns carry from one year to the next.
    const cashNow = treasuryNow.funds;
    const treasuryAtEndOf = async (year) =>
      (await this.getTreasurySnapshot.execute({ hamletId, untilYear: year })).funds;

    const journalYear = (year) =>
      yearlyData.find((y) => y.year === year) ??
      createEmptyCityLedgerYearLines(year);
    // A year without any line has no flow: its net is zero, the same as an empty summary.
    const netOf = (year) => yearlyData.find((y) => y.year === year)?.netFlow ?? 0;

    const thisYearSummary = journalYear(currentYear);
    const lastYearSummary = journalYear(currentYear - 1);
    const twoYearsAgoSummary = journalYear(currentYear - 2);

    const twoYearsAgo = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(
        twoYearsAgoSummary,
        await treasuryAtEndOf(currentYear - 2),
        netOf(currentYear - 3)
      ),
      0
    );
    const lastYear = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(
        lastYearSummary,
        await treasuryAtEndOf(currentYear - 1),
        netOf(currentYear - 2)
      ),
      netOf(currentYear - 2)
    );
    const thisYear = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(thisYearSummary, cashNow, netOf(currentYear - 1)),
      netOf(currentYear - 1)
    );

    return createCityLedgerComparison({
      thisYear,
      lastYear,
      twoYearsAgo,
      debt: cashNow < 0 ? Math.abs(cashNow) : 0,
      message: financialStatusMessageForCityLedger(thisYear, lastYear),
    });
  }
}
