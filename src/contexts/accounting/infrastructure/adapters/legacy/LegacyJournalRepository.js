import { JournalRepository } from '../../../application/ports/JournalRepository.js';

/**
 * Phase 1 adapter — delegates to stores/JournalManager.js
 */
export class LegacyJournalRepository extends JournalRepository {
  /** @param {import('../../../../../js/stores/JournalManager.js').JournalManager|object} journalManager */
  constructor(journalManager) {
    super();
    this.journalManager = journalManager;
  }

  async getJournalEntries(maxAge = null) {
    return this.journalManager.getJournalEntries(maxAge);
  }

  async getYearlyFinancialSummary() {
    return this.journalManager.getYearlyFinancialSummary();
  }

  async getCurrentBalance() {
    return this.journalManager.getCurrentBalance();
  }
}
