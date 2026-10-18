import {
  buildJournalExportPayload,
  serializeJournalExportPayload,
} from '../../../presentation/JournalExportViewModel.js';

/**
 * Export journal data as JSON (entries + yearly summary + year-end balances), for the whole journal or for one account scope:
 * 'city' (the hamlet's own account) or 'private' (the flux of the companies' and the houses' accounts). The yearly summary is the
 * city's figure, so a private export carries none: its lines are read on their own.
 */
export class ExportJournalJson {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   */
  constructor(journalRepository) {
    this.journalRepository = journalRepository;
  }

  /**
   * @param {{ accountScope?: 'city' | 'private' | null }} [filters] null: every line, city and private
   * @returns {Promise<string>}
   */
  async execute({ accountScope = null } = {}) {
    if (accountScope !== null && accountScope !== 'city' && accountScope !== 'private') {
      throw new Error(`[journal] unknown export scope "${accountScope}": expected 'city', 'private' or none`);
    }
    const [allEntries, yearlySummary] = await Promise.all([
      this.journalRepository.getJournalEntries(),
      this.journalRepository.getYearlyFinancialSummary(),
    ]);
    // A line belongs to the city when it holds no account of a building (the same split as the journal's two tabs).
    const entries = accountScope === null
      ? allEntries
      : allEntries.filter((entry) => ((entry.accountBuildingId ?? null) === null) === (accountScope === 'city'));

    const payload = buildJournalExportPayload({ entries, yearlySummary: accountScope === 'private' ? [] : yearlySummary });

    return serializeJournalExportPayload(payload);
  }
}
