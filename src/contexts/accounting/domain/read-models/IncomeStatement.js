/**
 * @typedef {object} IncomeStatementLine
 * @property {string} label
 * @property {number} amount
 */

/**
 * @typedef {object} IncomeStatement
 * @property {number} fiscalYear
 * @property {number} totalProducts
 * @property {number} totalCharges
 * @property {number} netResult
 * @property {IncomeStatementLine[]} products
 * @property {IncomeStatementLine[]} charges
 */

/** @param {Partial<IncomeStatement> & Pick<IncomeStatement, 'fiscalYear'>} data */
export function createIncomeStatement(data) {
  const products = data.products ?? [];
  const charges = data.charges ?? [];
  const totalProducts =
    data.totalProducts ?? products.reduce((sum, line) => sum + line.amount, 0);
  const totalCharges =
    data.totalCharges ?? charges.reduce((sum, line) => sum + line.amount, 0);

  return {
    fiscalYear: data.fiscalYear,
    products,
    charges,
    totalProducts,
    totalCharges,
    netResult: data.netResult ?? totalProducts - totalCharges,
  };
}
