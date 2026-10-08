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
 * Every (house, bank) pair with a deposit balance — what SettleBankDepositInterest.js folds the monthly interest
 * over. Built from the same lines depositBalanceOf reads, grouped instead of filtered to one pair.
 * @param {Array<object>} entries journal lines
 * @returns {Array<{ houseId: string, bankId: string, balance: number }>}
 */
export function depositBalancesByBank(entries) {
  const byPair = new Map();
  for (const entry of entries) {
    const isIncoming = INCOMING_TYPES.has(entry.type);
    const isOutgoing = OUTGOING_TYPES.has(entry.type);
    if (!isIncoming && !isOutgoing) continue;
    if (!entry.accountBuildingId || !entry.counterpartyBuildingId) continue;
    const key = `${entry.accountBuildingId}:${entry.counterpartyBuildingId}`;
    const current = byPair.get(key) ?? { houseId: entry.accountBuildingId, bankId: entry.counterpartyBuildingId, centimes: 0 };
    current.centimes += (isIncoming ? 1 : -1) * Math.round(entry.amount * 100);
    byPair.set(key, current);
  }
  return [...byPair.values()].map(({ houseId, bankId, centimes }) => ({ houseId, bankId, balance: centimes / 100 }));
}
