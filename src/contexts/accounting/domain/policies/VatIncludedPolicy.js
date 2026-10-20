/**
 * The VAT inside a final price (TTC). A good's price to the houses is its final price: the house pays it all, the seller
 * receives the price without the tax (HT), and the city receives the tax the rate takes out of it. The tax is rounded to
 * the centime, and the seller's share is what remains, so the house's payment is exactly the seller's share plus the tax.
 *
 * @param {{ ttc: number, ratePercent: number | undefined }} params
 * @returns {{ ttc: number, ht: number, vat: number }}
 */
export function splitVatIncluded({ ttc, ratePercent }) {
  if (!Number.isFinite(ttc) || ttc < 0) throw new Error(`[vat] a final price must be an amount, got ${ttc}`);
  if (!Number.isFinite(ratePercent) || ratePercent < 0) {
    throw new Error(`[vat] the good has no VAT rate: its rate is written when the hamlet is created`);
  }
  const total = roundCentimes(ttc);
  const vat = roundCentimes(total - total / (1 + ratePercent / 100));
  return { ttc: total, ht: roundCentimes(total - vat), vat };
}

/**
 * The VAT added to a price before tax (HT), the way a service is priced: the catalog's price is HT, the city's subsidy is
 * taken off it, and the VAT is charged on what the house pays. The VAT is rounded to the centime; the price is the sum.
 *
 * @param {{ ht: number, ratePercent: number | undefined }} params
 * @returns {{ ht: number, vat: number, ttc: number }}
 */
export function addVatTo({ ht, ratePercent }) {
  if (!Number.isFinite(ht) || ht < 0) throw new Error(`[vat] a price before tax must be an amount, got ${ht}`);
  if (!Number.isFinite(ratePercent) || ratePercent < 0) {
    throw new Error(`[vat] the service has no VAT rate: its rate is written when the hamlet is created`);
  }
  const net = roundCentimes(ht);
  const vat = roundCentimes((net * ratePercent) / 100);
  return { ht: net, vat, ttc: roundCentimes(net + vat) };
}

/** @param {number} amount */
function roundCentimes(amount) {
  return Math.round(amount * 100) / 100;
}
