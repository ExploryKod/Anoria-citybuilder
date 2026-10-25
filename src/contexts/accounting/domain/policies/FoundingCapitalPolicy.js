/**
 * The founding capital of a company: what the city pays it when it is created so that it can start (its first wages, its upkeep or rent), as the company's
 * equity (capital, 101) against the city's holding in it (261). It is paid once and never repaid. Whether a company already has its capital is read from the
 * journal (a purged year carries it in the balance of account 101), never stored.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { FOUNDING_CAPITAL_MONTHS, WORKING_CAPITAL_STOCK_SHARE } from '../catalogs/PayableCatalog.js';

/**
 * @param {Array<{ type: string, accountBuildingId: string | null, accountKind?: string | null, legs?: Array<{ account: string }> }>} entries the journal lines
 * @returns {Set<string>} the accounts (see `accountKeyOf`) that already received their founding capital
 */
export function foundedAccountsOf(entries) {
  const founded = new Set();
  for (const entry of entries) {
    if (entry.type === 'company_capital_received') founded.add(accountKeyOf(entry));
    else if (entry.type === 'year_closing' && entry.accountBuildingId && entry.legs.some((leg) => leg.account === '101')) founded.add(accountKeyOf(entry));
  }
  return founded;
}

/**
 * The capital the city pays a company: the months of its charges at full staffing the catalog sets, plus the share of the stock it carries
 * (its value when full) that the catalog sets as working capital.
 * @param {number} monthlyNeed what the company's month costs at full staffing, in euros
 * @param {number} stockValue what the stock it carries is worth when full, at cost, in euros (0 for a company that holds none)
 * @returns {number} in centimes
 */
export function foundingCapitalOf(monthlyNeed, stockValue) {
  if (!(monthlyNeed >= 0)) throw new Error(`[founding] the monthly need of a company is an amount of at least 0, got ${monthlyNeed}`);
  if (!(stockValue >= 0)) throw new Error(`[founding] the stock a company carries is an amount of at least 0, got ${stockValue}`);
  return Math.round((monthlyNeed * FOUNDING_CAPITAL_MONTHS + stockValue * WORKING_CAPITAL_STOCK_SHARE) * 100);
}
