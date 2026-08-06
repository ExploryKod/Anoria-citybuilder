/**
 * Read model — general ledger for the journal UI (year → month → entries).
 *
 * @typedef {object} GeneralLedgerEntry
 * @property {number} [id] Persisted Dexie row id (absent for session-only rows)
 * @property {string} [businessKey]
 * @property {string} type
 * @property {number} amount
 * @property {string} description
 * @property {string} date
 * @property {number} turn
 * @property {boolean} [isCarryForwardIncome]
 * @property {string} [partnerId]
 * @property {string} [buildingInstanceId] UUID v4 de l'asset construit (construction)
 *
 * @typedef {object} GeneralLedgerMonth
 * @property {number} year
 * @property {number} month
 * @property {string} [monthName]
 * @property {number} incomeTotal
 * @property {number} expensesTotal
 * @property {number} netFlow
 * @property {GeneralLedgerEntry[]} entries
 *
 * @typedef {object} GeneralLedgerYear
 * @property {number} year
 * @property {number} incomeTotal
 * @property {number} expensesTotal
 * @property {number} netFlow
 * @property {boolean} isCurrentYear
 * @property {number|null} treasuryBalance Trésorerie actuelle (année en cours uniquement)
 * @property {GeneralLedgerMonth[]} months
 *
 * @typedef {object} GeneralLedgerView
 * @property {number} currentYear
 * @property {number} currentTreasuryBalance
 * @property {boolean} typeFilterActive
 * @property {GeneralLedgerYear[]} years
 */

/** @param {GeneralLedgerView} view @returns {GeneralLedgerView} */
export function createGeneralLedgerView(view) {
  return Object.freeze({ ...view });
}

/** @param {GeneralLedgerYear} year @returns {GeneralLedgerYear} */
export function createGeneralLedgerYear(year) {
  return Object.freeze({ ...year });
}

/** @param {GeneralLedgerMonth} month @returns {GeneralLedgerMonth} */
export function createGeneralLedgerMonth(month) {
  return Object.freeze({ ...month });
}

/** @param {GeneralLedgerEntry} entry @returns {GeneralLedgerEntry} */
export function createGeneralLedgerEntry(entry) {
  return Object.freeze({ ...entry });
}
