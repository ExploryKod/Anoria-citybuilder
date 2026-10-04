import { createCityLedgerComparison } from '../../../domain/read-models/CityLedgerComparison.js';
import { createEmptyCityLedgerYearLines } from '../../../domain/value-objects/CityLedgerYearLines.js';
import { cityLedgerYearLinesFromJournalSummary } from '../../../domain/policies/CityLedgerLineMappingPolicy.js';
import {
  cityLedgerBalanceForYear,
  financialStatusMessageForCityLedger,
} from '../../../domain/policies/CityLedgerFinancialStatusPolicy.js';
import { enrichCityLedgerYearLinesWithNetColumns } from '../../../domain/policies/CityLedgerNetColumnsPolicy.js';

/** Rounding slack (currency units) between the treasury and the journal balance. */
const BALANCE_DIVERGENCE_TOLERANCE = 1;

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
   * @param {{ hamletId?: string|null }} [options] — null = the whole city (every hamlet, treasury as balance);
   *   a hamlet id = that hamlet's journal entries only, balance included (the treasury is city-wide).
   * @returns {Promise<import('../../../domain/read-models/CityLedgerComparison.js').CityLedgerComparison>}
   */
  async execute({ hamletId = null } = {}) {
    // The fiscal year is the game's: it comes from the latest entry of the whole journal, never from one hamlet's.
    const entries = await this.journalRepository.getJournalEntries();
    const currentTurn = entries.length > 0 ? entries[0].turn : 0;
    const timeInfo = this.gameTimePort.getTimeInfo(currentTurn);
    const currentYear = timeInfo?.year ?? 0;

    const yearlyData = await this.journalRepository.getYearlyFinancialSummary({ hamletId });

    // Two channels give a balance: the treasury (city-wide) and the journal (source of truth, scopable by hamlet).
    // A hamlet can only use the journal. For the whole city the treasury is shown, and any gap with the journal
    // is reported to the caller (never hidden): the two must tell the same story.
    let treasuryBalance;
    let balanceDivergence = null;
    if (hamletId != null) {
      treasuryBalance = await this.journalRepository.getCurrentBalance({ hamletId });
    } else {
      treasuryBalance = (await this.getTreasurySnapshot.execute()).funds;
      const journalBalance = Math.round(await this.journalRepository.getCurrentBalance());
      const delta = Math.round(treasuryBalance) - journalBalance;
      if (Math.abs(delta) > BALANCE_DIVERGENCE_TOLERANCE) {
        balanceDivergence = { treasuryFunds: Math.round(treasuryBalance), journalBalance, delta };
      }
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
      balanceDivergence,
    });
  }
}
