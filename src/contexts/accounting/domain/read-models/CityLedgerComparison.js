/**
 * Read model — admin city-ledger with N, N-1 and N-2 columns.
 *
 * @typedef {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines} CityLedgerYearLines
 * @typedef {import('../value-objects/FinancialStatusMessage.js').FinancialStatusMessage} FinancialStatusMessage
 *
 * @typedef {object} CityLedgerComparison
 * @property {CityLedgerYearLines} thisYear
 * @property {CityLedgerYearLines} lastYear
 * @property {CityLedgerYearLines} twoYearsAgo
 * @property {number} debt
 * @property {FinancialStatusMessage} message
 */

/**
 * @param {CityLedgerComparison} comparison
 * @returns {CityLedgerComparison}
 */
export function createCityLedgerComparison(comparison) {
  return Object.freeze({ ...comparison });
}
