/**
 * @typedef {object} BalanceSheet
 * @property {number} asOfTurn
 * @property {object} assets
 * @property {number} assets.tangibleGross
 * @property {number} assets.depreciation
 * @property {number} assets.tangibleNet
 * @property {number} assets.cash
 * @property {number} assets.receivables
 * @property {number} assets.total
 * @property {object} liabilities
 * @property {number} liabilities.shareCapital
 * @property {number} liabilities.netResult
 * @property {number} liabilities.bankLoans
 * @property {number} liabilities.commercialLoans
 * @property {number} liabilities.accruedExpenses
 * @property {number} liabilities.total
 * @property {boolean} balanced
 * @property {number} [balanceAdjustment]
 */

/** @param {Partial<BalanceSheet> & Pick<BalanceSheet, 'asOfTurn'|'assets'|'liabilities'>} data */
export function createBalanceSheet(data) {
  const assets = {
    tangibleGross: data.assets?.tangibleGross ?? 0,
    depreciation: data.assets?.depreciation ?? 0,
    tangibleNet: data.assets?.tangibleNet ?? 0,
    cash: data.assets?.cash ?? 0,
    receivables: data.assets?.receivables ?? 0,
    total: data.assets?.total ?? 0,
  };

  const liabilities = {
    shareCapital: data.liabilities?.shareCapital ?? 0,
    netResult: data.liabilities?.netResult ?? 0,
    bankLoans: data.liabilities?.bankLoans ?? 0,
    commercialLoans: data.liabilities?.commercialLoans ?? 0,
    accruedExpenses: data.liabilities?.accruedExpenses ?? 0,
    total: data.liabilities?.total ?? 0,
  };

  const balanceDifference = Math.abs(assets.total - liabilities.total);
  const balanced = balanceDifference <= 1;

  return {
    asOfTurn: data.asOfTurn,
    assets,
    liabilities,
    balanced,
    balanceAdjustment: balanced ? 0 : assets.total - liabilities.total,
  };
}
