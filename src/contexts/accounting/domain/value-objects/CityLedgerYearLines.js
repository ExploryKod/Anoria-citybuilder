/**
 * Value object — one fiscal year column in the admin city-ledger (César 3).
 *
 * @typedef {object} CityLedgerYearLines
 * @property {number} year
 * @property {number} initialFunds
 * @property {number} incomeTax
 * @property {number} payrollTax
 * @property {number} exports
 * @property {number} loanCapital
 * @property {number} carryForwardIncome
 * @property {number} totalIncome
 * @property {number} construction
 * @property {number} maintenance
 * @property {number} salary
 * @property {number} repairs
 * @property {number} commercialRoutes
 * @property {number} imports
 * @property {number} loanInterest
 * @property {number} loanRepayment
 * @property {number} carryForwardExpense
 * @property {number} totalExpenses
 * @property {number} balance
 * @property {number} netIncome
 * @property {number} netExpenses
 * @property {number} netFlow
 */

/** @param {number} [year] @returns {CityLedgerYearLines} */
export function createEmptyCityLedgerYearLines(year = 0) {
  return Object.freeze({
    year,
    initialFunds: 0,
    incomeTax: 0,
    payrollTax: 0,
    exports: 0,
    loanCapital: 0,
    carryForwardIncome: 0,
    totalIncome: 0,
    construction: 0,
    maintenance: 0,
    salary: 0,
    repairs: 0,
    commercialRoutes: 0,
    imports: 0,
    loanInterest: 0,
    loanRepayment: 0,
    carryForwardExpense: 0,
    totalExpenses: 0,
    balance: 0,
    netIncome: 0,
    netExpenses: 0,
    netFlow: 0,
  });
}

/**
 * @param {Partial<CityLedgerYearLines> & { year: number }} fields
 * @returns {CityLedgerYearLines}
 */
export function createCityLedgerYearLines(fields) {
  return Object.freeze({
    ...createEmptyCityLedgerYearLines(fields.year),
    ...fields,
  });
}
