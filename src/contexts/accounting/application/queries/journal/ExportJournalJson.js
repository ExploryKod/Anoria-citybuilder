import {
  buildJournalExportPayload,
  serializeJournalExportPayload,
} from '../../../presentation/JournalExportViewModel.js';

/**
 * Export journal data as JSON (entries + yearly summary + year-end balances).
 */
export class ExportJournalJson {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/YearEndBalancePort.js').YearEndBalancePort} yearEndBalancePort
   */
  constructor(journalRepository, yearEndBalancePort) {
    this.journalRepository = journalRepository;
    this.yearEndBalancePort = yearEndBalancePort;
  }

  /** @returns {Promise<string>} */
  async execute() {
    const [entries, yearlySummary, yearEndBalances] = await Promise.all([
      this.journalRepository.getJournalEntries(),
      this.journalRepository.getYearlyFinancialSummary(),
      this.yearEndBalancePort.listAllYearEndBalances(),
    ]);

    const payload = buildJournalExportPayload({
      entries,
      yearlySummary,
      yearEndBalances,
    });

    return serializeJournalExportPayload(payload);
  }
}
