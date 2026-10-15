const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The cost of living of a reference household's citizen for one month, at the prices on the shelves.
 *
 * - A **need** is something a citizen uses up (food, goods, heat, light, water, energy): a quantity a month, met by the cheapest of the
 *   goods that serve it (a household turns to the cheapest food, the cheapest light...).
 * - A **service** is billed once a month per house, whatever its residents (a doctor, a fire station): its price is shared between the
 *   residents of the reference household.
 * Every price is the one the citizen pays, tax included, after the city's subsidy. A need or a service that nobody sells has no price, and
 * nothing stands in for it: the total is then null and `missing` names what has none, so the figure is shown as "…" and never as a guess.
 *
 * @param {{
 *   needs: Array<{ key: string, quantity: number, unitPrices: number[] }>,
 *   services: Array<{ key: string, unitPrices: number[] }>,
 *   householdSize: number,
 * }} basket
 * @returns {{ total: number | null, lines: Array<{ kind: 'need' | 'service', key: string, quantity: number, unitPrice: number | null, amount: number | null }>, missing: string[] }}
 */
export function costOfLivingOf({ needs, services, householdSize }) {
  if (!Number.isInteger(householdSize) || householdSize <= 0) {
    throw new Error(`[cost-of-living] the reference household must have residents, got ${householdSize}`);
  }
  const lines = [];
  for (const need of needs) {
    if (!(need.quantity > 0)) throw new Error(`[cost-of-living] the need "${need.key}" has no quantity (${need.quantity})`);
    const unitPrice = cheapestOf(need.unitPrices);
    lines.push({ kind: 'need', key: need.key, quantity: need.quantity, unitPrice, amount: unitPrice === null ? null : centimes(need.quantity * unitPrice) });
  }
  for (const service of services) {
    const unitPrice = cheapestOf(service.unitPrices);
    lines.push({ kind: 'service', key: service.key, quantity: 1 / householdSize, unitPrice, amount: unitPrice === null ? null : centimes(unitPrice / householdSize) });
  }
  const missing = lines.filter((line) => line.amount === null).map((line) => line.key);
  const total = missing.length > 0 ? null : centimes(lines.reduce((sum, line) => sum + line.amount, 0));
  return { total, lines, missing };
}

/** @param {number[]} prices @returns {number | null} */
function cheapestOf(prices) {
  return prices.length === 0 ? null : Math.min(...prices);
}
