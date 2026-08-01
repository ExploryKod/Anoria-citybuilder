/**
 * Port: cached year-end net flow for carry_forward (localStorage legacy).
 */
export class YearEndBalancePort {
  /**
   * @param {number} _year
   * @returns {Promise<{ amount: number, nature: 'revenue' | 'deficit' } | null>}
   */
  async getYearEndBalance(_year) {
    throw new Error('YearEndBalancePort: port not implemented');
  }

  /**
   * @param {number} _year
   * @param {number} _netFlow
   */
  async saveYearEndBalance(_year, _netFlow) {
    throw new Error('YearEndBalancePort: port not implemented');
  }

  /** @returns {Promise<Array<object>>} */
  async listAllYearEndBalances() {
    throw new Error('YearEndBalancePort: port not implemented');
  }
}
