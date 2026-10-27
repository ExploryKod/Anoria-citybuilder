/**
 * The aid the hamlet gives its companies, as pure rules (see CompanyAidCatalog.js): how a working capital is split among the three forms, what a loan owes in interest and
 * what a company pays back of it, the stake the city holds and the dividend it is paid. Sums are in centimes, so the figures are exact.
 */

import { COMPANY_AID_BOUNDS, MINIMUM_SHARE_PRICE, SHARE_NOMINAL_VALUE } from '../catalogs/CompanyAidCatalog.js';

/**
 * Checks a policy against its bounds and the rule that the loan and the shareholder shares leave room for the participation.
 * @param {Record<string, number>} policy
 * @returns {Record<string, number>} the same policy
 */
export function assertCompanyAidPolicy(policy) {
  for (const [field, bounds] of Object.entries(COMPANY_AID_BOUNDS)) {
    const value = policy[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`[company-aid] ${field} must be a number, got ${value}`);
    if (bounds.integer && !Number.isInteger(value)) throw new Error(`[company-aid] ${field} must be an integer, got ${value}`);
    if (value < bounds.min || value > bounds.max) throw new Error(`[company-aid] ${field} must be between ${bounds.min} and ${bounds.max}, got ${value}`);
  }
  if (policy.loanShare + policy.shareholderShare > 1 + 1e-9) {
    throw new Error(`[company-aid] the loan (${policy.loanShare}) and the shareholder (${policy.shareholderShare}) shares leave nothing of 1 for the participation`);
  }
  return policy;
}

/**
 * How a working capital is split among the three forms, to the centime: the loan and the shareholding are rounded, the participation takes what is left, so the three add
 * up to the capital.
 * @param {number} workingCapital in centimes
 * @param {{ loanShare: number, shareholderShare: number }} policy
 * @returns {{ participation: number, loan: number, shareholder: number }} in centimes
 */
export function splitWorkingCapital(workingCapital, policy) {
  if (!(workingCapital >= 0) || !Number.isInteger(workingCapital)) throw new Error(`[company-aid] a working capital is a whole number of centimes of at least 0, got ${workingCapital}`);
  const loan = Math.round(workingCapital * policy.loanShare);
  const shareholder = Math.round(workingCapital * policy.shareholderShare);
  const participation = workingCapital - loan - shareholder;
  if (participation < 0) throw new Error(`[company-aid] the shares of the loan and of the shareholder exceed the working capital: ${loan} + ${shareholder} > ${workingCapital}`);
  return { participation, loan, shareholder };
}

/**
 * The interest a loan owes for one month, from the month its interest starts.
 * @param {{ outstanding: number, annualRate: number, monthsSinceGranted: number, startsAfterMonths: number, monthsPerYear: number }} loan outstanding in centimes
 * @returns {number} in centimes, 0 while the loan is still in its grace period
 */
export function monthlyInterestOf({ outstanding, annualRate, monthsSinceGranted, startsAfterMonths, monthsPerYear }) {
  if (monthsSinceGranted < startsAfterMonths) return 0;
  return Math.round((outstanding * annualRate) / monthsPerYear);
}

/**
 * What a company pays back of a loan this month: its profit of the month, no more than it owes and than its cash holds, and nothing in a month it lost.
 * @param {{ outstanding: number, monthResult: number, cash: number }} params centimes
 * @returns {number} centimes
 */
export function repaymentOf({ outstanding, monthResult, cash }) {
  return Math.max(0, Math.min(outstanding, monthResult, cash));
}

/**
 * The price of a share of a company now, in euros: its equity over its shares, never under the minimum (see CompanyAidCatalog.js). A company with no share yet has the nominal price.
 * @param {{ equity: number, totalShares: number }} params the equity in euros (it may be below nothing), the shares issued
 * @returns {number}
 */
export function sharePriceOf({ equity, totalShares }) {
  if (!(totalShares > 0)) return SHARE_NOMINAL_VALUE;
  return Math.max(MINIMUM_SHARE_PRICE, equity / totalShares);
}

/**
 * How many shares a contribution buys at the price of a share, to six decimals.
 * @param {{ amount: number, price: number }} params euros
 * @returns {number}
 */
export function sharesBoughtBy({ amount, price }) {
  if (!(amount > 0) || !(price > 0)) throw new Error(`[company-aid] shares are bought with an amount and a price above 0, got ${amount} at ${price}`);
  return Math.round((amount / price) * 1e6) / 1e6;
}

/**
 * The stake the city holds in a company: the shares it holds over all the shares.
 * @param {{ shareholderShares: number, totalShares: number }} params
 * @returns {number} a fraction, 0 for a company with no share
 */
export function stakeOf({ shareholderShares, totalShares }) {
  return totalShares > 0 ? Math.min(1, shareholderShares / totalShares) : 0;
}

/**
 * The dividend a company pays its shareholder city for a year: the stake in what the company can distribute (the result of the year, no more than what it has made in all, so
 * nothing while it carries losses) at the payout rate, and no more than the cash it holds.
 * @param {{ stake: number, payoutRate: number, yearResult: number, accumulatedResult: number, cash: number }} params results and cash in centimes
 * @returns {number} centimes
 */
export function dividendOf({ stake, payoutRate, yearResult, accumulatedResult, cash }) {
  const distributable = Math.min(yearResult, accumulatedResult);
  if (!(distributable > 0) || !(stake > 0) || !(cash > 0)) return 0;
  return Math.min(Math.round(distributable * stake * payoutRate), cash);
}
