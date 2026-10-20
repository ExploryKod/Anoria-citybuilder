/**
 * The share of a service's monthly deliveries the city pays. The price of a delivered unit is the catalog's; the
 * subsidy is the hamlet's percent of that price. The city's part is a journal expense, rounded to the centime (2
 * decimals); the inhabitants' share is what remains, and is only written in the transactions.
 *
 * @param {{ units: number, unitPrice: number, subsidyPercent: number }} params
 * @returns {{ gross: number, citySubsidy: number, habitantShare: number }}
 */
export function serviceSubsidyShare({ units, unitPrice, subsidyPercent }) {
  if (!Number.isInteger(units) || units < 0) throw new Error(`[subsidy] units must be a whole count, got ${units}`);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`[subsidy] unitPrice must be a price, got ${unitPrice}`);
  if (!Number.isFinite(subsidyPercent) || subsidyPercent < 0 || subsidyPercent > 100) {
    throw new Error(`[subsidy] subsidyPercent must be between 0 and 100, got ${subsidyPercent}`);
  }
  const toCentimes = (amount) => Math.round(amount * 100) / 100;
  const gross = toCentimes(units * unitPrice);
  const citySubsidy = toCentimes((gross * subsidyPercent) / 100);
  return { gross, citySubsidy, habitantShare: toCentimes(gross - citySubsidy) };
}
