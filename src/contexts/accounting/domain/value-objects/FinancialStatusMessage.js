/**
 * Value object — short financial status shown under the admin city-ledger.
 *
 * @typedef {object} FinancialStatusMessage
 * @property {string} text
 * @property {'info' | 'success' | 'danger'} type
 */

/** @param {FinancialStatusMessage} message @returns {FinancialStatusMessage} */
export function createFinancialStatusMessage(message) {
  return Object.freeze({ ...message });
}
