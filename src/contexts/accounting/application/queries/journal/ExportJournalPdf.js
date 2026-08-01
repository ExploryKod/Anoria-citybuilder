import { BrowserJournalPdfExporter } from '../../../infrastructure/adapters/browser/BrowserJournalPdfExporter.js';

/**
 * Export journal data as PDF blob (browser/jsPDF).
 */
export class ExportJournalPdf {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../../infrastructure/adapters/browser/BrowserJournalPdfExporter.js').BrowserJournalPdfExporter} [pdfExporter]
   */
  constructor(journalRepository, pdfExporter = new BrowserJournalPdfExporter()) {
    this.journalRepository = journalRepository;
    this.pdfExporter = pdfExporter;
  }

  /** @returns {Promise<Blob>} */
  async execute() {
    const [entries, yearlySummary] = await Promise.all([
      this.journalRepository.getJournalEntries(),
      this.journalRepository.getYearlyFinancialSummary(),
    ]);

    return this.pdfExporter.export({ entries, yearlySummary });
  }
}
