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
    } else if (entry.type === 'info_rent_written_off' && entry.counterpartyBuildingId) {
      centimes.set(entry.counterpartyBuildingId, (centimes.get(entry.counterpartyBuildingId) ?? 0) - toCentimes(entry.amount));
    }
  }
  return new Map([...centimes].map(([houseId, value]) => [houseId, fromCentimes(value)]));
}

/**
 * For each house, the number of months in a row (up to the latest settled one) that it ended with a rent debt: a month's balance is what fell due
 * less what was paid up to its end. A house that settled all its debt is at 0 and is left out.
 * @param {Array<{ type: string, year?: number, month?: number, amount: number, accountBuildingId?: string | null, counterpartyBuildingId?: string | null }>} entries the journal lines
 * @returns {Map<string, number>}
 */
export function rentArrearsMonthsByHouse(entries) {
  const monthlyCentimes = new Map(); // houseId -> Map(monthKey -> change of the debt)
  const add = (houseId, entry, change) => {
    if (!Number.isInteger(entry.year) || !Number.isInteger(entry.month)) throw new Error(`[rent] the ${entry.type} line of house ${houseId} has no year and month`);
    const months = monthlyCentimes.get(houseId) ?? new Map();
    const key = entry.year * 100 + entry.month;
    months.set(key, (months.get(key) ?? 0) + change);
    monthlyCentimes.set(houseId, months);
  };
  for (const entry of entries) {
    if (entry.type === 'info_rent_due' && entry.counterpartyBuildingId) add(entry.counterpartyBuildingId, entry, toCentimes(entry.amount));
    else if (entry.type === 'rent_paid' && entry.accountBuildingId) add(entry.accountBuildingId, entry, -toCentimes(entry.amount));
    else if (entry.type === 'info_rent_written_off' && entry.counterpartyBuildingId) add(entry.counterpartyBuildingId, entry, -toCentimes(entry.amount));
  }
  const arrears = new Map();
  for (const [houseId, months] of monthlyCentimes) {
    let balance = 0;
    let inArrears = 0;
    for (const key of [...months.keys()].sort((a, b) => a - b)) {
      balance += months.get(key);
      inArrears = balance > 0 ? inArrears + 1 : 0;
    }
    if (inArrears > 0) arrears.set(houseId, inArrears);
  }
  return arrears;
}

/**
 * The rent the owner (the property company) asks of each house that pays one. The owner bears the upkeep of every house it owns, vacant ones
 * included, and covers it with the rents of the houses that are lived in: the break-even rent is the upkeep left to it (once the hamlet's subsidy
 * is taken off), plus its margin, shared among the houses that pay. The hamlet may cap the rent (rent control): above the cap the owner asks the
 * cap, and what it cannot cover is its loss (a negative result for now, no worse). The rent is rounded up to the centime, so that it covers.
 * @param {{ upkeepToCover: number, tenants: number, margin: number, cap: number | null }} params `cap`: the rent control's ceiling, null when the hamlet sets none
 * @returns {{ breakEven: number, rent: number, capped: boolean, monthlyLoss: number }} `monthlyLoss`: what the cap leaves the owner to bear each month (0 when none)
 */
export function rentQuoteOf({ upkeepToCover, tenants, margin, cap }) {
  if (!(upkeepToCover >= 0)) throw new Error(`[rent] the upkeep to cover is an amount of at least 0, got ${upkeepToCover}`);
  if (!Number.isInteger(tenants) || tenants < 0) throw new Error(`[rent] the houses that pay a rent are a count, got ${tenants}`);
  if (!(margin >= 0)) throw new Error(`[rent] the owner's margin is a fraction of at least 0, got ${margin}`);
  if (cap !== null && !(cap >= 0)) throw new Error(`[rent] the rent cap is an amount of at least 0 (or none), got ${cap}`);
  if (tenants === 0) return { breakEven: 0, rent: 0, capped: false, monthlyLoss: 0 };
  const breakEven = Math.max(0, Math.ceil(((upkeepToCover * (1 + margin)) / tenants) * 100 - 1e-9)) / 100;
  const capped = cap !== null && cap < breakEven;
  const rent = capped ? cap : breakEven;
  return { breakEven, rent, capped, monthlyLoss: capped ? fromCentimes(toCentimes((breakEven - cap) * tenants)) : 0 };
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
