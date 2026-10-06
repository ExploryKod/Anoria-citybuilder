/**
 * Port: general ledger persistence and aggregations.
 */
export class JournalRepository {
  /** @returns {Promise<Array<object>>} */
  async getJournalEntries() {
    throw new Error('JournalRepository: port not implemented');
  }

  /**
   * @param {{ hamletId?: string|null }} [_options] — only this hamlet's entries; null = every hamlet
   * @returns {Promise<Array<object>>}
   */
  async getYearlyFinancialSummary(_options = {}) {
    throw new Error('JournalRepository: port not implemented');
  }
}
