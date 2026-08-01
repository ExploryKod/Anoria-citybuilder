/**
 * Linked financial statements at a point in time (CR + bilan).
 *
 * Accounting invariant: balanceSheet.liabilities.netResult === incomeStatement.netResult
 *
 * @typedef {object} FinancialStatementsBundle
 * @property {number} atTurn
 * @property {number|null} fiscalYear
 * @property {'journal'|'journal+cache'} source
 * @property {import('./IncomeStatement.js').IncomeStatement} incomeStatement
 * @property {import('./BalanceSheet.js').BalanceSheet} balanceSheet
 * @property {object} [enrichment]
 * @property {number} [enrichment.population]
 * @property {object} [enrichment.buildingCounts]
 * @property {object} [enrichment.taxBreakdown]
 * @property {object} [enrichment.maintenanceBreakdown]
 * @property {number} [enrichment.loanDebt]
 * @property {object} [enrichment.financialHealth]
 */

/** @param {Partial<FinancialStatementsBundle> & Pick<FinancialStatementsBundle, 'atTurn'|'incomeStatement'|'balanceSheet'>} data */
export function createFinancialStatementsBundle(data) {
  return {
    atTurn: data.atTurn,
    fiscalYear: data.fiscalYear ?? null,
    source: data.source ?? 'journal',
    incomeStatement: data.incomeStatement,
    balanceSheet: data.balanceSheet,
    enrichment: data.enrichment ?? null,
  };
}
