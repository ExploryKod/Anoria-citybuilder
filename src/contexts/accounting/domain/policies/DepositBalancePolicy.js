/**
 * A house's savings held at a bank — what it deposited, less what it withdrew, plus the interest already
 * credited. Derived from the journal, every time, like any other balance (see GetTreasurySnapshot): never stored.
 * The pair is always (accountBuildingId: the house, counterpartyBuildingId: the bank) on the house's side of the
 * deposit lines — see RecordHouseholdDeposit.js / RecordHouseholdWithdrawal.js.
 */
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * The year's interest on savings, an opération diverse on each side (PcgJournalCatalog.js): it is added to the house's savings (275) and to what the bank
 * owes (165), it moves no cash. The house withdraws it like the rest of its savings.
 */
export const DEPOSIT_INTEREST_TYPES = Object.freeze({ house: 'od_deposit_interest_credited', bank: 'od_deposit_interest_owed' });

const INCOMING_TYPES = new Set(['deposit', DEPOSIT_INTEREST_TYPES.house]);
// What a liquidated bank could not give back (the city guaranteed it up to the cap, the saver lost the rest) closes the claim as a withdrawal does.
const OUTGOING_TYPES = new Set(['withdrawal', 'deposit_guarantee_received', 'od_deposit_lost']);

/**
 * Every line of the deposit relationship, the house's side and the bank's mirror. A purge keeps them whole (YearClosingPolicy.js), as it keeps
 * a loan's: savings run past the year that is closed, and the à-nouveaux keeps the 275 / 165 balances but not which bank holds whose savings.
 */
export const DEPOSIT_TYPES = Object.freeze(new Set([
  ...INCOMING_TYPES,
  ...OUTGOING_TYPES,
  'deposit_received',
  'withdrawal_paid',
  DEPOSIT_INTEREST_TYPES.bank,
  'od_deposit_abandoned',
]));

/**
 * Every house's savings at a bank, in one pass over the journal: the same lines and the same rule as depositBalanceOf.
 * @param {Array<object>} entries journal lines
 * @param {string} bankId
 * @returns {Map<string, number>} by house, in centimes
 */
export function depositBalancesAt(entries, bankId) {
  if (!bankId) throw new Error('[deposit] the deposit balances are read for a bank');
  const balances = new Map();
  for (const entry of entries) {
    if (entry.counterpartyBuildingId !== bankId || !entry.accountBuildingId) continue;
    const sign = INCOMING_TYPES.has(entry.type) ? 1 : OUTGOING_TYPES.has(entry.type) ? -1 : 0;
    if (sign === 0) continue;
    balances.set(entry.accountBuildingId, (balances.get(entry.accountBuildingId) ?? 0) + sign * Math.round(entry.amount * 100));
  }
  return balances;
}

/**
 * The savings each house holds at a bank, read from the same lines as depositBalanceOf: what a liquidation of that bank owes its depositors.
 * @param {Array<object>} entries journal lines
 * @param {string} bankId
 * @returns {Array<{ houseId: string, amount: number }>} euros, only the houses that hold something
 */
export function depositorsOf(entries, bankId) {
  if (!bankId) throw new Error('[deposit] the depositors are read for a bank');
  const houses = new Set();
  for (const entry of entries) {
    if (entry.counterpartyBuildingId === bankId && INCOMING_TYPES.has(entry.type) && entry.accountBuildingId) houses.add(entry.accountBuildingId);
  }
  return [...houses].map((houseId) => ({ houseId, amount: depositBalanceOf(entries, houseId, bankId) })).filter(({ amount }) => amount > 0);
}

/**
 * @param {Array<object>} entries journal lines
 * @param {string} houseId
 * @param {string} bankId
 * @returns {number} the balance, in euros
 */
export function depositBalanceOf(entries, houseId, bankId) {
  if (!houseId) throw new Error('[deposit] a deposit balance needs its house');
  if (!bankId) throw new Error('[deposit] a deposit balance needs its bank');
  let centimes = 0;
  for (const entry of entries) {
    if (entry.accountBuildingId !== houseId || entry.counterpartyBuildingId !== bankId) continue;
    if (INCOMING_TYPES.has(entry.type)) centimes += Math.round(entry.amount * 100);
    else if (OUTGOING_TYPES.has(entry.type)) centimes -= Math.round(entry.amount * 100);
  }
  return centimes / 100;
}

/**
 * The interest each (house, bank) pair earned over a fiscal year, credited once when the year closes (as a real savings account does). Each
 * month earns a twelfth of the annual rate on the lowest balance the month held (the smaller of its opening and closing balance: what was
 * withdrawn within the month earns nothing, and a deposit made late in the month does not earn for the whole of it). The balance carries the
 * interest of the earlier years, which is how it compounds, once a year. Built from the same lines depositBalanceOf reads, with the month each
 * line is stamped with.
 * @param {Array<object>} entries journal lines
 * @param {{ year: number, annualRate: number }} period the fiscal year to credit, and the rate for the year (a fraction of the balance)
 * @returns {Array<{ houseId: string, bankId: string, interest: number }>} only the pairs that earned something
 */
export function depositInterestsOf(entries, { year, annualRate }) {
  const byPair = new Map();
  for (const entry of entries) {
    const isIncoming = INCOMING_TYPES.has(entry.type);
    const isOutgoing = OUTGOING_TYPES.has(entry.type);
    if (!isIncoming && !isOutgoing) continue;
    if (!entry.accountBuildingId || !entry.counterpartyBuildingId) continue;
    if (entry.year > year) continue;
    const key = `${entry.accountBuildingId}:${entry.counterpartyBuildingId}`;
    const pair = byPair.get(key) ?? { houseId: entry.accountBuildingId, bankId: entry.counterpartyBuildingId, opening: 0, months: new Array(MONTHS_PER_YEAR).fill(0) };
    const signed = (isIncoming ? 1 : -1) * Math.round(entry.amount * 100);
    if (entry.year < year) {
      pair.opening += signed;
    } else {
      if (!Number.isInteger(entry.month) || entry.month < 1 || entry.month > MONTHS_PER_YEAR) {
        throw new Error(`[deposit] journal line ${entry.type} (turn ${entry.turn}) has no month stamp: its interest cannot be placed in the year`);
      }
      pair.months[entry.month - 1] += signed;
    }
    byPair.set(key, pair);
  }
  const interests = [];
  for (const { houseId, bankId, opening, months } of byPair.values()) {
    let balance = opening;
    let earned = 0;
    for (const movement of months) {
      const closing = balance + movement;
      const lowest = Math.min(balance, closing);
      if (lowest > 0) earned += (lowest * annualRate) / 12;
      balance = closing;
    }
    const interest = Math.round(earned) / 100;
    if (interest > 0) interests.push({ houseId, bankId, interest });
  }
  return interests;
}
