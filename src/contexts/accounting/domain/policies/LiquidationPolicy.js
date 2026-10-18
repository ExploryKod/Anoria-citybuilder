/**
 * The liquidation of a company, DERIVED from the journal: a company is liquidated once it has gone `INSOLVENCY_GRACE_MONTHS` months in a row with a debt open,
 * and from then on it is closed. The day it is liquidated is an informative line (`info_company_liquidated`); nothing else stores the state.
 *
 * - `liquidatedIdsOf`: the companies already liquidated;
 * - `companiesToLiquidate`: the companies whose grace is over, not yet liquidated;
 * - `stockRecoveryOf`: what a forced sale of the stock brings in;
 * - `openDebtsOf`: what a liquidated company still owes and nothing can pay.
 */
import { LIQUIDATION_RECOVERY_RATE, INSOLVENCY_GRACE_MONTHS } from '../catalogs/PayableCatalog.js';
import { difficultyMonthsOf, payablesOf } from './DebtPolicy.js';

export const LIQUIDATED_MARKER = 'info_company_liquidated';

/**
 * @param {Array<{ type: string, accountBuildingId: string | null }>} entries the journal lines
 * @returns {Set<string>} the companies already liquidated
 */
export function liquidatedIdsOf(entries) {
  const ids = new Set();
  for (const entry of entries) {
    if (entry.type === LIQUIDATED_MARKER) ids.add(entry.accountBuildingId);
  }
  return ids;
}

/**
 * @param {{ entries: Array<object>, companyIds: ReadonlyArray<string>, until: { year: number, month: number }, monthsPerYear: number }} params
 *   `until`: the delivered month (month 1 to 12) the difficulty is counted up to
 * @returns {string[]} the companies that have been unable to pay for the whole grace period and are not liquidated yet
 */
export function companiesToLiquidate({ entries, companyIds, until, monthsPerYear }) {
  const liquidated = liquidatedIdsOf(entries);
  return companyIds.filter((id) => !liquidated.has(id) && difficultyMonthsOf(entries, id, null, until, monthsPerYear) >= INSOLVENCY_GRACE_MONTHS);
}

/**
 * @param {number} stockValue what the stock cost, in euros
 * @returns {number} what the forced sale brings in, in whole centimes
 */
export function stockRecoveryOf(stockValue) {
  return Math.round(stockValue * 100 * LIQUIDATION_RECOVERY_RATE);
}

/**
 * @param {Array<object>} entries the journal lines
 * @param {string} companyId
 * @returns {Array<{ debtorId: string, accountKind: string | null, creditorId: string | null, kind: string, centimes: number }>} the debts the company still carries (its own account only)
 */
export function openDebtsOf(entries, companyId) {
  return [...payablesOf(entries).values()].filter((debt) => debt.debtorId === companyId && debt.accountKind === null);
}
