/**
 * The legs of an écriture, and the rule that they balance.
 *
 * An écriture is booked in one account (a company's, a house's, the city's) with two or more legs `{ account, debit, credit }` in centimes, the
 * debits and the credits adding to the same total. The legs are written with the entry, so no reader guesses them afterwards. A type of écriture with
 * two legs takes them from the catalog (PcgJournalCatalog) in the chart of accounts its account follows (PCG for a company or a house, M57 for the
 * city and the hamlets); an écriture with more legs (a payroll) brings its own.
 *
 * An écriture that does not balance, or whose type the account's chart does not book, throws, naming the type: it is a defect, never a line to patch.
 */

import { isOperationDiverse, journalCodeOf, legsOfType, odLegsOf, planOfAccount } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';
import { isInformativeJournalType } from './JournalEntryClassificationPolicy.js';

const toCentimes = (amount) => Math.round(amount * 100);

/** The cash account of the chart of accounts: the treasury is its balance, and what moved it is what the cash flows tell. */
export const CASH_ACCOUNT = '512';

/** The journal code of the à-nouveaux: the opening entries of the accounts a purge carries into the following year. */
export const OPENING_JOURNAL = 'AN';

/**
 * What moved the cash in an écriture, by the account the money came from or went to: when the cash is debited, each other leg's credit is money in from that
 * account; when it is credited, each other leg's debit is money out to it. An écriture that leaves the cash as it was (an opération diverse) moved none.
 * @param {Array<{ account: string, debit: number, credit: number }>} legs
 * @returns {Array<{ account: string, in: number, out: number }>} in centimes, one per account the money came from or went to
 */
export function cashFlowsOfLegs(legs) {
  const cash = legs.filter((leg) => leg.account === CASH_ACCOUNT).reduce((sum, leg) => sum + leg.debit - leg.credit, 0);
  if (cash === 0) return [];
  return legs
    .filter((leg) => leg.account !== CASH_ACCOUNT)
    .map((leg) => ({ account: leg.account, in: cash > 0 ? leg.credit - leg.debit : 0, out: cash < 0 ? leg.debit - leg.credit : 0 }))
    .filter((flow) => flow.in !== 0 || flow.out !== 0);
}

/**
 * @param {string} type a journal line's type
 * @returns {boolean} true for a line that is an écriture (it has legs): an informative line is not one, an opération diverse is
 */
export function isEcriture(type) {
  return !isInformativeJournalType(type) || isOperationDiverse(type);
}

/**
 * @param {Array<{ account: string, debit: number, credit: number }>} legs
 * @param {string} type the entry's type, for the error
 * @returns {Array<{ account: string, debit: number, credit: number }>} the same legs, once checked
 */
export function assertBalanced(legs, type) {
  if (!Array.isArray(legs) || legs.length < 2) throw new Error(`[ledger] the écriture "${type}" needs at least two legs`);
  let debit = 0;
  let credit = 0;
  for (const leg of legs) {
    if (typeof leg.account !== 'string' || leg.account === '') throw new Error(`[ledger] a leg of the écriture "${type}" names no account`);
    if (!Number.isInteger(leg.debit) || !Number.isInteger(leg.credit) || leg.debit < 0 || leg.credit < 0 || (leg.debit > 0) === (leg.credit > 0)) {
      throw new Error(`[ledger] the leg ${leg.account} of the écriture "${type}" must be a positive whole number of centimes on one side only (debit ${leg.debit}, credit ${leg.credit})`);
    }
    debit += leg.debit;
    credit += leg.credit;
  }
  if (debit !== credit) throw new Error(`[ledger] the écriture "${type}" does not balance: debits ${debit / 100}, credits ${credit / 100}`);
  return legs;
}

/**
 * @param {object} entry
 * @param {string} entry.type
 * @param {number} entry.amount the entry's amount in currency units (the total of its debits)
 * @param {string | null} entry.accountBuildingId the account the entry is booked in (null: the city's own)
 * @param {Array<{ account: string, debit: number, credit: number }>} [entry.legs] the legs of an entry with more than two, in centimes
 * @returns {{ journal: string, legs: Array<{ account: string, debit: number, credit: number }> }}
 */
export function entryLegsOf({ type, amount, accountBuildingId, legs = null }) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new Error(`[ledger] the écriture "${type}" has an amount that is not a number of zero or more (${amount})`);
  if (legs) {
    const total = legs.reduce((sum, leg) => sum + leg.debit, 0);
    if (total !== toCentimes(amount)) throw new Error(`[ledger] the écriture "${type}" says ${amount} but its debits add up to ${total / 100}`);
    return { journal: journalCodeOf(type), legs: assertBalanced(legs, type) };
  }
  const { debit, credit } = isOperationDiverse(type) ? odLegsOf(type) : legsOfType(type, planOfAccount(accountBuildingId));
  const centimes = toCentimes(amount);
  return {
    journal: journalCodeOf(type),
    legs: assertBalanced([{ account: debit, debit: centimes, credit: 0 }, { account: credit, debit: 0, credit: centimes }], type),
  };
}
