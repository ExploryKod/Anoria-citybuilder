/**
 * How the hamlet helps its companies with their working capital, the player's policy. Declared once, here: the defaults are written on a hamlet when it is created, the
 * bounds are what the admin panel accepts.
 *
 * The aid is the working capital of a company that carries a stock: a share of what its stock is worth when full (`workingCapitalShare`). The city gives it in three forms, in the
 * shares the player sets (they add up to 1):
 *   - **participation**: capital with no return (what the city did until now: the company's capital 101 against the city's holding 261, never repaid);
 *   - **loan**: the city lends it (274 for the city, 164 for the company), at an annual interest rate that starts being paid after `interestStartsAfterMonths`, repaid out of
 *     the company's result (each month it makes a profit it pays back that much, while its cash stays above nothing);
 *   - **shareholder**: capital that gives the city a stake, and so a share of the result: every January the company pays the city
 *     `stake × payout rate × distributable result` (see CompanyAidPolicy.js). The stake is never set: it is what the city put in, over the capital of the company.
 *
 * The decision binds the player for `commitmentYears` (2 to 8, his choice): until then the policy cannot be changed. It applies to the aid given from the day it is taken;
 * a loan keeps its rate until it is repaid, a stake stays.
 */

/**
 * @type {Readonly<{ workingCapitalShare: number, loanShare: number, shareholderShare: number, loanInterestRate: number, interestStartsAfterMonths: number, dividendPayoutRate: number, commitmentYears: number }>}
 */
export const DEFAULT_COMPANY_AID = Object.freeze({
  // The share of the stock a company carries, valued when full, that the city finances. First value, to tune with a play-through.
  workingCapitalShare: 0.2,
  // Participation is what is left: 1 − loanShare − shareholderShare. All participation by default, as it was.
  loanShare: 0,
  shareholderShare: 0,
  // A year, as a fraction (0.04 = 4 %).
  loanInterestRate: 0,
  // The months after a loan is granted before its interest is due.
  interestStartsAfterMonths: 12,
  // The share of the distributable result a company pays out to its shareholders.
  dividendPayoutRate: 0.5,
  commitmentYears: 2,
});

/** @type {Readonly<Record<keyof typeof DEFAULT_COMPANY_AID, { min: number, max: number, integer: boolean }>>} */
export const COMPANY_AID_BOUNDS = Object.freeze({
  workingCapitalShare: Object.freeze({ min: 0, max: 1, integer: false }),
  loanShare: Object.freeze({ min: 0, max: 1, integer: false }),
  shareholderShare: Object.freeze({ min: 0, max: 1, integer: false }),
  loanInterestRate: Object.freeze({ min: 0, max: 0.3, integer: false }),
  interestStartsAfterMonths: Object.freeze({ min: 0, max: 60, integer: true }),
  dividendPayoutRate: Object.freeze({ min: 0, max: 1, integer: false }),
  // The player chooses how long the decision binds him, within this range.
  commitmentYears: Object.freeze({ min: 2, max: 8, integer: true }),
});

/**
 * The shares of a company. Its first capital (what the city pays at its creation, a participation, what a starter prefab carries) is issued at the nominal value: one share
 * for `SHARE_NOMINAL_VALUE` euros. Capital put in later as a shareholder is issued at the price of the share then: the equity of the company over its shares (what it is worth,
 * as the books say), so a company that has grown costs more to enter than a company that has lost money; never under `MINIMUM_SHARE_PRICE` euros, so that a company with no
 * equity left can still be bought into (at a price near nothing, which gives the new shareholder nearly all of it). The number of shares a contribution bought is stamped on
 * its line when it is made. The stake of the city is the shares it holds over all the shares.
 */
export const SHARE_NOMINAL_VALUE = 1;
export const MINIMUM_SHARE_PRICE = 0.1;
