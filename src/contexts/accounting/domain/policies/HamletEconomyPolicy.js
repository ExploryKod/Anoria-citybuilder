/**
 * The economy of a hamlet read from the totals of its journal, account by account, in the manner of the national accounts: what it produces (the gross domestic product by the
 * value added), what its debts are, and who holds them. Nothing is stored: the figures are sums of the fold's totals (see LegsFold.totalsByAccount), read on demand.
 *
 * - **Value added** of a company (or of a house's business): its production (sales 70x, the variation of its stock of production 71x) less what it consumed to make it (purchases 60x,
 *   the variation of the stock bought 6037, external services 61x and 62x). The sales between two companies cancel: only what is made at each step is counted. The administration's own
 *   output has no price: it is counted at its cost, the pay of its staff (64x). A household is not a producer here: what it buys is the final sale of a company, already counted.
 * - **Public debt**: what the city owes (its loans 164, its overdraft, its suppliers 401), against what it holds (cash, what it is owed 411, its holdings in companies 261).
 * - **Debt of the companies**: their loans, overdrafts and unpaid charges (the payable accounts), in all their accounts.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { PERSONAL_ACCOUNT, isBusinessAccount } from './AccountKeyPolicy.js';

/** The accounts of what a company owes and has not paid: wages, contributions, taxes, suppliers. */
const OPERATING_DEBT_ACCOUNTS = Object.freeze(['401', '421', '431', '444', '447']);

/** @typedef {Map<string, { debit: number, credit: number }>} AccountTotals */

/** @param {string | null} accountKey @returns {'city' | 'household' | 'business' | 'company'} the sort of account a key names */
export function sortOfAccount(accountKey) {
  if (accountKey === null) return 'city';
  if (accountKey.endsWith(`/${PERSONAL_ACCOUNT}`)) return 'household';
  const kind = accountKey.includes('/') ? accountKey.slice(accountKey.indexOf('/') + 1) : null;
  return kind !== null && isBusinessAccount(kind) ? 'business' : 'company';
}

const net = (totals, prefix, side) => {
  let sum = 0;
  for (const [account, total] of totals) {
    if (!account.startsWith(prefix)) continue;
    sum += side === 'credit' ? total.credit - total.debit : total.debit - total.credit;
  }
  return sum;
};

/**
 * The value added of one producing account, in centimes.
 * @param {AccountTotals} totals
 * @returns {number}
 */
export function valueAddedOf(totals) {
  const production = net(totals, '70', 'credit') + net(totals, '71', 'credit');
  const consumption = net(totals, '60', 'debit') + net(totals, '61', 'debit') + net(totals, '62', 'debit');
  return production - consumption;
}

/**
 * @param {Map<string | null, AccountTotals>} byAccount the totals of the year, by account key
 * @returns {{ valueAdded: number, publicOutput: number, gdp: number, companies: number }} in centimes; `companies` is how many accounts produce
 */
export function domesticProductOf(byAccount) {
  let valueAdded = 0;
  let publicOutput = 0;
  let companies = 0;
  for (const [accountKey, totals] of byAccount) {
    const sort = sortOfAccount(accountKey);
    if (sort === 'company' || sort === 'business') {
      valueAdded += valueAddedOf(totals);
      companies += 1;
    } else if (sort === 'city') {
      publicOutput += net(totals, '64', 'debit');
    }
  }
  return { valueAdded, publicOutput, gdp: valueAdded + publicOutput, companies };
}

/**
 * The public debt of the hamlet's city account, and the assets set against it.
 * @param {AccountTotals} cityTotals the totals of the city's account up to now
 * @param {{ loans: Array<{ amount: number, lenderBuildingId?: string | null }> }} portfolio the loans still running (principal left, in euros)
 * @returns {{ loans: number, overdraft: number, suppliers: number, gross: number, cash: number, receivables: number, holdings: number, net: number, domesticLoans: number }} in centimes
 */
export function publicDebtOf(cityTotals, portfolio) {
  const cashBalance = net(cityTotals, '512', 'debit') + net(cityTotals, '53', 'debit');
  const loans = Math.round(portfolio.loans.reduce((sum, loan) => sum + loan.amount, 0) * 100);
  const domesticLoans = Math.round(portfolio.loans.filter((loan) => loan.lenderBuildingId).reduce((sum, loan) => sum + loan.amount, 0) * 100);
  const overdraft = Math.max(0, -cashBalance);
  const suppliers = Math.max(0, net(cityTotals, '401', 'credit'));
  const gross = loans + overdraft + suppliers;
  const cash = Math.max(0, cashBalance);
  const receivables = Math.max(0, net(cityTotals, '411', 'debit'));
  const holdings = Math.max(0, net(cityTotals, '261', 'debit'));
  return { loans, overdraft, suppliers, gross, cash, receivables, holdings, net: gross - cash - receivables - holdings, domesticLoans };
}

/**
 * What the companies owe, in all their accounts: loans, overdrafts and unpaid charges; and what the households hold on their personal accounts (their savings).
 * @param {Map<string | null, AccountTotals>} byAccount the totals up to now, by account key
 * @returns {{ loans: number, overdrafts: number, unpaid: number, total: number, indebted: number, companies: number, householdSavings: number }} in centimes; `indebted` is how many companies are in overdraft
 */
export function privateDebtOf(byAccount) {
  let loans = 0;
  let overdrafts = 0;
  let unpaid = 0;
  let indebted = 0;
  let companies = 0;
  let householdSavings = 0;
  for (const [accountKey, totals] of byAccount) {
    const sort = sortOfAccount(accountKey);
    const cash = net(totals, '512', 'debit') + net(totals, '53', 'debit');
    if (sort === 'household') {
      householdSavings += Math.max(0, cash);
      continue;
    }
    if (sort === 'city') continue;
    companies += 1;
    loans += Math.max(0, net(totals, '164', 'credit'));
    if (cash < 0) {
      overdrafts += -cash;
      indebted += 1;
    }
    for (const account of OPERATING_DEBT_ACCOUNTS) unpaid += Math.max(0, net(totals, account, 'credit'));
  }
  return { loans, overdrafts, unpaid, total: loans + overdrafts + unpaid, indebted, companies, householdSavings };
}

/**
 * The interest the city paid in the year to lenders outside the game: the interest it paid (class 66) in proportion to the part of its loans no bank of the game lent. A lender that is
 * a bank of the game is domestic: the interest stays in the economy. It is the part of the product that leaves, which makes the national income smaller than the domestic product.
 * @param {AccountTotals} cityYearTotals the totals of the city's account for the year
 * @param {{ loans: number, domesticLoans: number }} debt in centimes
 * @returns {number} in centimes
 */
export function externalInterestOf(cityYearTotals, debt) {
  if (!(debt.loans > 0)) return 0;
  return Math.round((net(cityYearTotals, '66', 'debit') * (debt.loans - debt.domesticLoans)) / debt.loans);
}
