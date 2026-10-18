/**
 * The grand livre and the balance of one account (a company's, a house's business, the city's), DERIVED from its journal lines: nothing is stored,
 * and no line is added to the journal.
 *
 * A line of the journal posts two legs of the same amount. A movement of money has the bank (512) as one and the account the line is about as the other
 * (its PCG account, see PcgJournalCatalog; a deposit says its other leg as `counter`): money in debits the bank and credits the account; money out
 * debits the account and credits the bank. An opération diverse (the month's closing: variation of stock, depreciation) moves no money and names both
 * legs itself. A year closed by a purge posts the balances it carried (à-nouveaux) against the carried result (12).
 *
 * The balance of the bank equals the treasury because the opérations diverses never touch it. The other check is that no line goes unplaced: a line
 * whose type has no account throws, naming it.
 *
 * - `postingsOf(entry)`: the two legs of one line;
 * - `accountLedgerOf(...)`: the grand livre, each account with its postings in journal order and its running balance;
 * - `trialBalanceOf(...)`: the balance, each account with its debit and credit totals and its balance, and the totals of the two columns.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { moneyDirectionOf } from './TreasuryFromJournalPolicy.js';
import { accountLabelOf, isOperationDiverse, odLegsOf, pcgOfJournalType } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

const BANK = '512';
const CARRIED_RESULT = '12';
const SALES_ACCOUNT = Object.freeze({ merchandise: '707', production: '701', services: '706' });

const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/**
 * @param {{ type: string, amount: number, closing?: { net: number }, turn?: number }} entry a journal line that moves money
 * @param {{ salesNature?: 'merchandise' | 'production' | 'services' | null }} [options] what the account's sales are, which says the account a sale posts to
 * @returns {Array<{ account: string, debit: number, credit: number }>} the legs, in centimes: two for a line, one per carried account for a year closing
 */
export function postingsOf(entry, { salesNature = null } = {}) {
  // An opération diverse moves no money: its two legs are the ones the catalog names, the bank is not one of them.
  if (isOperationDiverse(entry.type)) {
    const { debit, credit } = odLegsOf(entry.type);
    const amount = toCentimes(entry.amount);
    return [{ account: debit, debit: amount, credit: 0 }, { account: credit, debit: 0, credit: amount }];
  }
  const direction = moneyDirectionOf(entry);
  if (!direction) throw new Error(`[ledger] the line "${entry.type}" moves no money: it has no postings yet`);
  if (direction === 'closing') {
    // The year's carried balances (see YearClosingPolicy): each balance-sheet account with its net, the result of the year against account 12.
    if (!entry.closing.balances) throw new Error(`[ledger] the closing of year ${entry.closing.year} carries no balances: it was written by an older purge`);
    const legs = Object.entries(entry.closing.balances).map(([account, net]) => {
      const centimes = toCentimes(net);
      return { account, debit: centimes > 0 ? centimes : 0, credit: centimes < 0 ? -centimes : 0 };
    });
    // Account 12 takes what makes the legs even: a loss is its debit, a profit its credit.
    const carried = -legs.reduce((sum, leg) => sum + leg.debit - leg.credit, 0);
    legs.push({ account: CARRIED_RESULT, debit: carried > 0 ? carried : 0, credit: carried < 0 ? -carried : 0 });
    return legs;
  }
  const pcg = pcgOfJournalType(entry.type);
  if (!pcg) throw new Error(`[ledger] the money line "${entry.type}" has no account in the chart of accounts`);
  let other = pcg.account;
  if (other === '707' && salesNature !== null) {
    other = SALES_ACCOUNT[salesNature];
    if (!other) throw new Error(`[ledger] the sale "${entry.type}" is booked on a building whose sales nature "${salesNature}" is unknown`);
  }
  if (other === BANK) {
    if (!pcg.counter) throw new Error(`[ledger] the line "${entry.type}" posts to the bank and names no other leg (counter)`);
    other = pcg.counter;
  }
  const amount = toCentimes(entry.amount);
  return direction === 'credit'
    ? [{ account: BANK, debit: amount, credit: 0 }, { account: other, debit: 0, credit: amount }]
    : [{ account: other, debit: amount, credit: 0 }, { account: BANK, debit: 0, credit: amount }];
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
    if (!isOperationDiverse(entry.type) && !moneyDirectionOf(entry)) continue;
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
      description: posting.entry.closing ? 'Année clôturée (résultat net)' : posting.entry.description ?? posting.entry.type,
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
