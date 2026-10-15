/**
 * A house's savings held at a bank — what it deposited, less what it withdrew, plus the interest already
 * credited. Derived from the journal, every time, like any other balance (see GetTreasurySnapshot): never stored.
 * The pair is always (accountBuildingId: the house, counterpartyBuildingId: the bank) on the house's side of the
 * deposit lines — see RecordHouseholdDeposit.js / RecordHouseholdWithdrawal.js.
 */

const INCOMING_TYPES = new Set(['deposit', 'household_deposit_interest']);
const OUTGOING_TYPES = new Set(['withdrawal']);

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
    const pair = byPair.get(key) ?? { houseId: entry.accountBuildingId, bankId: entry.counterpartyBuildingId, opening: 0, months: new Array(12).fill(0) };
    const signed = (isIncoming ? 1 : -1) * Math.round(entry.amount * 100);
    if (entry.year < year) {
      pair.opening += signed;
    } else {
      if (!Number.isInteger(entry.month) || entry.month < 1 || entry.month > 12) {
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
