import { accountKeyOf } from './AccountKeyPolicy.js';
import { isEcriture } from './EntryLegsPolicy.js';
import { HEALTH_FUND_ACCOUNT } from '../../../../shared/accounting-catalog/SocialFundsCatalog.js';

/**
 * What the city's social security passes the unemployment fund for a month: a share of what was credited to the health fund (431) on the city's own account
 * that month — the contributions it received and those a company owes it (the receivable is credited to 431 when it falls due) — read from the legs of the month's
 * écritures, nothing stored. The allocation itself is an écriture on the same two accounts, so it never counts as something received.
 *
 * @param {Array<{ type: string, year?: number, month?: number, legs?: Array<{ account: string, debit: number, credit: number }> }>} entries the journal's lines
 * @param {{ year: number, month: number }} period the fiscal year and the month as the lines are stamped (1 to 12)
 * @param {number} share the fraction of it that goes to the unemployment fund
 * @returns {number} centimes, whole
 */
export function unemploymentAllocationOf(entries, { year, month }, share) {
  if (!(share >= 0 && share <= 1)) throw new Error(`[social-funds] the unemployment share must be a fraction, got ${share}`);
  let received = 0;
  for (const entry of entries) {
    if (!isEcriture(entry.type) || entry.year !== year || entry.month !== month || accountKeyOf(entry) !== null) continue;
    if (!entry.legs) throw new Error(`[social-funds] the écriture "${entry.type}" (turn ${entry.turn}) carries no legs: the month's contributions cannot be read`);
    for (const leg of entry.legs) if (leg.account === HEALTH_FUND_ACCOUNT) received += leg.credit;
  }
  return Math.round(received * share);
}
