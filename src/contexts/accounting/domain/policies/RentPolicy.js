const toCentimes = (amount) => Math.round(amount * 100);
const fromCentimes = (centimes) => centimes / 100;

/**
 * What every house owes the owner (the mayor's house), derived from the journal and never stored: a month's rent is written when it falls due
 * (`info_rent_due`, whether or not the house can pay it), what is paid is `rent_paid` on the house's personal account. The debt of a house is
 * what fell due less what it paid.
 * @param {Array<{ type: string, amount: number, accountBuildingId?: string | null, counterpartyBuildingId?: string | null }>} entries the journal lines
 * @returns {Map<string, number>} each house's debt in euros, only the houses that ever owed a rent
 */
export function rentDebtsOf(entries) {
  const centimes = new Map();
  for (const entry of entries) {
    if (entry.type === 'info_rent_due' && entry.counterpartyBuildingId) {
      centimes.set(entry.counterpartyBuildingId, (centimes.get(entry.counterpartyBuildingId) ?? 0) + toCentimes(entry.amount));
    } else if (entry.type === 'rent_paid' && entry.accountBuildingId) {
      centimes.set(entry.accountBuildingId, (centimes.get(entry.accountBuildingId) ?? 0) - toCentimes(entry.amount));
    }
  }
  return new Map([...centimes].map(([houseId, value]) => [houseId, fromCentimes(value)]));
}

/**
 * One house's rent for one month: the rent falls due, and the house pays what it owes (the debt it carries plus the month's rent) as far as its
 * money goes, never more than it has.
 * @param {{ rent: number, debt: number, funds: number }} month
 * @returns {{ due: number, paid: number, debtAfter: number }}
 */
export function rentOfMonth({ rent, debt, funds }) {
  if (!(rent >= 0) || !(debt >= 0)) throw new Error(`[rent] a rent and a debt are amounts of at least 0, got rent ${rent} and debt ${debt}`);
  const owed = toCentimes(debt) + toCentimes(rent);
  const paid = Math.min(owed, Math.max(0, toCentimes(funds)));
  return { due: rent, paid: fromCentimes(paid), debtAfter: fromCentimes(owed - paid) };
}
