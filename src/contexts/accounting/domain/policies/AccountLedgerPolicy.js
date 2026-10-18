/**
 * The grand livre and the balance of one account (a company's, a house's business, the city's), DERIVED from its journal lines: nothing is stored,
 * and no line is added to the journal.
 *
 * An écriture carries its legs, written with it (see EntryLegsPolicy): the postings are those legs, read back as they were booked. A year closed by a
 * purge posts the balances it carried (à-nouveaux) against the carried result (12). An informative line is no écriture and posts nothing.
 *
 * The balance of the bank equals the treasury because both read the same legs. The other check is that no écriture goes unplaced: a line with no legs
 * throws, naming it.
 *
 * - `postingsOf(entry)`: the legs of one line;
 * - `accountLedgerOf(...)`: the grand livre, each account with its postings in journal order and its running balance;
 * - `trialBalanceOf(...)`: the balance, each account with its debit and credit totals and its balance, and the totals of the two columns.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { isEcriture } from './EntryLegsPolicy.js';
import { accountLabelOf } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

const SALES_ACCOUNT = Object.freeze({ merchandise: '707', production: '701', services: '706' });

const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/**
 * @param {{ type: string, legs?: Array<{ account: string, debit: number, credit: number }>, turn?: number }} entry an écriture (the à-nouveaux of a year closed by a purge are one)
 * @param {{ salesNature?: 'merchandise' | 'production' | 'services' | null }} [options] what the account's sales are, which says the account a sale posts to
 * @returns {Array<{ account: string, debit: number, credit: number }>} the legs, in centimes: those the écriture was booked with
 */
export function postingsOf(entry, { salesNature = null } = {}) {
  if (!isEcriture(entry.type)) throw new Error(`[ledger] the line "${entry.type}" is no écriture: it has no postings`);
  if (!entry.legs) throw new Error(`[ledger] the écriture ${entry.id ?? ''} "${entry.type}" (turn ${entry.turn}) carries no legs: it was written before the entries carried them`);
  // A sale is booked on 707; the account a building's sales really sit in (goods, its production, services) is told by the building.
  if (salesNature === null) return entry.legs;
  const salesAccount = SALES_ACCOUNT[salesNature];
  if (!salesAccount) throw new Error(`[ledger] the sale "${entry.type}" is booked on a building whose sales nature "${salesNature}" is unknown`);
  return entry.legs.map((leg) => (leg.account === '707' ? { ...leg, account: salesAccount } : leg));
}

/**
 * @param {Array<object>} entries the journal lines
 * @param {string | null} buildingId the account's building (null: the city's own account)
 * @param {{ accountKind?: string | null, salesNature?: 'merchandise' | 'production' | 'services' | null }} [options]
 * @returns {Array<{ account: string, entry: object, debit: number, credit: number }>} the postings of the account's money lines, in journal order (centimes)
 */
function postingsOfAccount(entries, buildingId, { accountKind = null, salesNature = null } = {}) {
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const postings = [];
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey) continue;
    if (!isEcriture(entry.type)) continue;
    for (const leg of postingsOf(entry, { salesNature })) postings.push({ ...leg, entry });
  }
  return postings;
}

/**
 * The grand livre: for each account the account has posted to, its postings in journal order, each with the running balance (debit minus credit).
 * @param {Array<object>} entries the journal lines
 * @param {string | null} buildingId
 * @param {{ accountKind?: string | null, salesNature?: 'merchandise' | 'production' | 'services' | null }} [options]
 * @returns {Array<{ account: string, label: string, debit: number, credit: number, balance: number, lines: Array<{ year: number | null, month: number | null, description: string, debit: number, credit: number, balance: number }> }>} by account number
 */
export function accountLedgerOf(entries, buildingId, options = {}) {
  const byAccount = new Map();
  for (const posting of postingsOfAccount(entries, buildingId, options)) {
    const ledger = byAccount.get(posting.account) ?? { account: posting.account, label: accountLabelOf(posting.account), debit: 0, credit: 0, lines: [] };
    ledger.debit += posting.debit;
    ledger.credit += posting.credit;
    ledger.lines.push({
      year: posting.entry.year ?? null,
      month: posting.entry.month ?? null,
      description: posting.entry.journal === 'AN' ? 'À-nouveaux de l’année clôturée' : posting.entry.description ?? posting.entry.type,
      debit: fromCentimes(posting.debit),
      credit: fromCentimes(posting.credit),
      balance: fromCentimes(ledger.debit - ledger.credit),
    });
    byAccount.set(posting.account, ledger);
  }
  return [...byAccount.values()]
    .sort((a, b) => a.account.localeCompare(b.account, 'en', { numeric: true }))
    .map(({ debit, credit, ...ledger }) => ({ ...ledger, debit: fromCentimes(debit), credit: fromCentimes(credit), balance: fromCentimes(debit - credit) }));
}

/**
 * The balance (balance générale): each account's debit and credit totals and its balance (a debit balance or a credit balance), and the two columns'
 * totals. The columns must be equal; they are by construction, so a difference is a defect and throws.
 * @param {Array<object>} entries the journal lines
 * @param {string | null} buildingId
 * @param {{ accountKind?: string | null, salesNature?: 'merchandise' | 'production' | 'services' | null }} [options]
 * @returns {{ accounts: Array<{ account: string, label: string, debit: number, credit: number, debitBalance: number, creditBalance: number }>, totals: { debit: number, credit: number, debitBalance: number, creditBalance: number } }}
 */
export function trialBalanceOf(entries, buildingId, options = {}) {
  const accounts = accountLedgerOf(entries, buildingId, options).map(({ account, label, debit, credit, balance }) => ({
    account,
    label,
    debit,
    credit,
    debitBalance: balance > 0 ? balance : 0,
    creditBalance: balance < 0 ? -balance : 0,
  }));
  const sum = (field) => fromCentimes(accounts.reduce((total, account) => total + toCentimes(account[field]), 0));
  const totals = { debit: sum('debit'), credit: sum('credit'), debitBalance: sum('debitBalance'), creditBalance: sum('creditBalance') };
  if (totals.debit !== totals.credit || totals.debitBalance !== totals.creditBalance) {
    throw new Error(`[ledger] the balance of ${buildingId ?? 'the city'} does not balance: debits ${totals.debit}, credits ${totals.credit}`);
  }
  return { accounts, totals };
}
