/**
 * The operating debts of the companies, DERIVED from the journal and never stored.
 *
 * A debt is born when a company cannot pay a charge that is due: an opération diverse `od_payable_<kind>` (the charge to pay) says how much, to whom
 * (`counterpartyBuildingId`: the house of the workers, the owner; null for the city) and on which account. It is paid off by the line of money
 * `<kind>_debt_paid` on the same account and to the same creditor (see PayableCatalog.js). What is left is the debt.
 *
 * - `payByRank`: how a sum of money is shared among claims, the lowest rank first and in proportion within a rank;
 * - `planCompanyPayments`: what a company with this money pays of its old debts and of the charges of the month, and what becomes a new debt;
 * - `payablesOf`: the debts open in the journal;
 * - `difficultyMonthsOf`: how many months in a row an account ended with a debt open.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { PAYABLE_KINDS } from '../catalogs/PayableCatalog.js';

const toCentimes = (amount) => Math.round(amount * 100);

const KIND_OF_PAYABLE = new Map(Object.entries(PAYABLE_KINDS).map(([kind, facts]) => [facts.payable, kind]));
const KIND_OF_SETTLEMENT = new Map(Object.entries(PAYABLE_KINDS).map(([kind, facts]) => [facts.settlement, kind]));

/** @param {string} type @returns {boolean} true for the opération diverse that records a debt. */
export function isPayableType(type) {
  return KIND_OF_PAYABLE.has(type);
}

/**
 * Shares a sum among claims: the lowest rank is paid in full before the next one is touched; within a rank, in proportion to what is owed, to the centime
 * (the last claim takes what is left over). No claim is paid more than it is owed, and the whole is never more than the sum.
 * @param {number} available the money, in centimes (nothing when it is not positive)
 * @param {ReadonlyArray<{ id: string, rank: number, amount: number }>} claims `amount` in centimes
 * @returns {{ paid: Map<string, number>, left: number }} what each claim receives, and the money left
 */
export function payByRank(available, claims) {
  let left = Math.max(0, Math.round(available));
  const paid = new Map(claims.map((claim) => [claim.id, 0]));
  const ranks = [...new Set(claims.map((claim) => claim.rank))].sort((a, b) => a - b);
  for (const rank of ranks) {
    const group = claims.filter((claim) => claim.rank === rank && claim.amount > 0);
    const owed = group.reduce((sum, claim) => sum + claim.amount, 0);
    if (owed === 0) continue;
    if (left >= owed) {
      for (const claim of group) paid.set(claim.id, claim.amount);
      left -= owed;
      continue;
    }
    let given = 0;
    group.forEach((claim, index) => {
      const share = index === group.length - 1 ? left - given : Math.floor((left * claim.amount) / owed);
      paid.set(claim.id, Math.min(claim.amount, share));
      given += paid.get(claim.id);
    });
    left = 0;
    break;
  }
  return { paid, left };
}

/**
 * What a company does with its money at the month's close: it pays its old debts first, then the charges of the month; what it cannot pay of the
 * charges becomes a new debt.
 * @param {{ cash: number, debts: ReadonlyArray<{ id: string, rank: number, amount: number }>, charges: ReadonlyArray<{ id: string, rank: number, amount: number }> }} company
 *   all in centimes; `cash` is what the account holds (nothing is paid out of an account below nothing)
 * @returns {{ debtPaid: Map<string, number>, chargePaid: Map<string, number>, chargeUnpaid: Map<string, number>, left: number }}
 */
export function planCompanyPayments({ cash, debts, charges }) {
  const settled = payByRank(cash, debts);
  const current = payByRank(settled.left, charges);
  const chargeUnpaid = new Map(charges.map((charge) => [charge.id, charge.amount - (current.paid.get(charge.id) ?? 0)]));
  return { debtPaid: settled.paid, chargePaid: current.paid, chargeUnpaid, left: current.left };
}

/**
 * The debts open in the journal: for each debtor account, creditor and kind, what was recorded less what was paid.
 * @param {Array<{ type: string, amount: number, accountBuildingId: string | null, accountKind?: string | null, counterpartyBuildingId?: string | null }>} entries the journal lines
 * @returns {Map<string, { debtorId: string, accountKind: string | null, creditorId: string | null, kind: string, centimes: number }>} keyed by `debtorKey|creditorId|kind`; only the open ones
 */
export function payablesOf(entries) {
  const debts = new Map();
  for (const entry of entries) {
    const kind = KIND_OF_PAYABLE.get(entry.type) ?? KIND_OF_SETTLEMENT.get(entry.type);
    if (!kind) continue;
    if (!entry.accountBuildingId) throw new Error(`[debt] the ${entry.type} line "${entry.description}" has no debtor account`);
    const key = `${accountKeyOf(entry)}|${entry.counterpartyBuildingId ?? ''}|${kind}`;
    const debt = debts.get(key) ?? { debtorId: entry.accountBuildingId, accountKind: entry.accountKind ?? null, creditorId: entry.counterpartyBuildingId ?? null, kind, centimes: 0 };
    debt.centimes += (KIND_OF_PAYABLE.has(entry.type) ? 1 : -1) * toCentimes(entry.amount);
    debts.set(key, debt);
  }
  return new Map([...debts].filter(([, debt]) => debt.centimes > 0));
}

/**
 * How many months in a row an account has had a debt open, counted up to a month: from the month the debt that is still open began, to that month, a
 * month with no line included. An account that settled everything is at 0.
 * @param {Array<{ type: string, year?: number, month?: number, amount: number, accountBuildingId: string | null, accountKind?: string | null }>} entries the journal lines
 * @param {string} buildingId
 * @param {string | null} accountKind
 * @param {{ year: number, month: number }} until the month counted up to (month 1 to 12)
 * @param {number} monthsPerYear
 * @returns {number}
 */
export function difficultyMonthsOf(entries, buildingId, accountKind, until, monthsPerYear) {
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const changes = new Map();
  for (const entry of entries) {
    const kind = KIND_OF_PAYABLE.get(entry.type) ?? KIND_OF_SETTLEMENT.get(entry.type);
    if (!kind || accountKeyOf(entry) !== accountKey) continue;
    if (!Number.isInteger(entry.year) || !Number.isInteger(entry.month)) throw new Error(`[debt] the ${entry.type} line of ${buildingId} has no year and month`);
    const ordinal = entry.year * monthsPerYear + (entry.month - 1);
    changes.set(ordinal, (changes.get(ordinal) ?? 0) + (KIND_OF_PAYABLE.has(entry.type) ? 1 : -1) * toCentimes(entry.amount));
  }
  let balance = 0;
  let streakStart = null;
  for (const ordinal of [...changes.keys()].sort((a, b) => a - b)) {
    balance += changes.get(ordinal);
    if (balance > 0) streakStart ??= ordinal;
    else streakStart = null;
  }
  return streakStart === null ? 0 : until.year * monthsPerYear + (until.month - 1) - streakStart + 1;
}
