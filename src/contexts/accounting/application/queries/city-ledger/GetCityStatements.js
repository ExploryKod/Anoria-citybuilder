import { cityBalanceSheetOf, cityIncomeStatementOf, cityTrialBalanceOf } from '../../../domain/policies/CityStatementsPolicy.js';

/**
 * Query: the compte de résultat of the city's year and its balance sheet at the end of it (now for the current year), in the M57 model. Read from the fold of the
 * journal's legs, like the livret, the treasury and the grand livre: the same totals, so they cannot disagree (the cash of the balance sheet is the treasury's).
 */
export class GetCityStatements {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {{ cashOf: (scope?: object) => Promise<number> }} getTreasurySnapshot read first: a brand-new game has no journal until its capital is written
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalRepository, getTreasurySnapshot, gameTimePort) {
    this.journalRepository = journalRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {{ hamletId?: string | null, year?: number | null }} [options] null hamlet = the whole city; no year = the current one
   * @returns {Promise<{ year: number, incomeStatement: ReturnType<typeof cityIncomeStatementOf>, balanceSheet: ReturnType<typeof cityBalanceSheetOf> }>}
   */
  async execute({ hamletId = null, year = null } = {}) {
    await this.getTreasurySnapshot.cashOf({ hamletId });
    const fold = await this.journalRepository.getLegsFold();
    const shown = year ?? this.gameTimePort.getTimeInfo(this.gameTimePort.currentTurn()).year;
    const yearTotals = fold.totalsOf({ hamletId, accountKey: null, year: shown });
    const totalsUntilNow = fold.totalsOf({ hamletId, accountKey: null, untilYear: shown });
    return {
      year: shown,
      incomeStatement: cityIncomeStatementOf(yearTotals),
      balanceSheet: cityBalanceSheetOf(totalsUntilNow, { yearTotals }),
      trialBalance: cityTrialBalanceOf(totalsUntilNow),
    };
  }
}
