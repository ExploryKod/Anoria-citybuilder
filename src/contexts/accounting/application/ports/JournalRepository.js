/**
 * Port: general ledger persistence and aggregations.
 */
export class JournalRepository {
  /** @returns {Promise<Array<object>>} */
  async getJournalEntries(_maxAge = null) {
    throw new Error('JournalRepository: port not implemented');
  }

  /** @returns {Promise<Array<object>>} */
  async getYearlyFinancialSummary() {
    throw new Error('JournalRepository: port not implemented');
  }

  /** @returns {Promise<number>} */
  async getCurrentBalance() {
    throw new Error('JournalRepository: port not implemented');
  }
}
