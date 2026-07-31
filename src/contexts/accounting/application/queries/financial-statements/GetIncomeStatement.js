import { incomeStatementFromYearSummary } from '../../../domain/policies/IncomeStatementMappingPolicy.js';
import { createIncomeStatement } from '../../../domain/read-models/IncomeStatement.js';

/**
 * Query: compte de résultat (produits / charges) from journal for a fiscal year.
 */
export class GetIncomeStatement {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   */
  constructor(journalRepository, gameTimePort) {
    this.journalRepository = journalRepository;
    this.gameTimePort = gameTimePort;
  }

  /**
   * @param {{ fiscalYear?: number|null }} [options]
   * @returns {Promise<import('../../../domain/read-models/IncomeStatement.js').IncomeStatement>}
   */
  async execute(options = {}) {
    const entries = await this.journalRepository.getJournalEntries();
    const currentTurn = entries.length > 0 ? entries[0].turn : 0;
    const currentYear = this.gameTimePort.getTimeInfo(currentTurn)?.year ?? 0;
    const fiscalYear = options.fiscalYear ?? currentYear;

    const yearlyData = await this.journalRepository.getYearlyFinancialSummary();
    const yearSummary =
      yearlyData.find((year) => year.year === fiscalYear) ?? {
        year: fiscalYear,
        income: { total: 0, entries: [] },
        expenses: { total: 0, entries: [] },
      };

    if (
      (yearSummary.income?.entries?.length ?? 0) === 0 &&
      (yearSummary.expenses?.entries?.length ?? 0) === 0
    ) {
      return createIncomeStatement({
        fiscalYear,
        products: [],
        charges: [],
        totalProducts: 0,
        totalCharges: 0,
        netResult: 0,
      });
    }

    return incomeStatementFromYearSummary(fiscalYear, yearSummary);
  }
}
