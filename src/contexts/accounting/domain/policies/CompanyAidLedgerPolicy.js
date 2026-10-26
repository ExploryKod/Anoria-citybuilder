/**
 * What the aid the city gave a company comes to, read from the company's own lines of the journal, never stored: the loans it still owes (each with its own terms, repaid oldest
 * first), the capital the city put in as a participation and as a shareholder (so the stake it holds). Sums are in centimes.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { SHARE_NOMINAL_VALUE } from '../catalogs/CompanyAidCatalog.js';

const toCentimes = (amount) => Math.round(amount * 100);

/** Every type of line that says anything about the aid: a caller that reads many companies keeps only these once, then reads each company in the few that are left. */
const AID_TYPES = new Set(['aid_loan_received', 'aid_loan_repaid', 'od_aid_loan_abandoned', 'company_capital_received', 'shareholder_capital_received', 'liquidation_surplus_paid']);

/** @param {Array<{ type: string }>} entries the journal's lines @returns {Array<{ type: string }>} the ones the aid is read from */
export function aidEntriesOf(entries) {
  return entries.filter((entry) => AID_TYPES.has(entry.type));
}

/** The types that put capital into a company, and the one that takes it out at a liquidation. */
const CAPITAL_IN = Object.freeze(['company_capital_received', 'shareholder_capital_received']);

/**
 * @param {Array<{ type: string, amount: number, year: number, month: number, loan?: { interestRate: number, interestStartsAfterMonths: number }, accountBuildingId?: string | null, accountKind?: string | null }>} entries the journal lines, in the order they were written
 * @param {string} buildingId
 * @param {string | null} [accountKind]
 * @returns {{
 *   outstanding: number,
 *   loans: Array<{ lentKey: number, principal: number, outstanding: number, terms: { interestRate: number, interestStartsAfterMonths: number } }>,
 *   shareholderCapital: number,
 *   totalCapital: number,
 *   shareholderShares: number,
 *   totalShares: number,
 * }} `loans`: the loans granted, each with the month it was lent (`year × 12 + (month − 1)`) and the terms stamped on it, what is still owed of each (what the company paid back, and what was
 *   abandoned, takes off the oldest first); `totalCapital`: the capital put in less what a liquidation gave back; the shares: those a capital line stamped when it was made, or one share per
 *   `SHARE_NOMINAL_VALUE` euros for a line that stamped none (the founding capital, a prefab's), less the share of what a liquidation gave back
 */
export function companyAidOf(entries, buildingId, accountKind = null) {
  const key = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const loans = [];
  let paidBack = 0;
  let shareholderCapital = 0;
  let totalCapital = 0;
  let shareholderShares = 0;
  let totalShares = 0;
  for (const entry of entries) {
    if (accountKeyOf(entry) !== key) continue;
    const amount = toCentimes(entry.amount);
    if (entry.type === 'aid_loan_received') {
      if (!entry.loan) throw new Error(`[company-aid] a loan of ${buildingId} (turn ${entry.turn}) carries no terms: they are stamped on it when it is granted`);
      loans.push({ lentKey: entry.year * 12 + (entry.month - 1), principal: amount, outstanding: amount, terms: entry.loan });
    } else if (entry.type === 'aid_loan_repaid' || entry.type === 'od_aid_loan_abandoned') paidBack += amount;
    if (CAPITAL_IN.includes(entry.type)) {
      totalCapital += amount;
      const shares = entry.shares ?? amount / 100 / SHARE_NOMINAL_VALUE;
      totalShares += shares;
      if (entry.type === 'shareholder_capital_received') shareholderShares += shares;
    }
    if (entry.type === 'shareholder_capital_received') shareholderCapital += amount;
    if (entry.type === 'liquidation_surplus_paid') totalCapital -= amount;
  }
  let toTakeOff = paidBack;
  for (const loan of loans) {
    const taken = Math.min(loan.outstanding, toTakeOff);
    loan.outstanding -= taken;
    toTakeOff -= taken;
  }
  return { outstanding: loans.reduce((sum, loan) => sum + loan.outstanding, 0), loans, shareholderCapital, totalCapital, shareholderShares, totalShares };
}

/**
 * What a company is worth by its books: its capital (101), the result carried by the years a purge closed (12), the result of the years kept (products 7 less charges 6), less what
 * it has paid out to its shareholders (457). The stock the closing of a month has not posted yet is not in it. It is the equity the price of a share is set on.
 * @param {Map<string, { debit: number, credit: number }>} totals the totals of the company's account, every compte, in centimes
 * @returns {number} euros, below nothing for a company that has lost more than it was given
 */
export function bookEquityOf(totals) {
  let equity = 0;
  for (const [account, total] of totals) {
    if (account === '101' || account === '12') equity += total.credit - total.debit;
    else if (account[0] === '7') equity += total.credit - total.debit;
    else if (account[0] === '6') equity -= total.debit - total.credit;
    else if (account === '457') equity -= total.debit - total.credit;
  }
  return equity / 100;
}
