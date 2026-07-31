/**
 * Port: co-maintained treasury mutations (`budget_current`).
 */
export class TreasuryWritePort {
  /**
   * @param {number} _amount
   * @param {object|null} [_maintenanceBreakdown]
   * @returns {Promise<object>} Updated budget row
   */
  async applyMaintenanceDebit(_amount, _maintenanceBreakdown = null) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @param {string} _description
   * @returns {Promise<object>} Updated budget row
   */
  async applyConstructionDebit(_amount, _description) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applySalaryDebit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyPayrollTaxCredit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @param {{ taxBreakdown?: object|null, taxYear?: number|null }} [_options]
   * @returns {Promise<object>} Updated budget row
   */
  async applyCitizenTaxCredit(_amount, _options = {}) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyLoanCapitalCredit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyLoanInterestDebit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyLoanRepaymentDebit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @param {string} _productId
   * @returns {Promise<object>} Updated budget row
   */
  async applyCommerceImportDebit(_amount, _productId) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @param {string} _productId
   * @returns {Promise<object>} Updated budget row
   */
  async applyCommerceExportCredit(_amount, _productId) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyExceptionalExpenseDebit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyCommercialRouteDebit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * Initial capital — income aggregate only (funds pre-seeded at initialize).
   * @param {number} _amount
   * @returns {Promise<object>} Updated budget row
   */
  async applyCapitalFundsIncomeCredit(_amount) {
    throw new Error('TreasuryWritePort: port not implemented');
  }

  /**
   * Construction placement refund — restores funds and reduces investments.
   * @param {number} _amount
   * @param {string} _description
   * @returns {Promise<object>} Updated budget row
   */
  async applyConstructionRefundCredit(_amount, _description) {
    throw new Error('TreasuryWritePort: port not implemented');
  }
}
