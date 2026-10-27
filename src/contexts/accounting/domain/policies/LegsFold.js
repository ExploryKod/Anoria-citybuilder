/**
 * The journal folded into the totals of each compte, in memory, never stored: for each account (the city's, a hamlet's, a company's, a house's), each fiscal
 * year and month, the debits and the credits of every compte its écritures posted to, and what moved its cash by the account the money came from or went to.
 * It is the one derivation of every balance (the cash is the balance of 512) and of the city's ledger: the treasury, the grand livre, the balance, the balance
 * sheet and the livret read the same totals, so they cannot disagree.
 *
 * The journal only ever grows, so the fold takes each new écriture as it is written (`add`) and is rebuilt (`clear`, then `add` again) when lines leave it,
 * which only a purge or a reset does. Reading is a sum over a few years of twelve months, not a pass over the journal. Sums are in centimes, so they are exact.
 *
 * A year closed by a purge enters as its à-nouveaux (journal AN: the balance-sheet accounts it carried against the carried result), in month 0 of its year, so
 * a balance counted until any month of that year or a later one includes it; the cash flows of that year, which its lines no longer say, come from the
 * digest the closing keeps.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { postingsOf } from './AccountLedgerPolicy.js';
import { OPENING_JOURNAL, cashFlowsOfLegs, isEcriture } from './EntryLegsPolicy.js';

/** The month of the à-nouveaux of a closed year: before the first month, so every later point in time includes them. */
const CARRIED_MONTH = 0;

/** @param {string | null} accountKey @param {string} hamletId @returns {string} */
const scopeKeyOf = (hamletId, accountKey) => `${hamletId}\u0000${accountKey ?? ''}`;

/** @typedef {{ totals: Map<string, { debit: number, credit: number }>, flows: Map<string, { in: number, out: number }> }} MonthFold */

export class LegsFold {
  /** @type {Map<string, { hamletId: string, accountKey: string | null, years: Map<number, Map<number, MonthFold>> }>} */
  #scopes = new Map();

  /** @returns {boolean} true when no écriture has been folded in: a brand-new game, before its first line */
  isEmpty() {
    return this.#scopes.size === 0;
  }

  /** Empties the fold: a rebuild starts here, then `add`s every line that is left. */
  clear() {
    this.#scopes.clear();
  }

  /**
   * Folds one line of the journal in. A line that is no écriture (an informative line) adds nothing; an écriture without legs is a defect.
   * @param {object} entry a journal line, with its `hamletId`, its fiscal `year` and `month` and its `legs`
   */
  add(entry) {
    if (!isEcriture(entry.type)) return;
    if (typeof entry.hamletId !== 'string' || entry.hamletId.length === 0) {
      throw new Error(`[fold] journal line ${entry.type} (turn ${entry.turn}) has no hamletId`);
    }
    const opening = entry.journal === OPENING_JOURNAL;
    const year = entry.year;
    // The à-nouveaux of a closed year (journal AN) stand before its first month.
    const month = opening ? CARRIED_MONTH : entry.month;
    if (typeof year !== 'number' || typeof month !== 'number') {
      throw new Error(`[fold] journal line ${entry.type} (turn ${entry.turn}) has no fiscal year and month stamp`);
    }
    const accountKey = accountKeyOf(entry);
    const scopeKey = scopeKeyOf(entry.hamletId, accountKey);
    let scope = this.#scopes.get(scopeKey);
    if (!scope) {
      scope = { hamletId: entry.hamletId, accountKey, years: new Map() };
      this.#scopes.set(scopeKey, scope);
    }
    const months = scope.years.get(year) ?? new Map();
    scope.years.set(year, months);
    const fold = months.get(month) ?? { totals: new Map(), flows: new Map() };
    months.set(month, fold);
    const legs = postingsOf(entry);
    for (const leg of legs) {
      const total = fold.totals.get(leg.account) ?? { debit: 0, credit: 0 };
      total.debit += leg.debit;
      total.credit += leg.credit;
      fold.totals.set(leg.account, total);
    }
    // What moved the cash: a year closed by a purge no longer has its lines, so it says it in its digest.
    if (opening && !entry.closing?.cashFlows) throw new Error(`[fold] the closing of year ${entry.year} carries no cash flows: it was written by an older purge`);
    const flows = opening ? Object.entries(entry.closing.cashFlows).map(([account, flow]) => ({ account, ...flow })) : cashFlowsOfLegs(legs);
    for (const flow of flows) {
      const kept = fold.flows.get(flow.account) ?? { in: 0, out: 0 };
      kept.in += flow.in;
      kept.out += flow.out;
      fold.flows.set(flow.account, kept);
    }
  }

  /**
   * @param {{ hamletId?: string | null, accountKey?: string | null, untilYear?: number | null, untilMonth?: number | null, year?: number | null }} scope
   * @param {(fold: MonthFold) => void} visit called for each month of the scope that is in the period
   */
  #forEachMonth({ hamletId = null, accountKey = null, untilYear = null, untilMonth = null, year = null }, visit) {
    if (untilMonth !== null && untilYear === null) throw new Error('[fold] a month needs its year: untilMonth was given without untilYear');
    for (const scope of this.#scopes.values()) {
      if (scope.accountKey !== accountKey || (hamletId !== null && scope.hamletId !== hamletId)) continue;
      for (const [fiscalYear, months] of scope.years) {
        if (untilYear !== null && fiscalYear > untilYear) continue;
        if (year !== null && fiscalYear !== year) continue;
        for (const [month, fold] of months) {
          if (untilYear !== null && fiscalYear === untilYear && untilMonth !== null && month > untilMonth) continue;
          visit(fold);
        }
      }
    }
  }

  /**
   * The totals of every compte of one account, over the hamlet (every hamlet when null) and up to a point in time.
   * @param {{ hamletId?: string | null, accountKey?: string | null, untilYear?: number | null, untilMonth?: number | null }} [scope]
   *   `accountKey` as in AccountKeyPolicy (null: the city's account). `untilYear`: that fiscal year and every earlier one; with `untilMonth` (1 to 12), up to that month of it.
   * @returns {Map<string, { debit: number, credit: number }>} by compte, in centimes
   */
  totalsOf(scope = {}) {
    const sum = new Map();
    this.#forEachMonth(scope, ({ totals }) => {
      for (const [account, total] of totals) {
        const running = sum.get(account) ?? { debit: 0, credit: 0 };
        running.debit += total.debit;
        running.credit += total.credit;
        sum.set(account, running);
      }
    });
    return sum;
  }

  /**
   * The totals of every compte of every account of a hamlet over one fiscal year (or up to a point in time), account by account: what an aggregate of the whole
   * economy (the output of the companies, the debts of every account) is added up from. One pass over the accounts' months, not over the journal.
   * @param {{ hamletId: string, year?: number | null, untilYear?: number | null, fromKey?: number | null, toKey?: number | null }} scope
   *   `fromKey` and `toKey`: a range of months, both ends included, as `year × 12 + (month - 1)` (the à-nouveaux of a closed year, month 0, are not in a range)
   * @returns {Map<string | null, Map<string, { debit: number, credit: number }>>} by account key (null: the city's), then by compte, in centimes
   */
  totalsByAccount({ hamletId, year = null, untilYear = null, fromKey = null, toKey = null }) {
    if (typeof hamletId !== 'string' || hamletId.length === 0) throw new Error('[fold] the totals by account are read for one hamlet');
    const byAccount = new Map();
    for (const scope of this.#scopes.values()) {
      if (scope.hamletId !== hamletId) continue;
      const sum = byAccount.get(scope.accountKey) ?? new Map();
      byAccount.set(scope.accountKey, sum);
      for (const [fiscalYear, months] of scope.years) {
        if (year !== null && fiscalYear !== year) continue;
        if (untilYear !== null && fiscalYear > untilYear) continue;
        for (const [month, fold] of months) {
          if (fromKey !== null || toKey !== null) {
            const key = fiscalYear * 12 + (month - 1);
            if (month === CARRIED_MONTH || (fromKey !== null && key < fromKey) || (toKey !== null && key > toKey)) continue;
          }
          for (const [account, total] of fold.totals) {
            const running = sum.get(account) ?? { debit: 0, credit: 0 };
            running.debit += total.debit;
            running.credit += total.credit;
            sum.set(account, running);
          }
        }
      }
    }
    return byAccount;
  }

  /**
   * @param {string} account a compte, e.g. `512` for the cash
   * @param {Parameters<LegsFold['totalsOf']>[0]} [scope]
   * @returns {number} the balance of that compte in centimes, debit minus credit
   */
  balanceOf(account, scope = {}) {
    const total = this.totalsOf(scope).get(account);
    return total ? total.debit - total.credit : 0;
  }

  /**
   * What moved the cash of one account in one fiscal year, by the account the money came from or went to.
   * @param {{ hamletId?: string | null, accountKey?: string | null, year: number }} scope
   * @returns {Map<string, { in: number, out: number }>} by account, in centimes
   */
  cashFlowsOf(scope) {
    if (typeof scope?.year !== 'number') throw new Error('[fold] the cash flows of an account are read for a fiscal year');
    const sum = new Map();
    this.#forEachMonth(scope, ({ flows }) => {
      for (const [account, flow] of flows) {
        const running = sum.get(account) ?? { in: 0, out: 0 };
        running.in += flow.in;
        running.out += flow.out;
        sum.set(account, running);
      }
    });
    return sum;
  }

  /**
   * @param {{ hamletId?: string | null, accountKey?: string | null }} [scope]
   * @returns {number[]} the fiscal years the account has écritures in, in order
   */
  yearsOf({ hamletId = null, accountKey = null } = {}) {
    const years = new Set();
    for (const scope of this.#scopes.values()) {
      if (scope.accountKey !== accountKey || (hamletId !== null && scope.hamletId !== hamletId)) continue;
      for (const year of scope.years.keys()) years.add(year);
    }
    return [...years].sort((a, b) => a - b);
  }
}
