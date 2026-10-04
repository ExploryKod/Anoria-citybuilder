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
   */
  constructor(journalRepository) {
    this.journalRepository = journalRepository;
  }

  /** @returns {Promise<string>} */
  async execute() {
    const [entries, yearlySummary] = await Promise.all([
      this.journalRepository.getJournalEntries(),
      this.journalRepository.getYearlyFinancialSummary(),
    ]);

    const payload = buildJournalExportPayload({ entries, yearlySummary });

    return serializeJournalExportPayload(payload);
  }
}
