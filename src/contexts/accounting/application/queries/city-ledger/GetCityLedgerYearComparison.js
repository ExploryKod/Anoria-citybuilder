import { createCityLedgerComparison } from '../../../domain/read-models/CityLedgerComparison.js';
import { createEmptyCityLedgerYearLines } from '../../../domain/value-objects/CityLedgerYearLines.js';
import { cityLedgerYearLinesFromJournalSummary } from '../../../domain/policies/CityLedgerLineMappingPolicy.js';
import {
  cityLedgerBalanceForYear,
  financialStatusMessageForCityLedger,
} from '../../../domain/policies/CityLedgerFinancialStatusPolicy.js';
import { enrichCityLedgerYearLinesWithNetColumns } from '../../../domain/policies/CityLedgerNetColumnsPolicy.js';

/**
 * Query: César 3 admin livret — fiscal year comparison (N vs N-1).
 */
export class GetCityLedgerYearComparison {
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

  /** @returns {Promise<import('../../../domain/read-models/CityLedgerComparison.js').CityLedgerComparison>} */
  async execute() {
    const entries = await this.journalRepository.getJournalEntries();
    const currentTurn = entries.length > 0 ? entries[0].turn : 0;
    const timeInfo = this.gameTimePort.getTimeInfo(currentTurn);
    const currentYear = timeInfo?.year ?? 0;

    const yearlyData = await this.journalRepository.getYearlyFinancialSummary();

    let treasuryBalance = 0;
    try {
      treasuryBalance = await this.treasuryRepository.getTreasuryBalance();
    } catch {
      treasuryBalance = await this.journalRepository.getCurrentBalance();
    }

    const journalYear = (year) =>
      yearlyData.find((y) => y.year === year) ??
      createEmptyCityLedgerYearLines(year);

    const thisYearSummary = journalYear(currentYear);
    const lastYearSummary = journalYear(currentYear - 1);
    const twoYearsAgoSummary = journalYear(currentYear - 2);

    const lastYearBalance = cityLedgerBalanceForYear(
      lastYearSummary,
      treasuryBalance,
      false
    );
    const twoYearsAgoBalance = cityLedgerBalanceForYear(
      twoYearsAgoSummary,
      treasuryBalance,
      false
    );

    const twoYearsAgo = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(twoYearsAgoSummary, twoYearsAgoBalance),
      0
    );
    const lastYear = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(lastYearSummary, lastYearBalance),
      twoYearsAgoBalance
    );
    const thisYear = enrichCityLedgerYearLinesWithNetColumns(
      cityLedgerYearLinesFromJournalSummary(
        thisYearSummary,
        cityLedgerBalanceForYear(thisYearSummary, treasuryBalance, true)
      ),
      lastYearBalance
    );

    return createCityLedgerComparison({
      thisYear,
      lastYear,
      twoYearsAgo,
      debt: treasuryBalance < 0 ? Math.abs(treasuryBalance) : 0,
      message: financialStatusMessageForCityLedger(thisYear, lastYear),
    });
  }
}
