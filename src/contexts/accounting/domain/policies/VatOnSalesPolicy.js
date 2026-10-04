/**
 * The value-added tax on a month's final sales of goods to the houses. The tax is levied once, on the last sale of a
 * good's cycle, on its price excluding tax (HT): the price including tax (TTC) is the HT price plus that VAT. Each
 * good's VAT is rounded to the centime; the month's VAT is the sum of those lines.
 *
 * @param {{ salesHT: Record<string, number>, ratesPercent: Record<string, number> }} params
 *   `salesHT`: the HT price of the month's sales per good; `ratesPercent`: the hamlet's VAT rate per good.
 * @returns {{ byGood: Record<string, { htAmount: number, ratePercent: number, vat: number }>, htAmount: number, vat: number, ttcAmount: number }}
 */
export function vatOnSales({ salesHT, ratesPercent }) {
  const byGood = {};
  for (const [good, htAmount] of Object.entries(salesHT)) {
    if (!Number.isFinite(htAmount) || htAmount < 0) throw new Error(`[vat] the HT sales of ${good} must be an amount, got ${htAmount}`);
    const ratePercent = ratesPercent[good];
    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      throw new Error(`[vat] ${good} has no VAT rate: its rate is written when the hamlet is created`);
    }
    byGood[good] = { htAmount, ratePercent, vat: roundCentimes((htAmount * ratePercent) / 100) };
  }
  const htAmount = roundCentimes(Object.values(byGood).reduce((sum, line) => sum + line.htAmount, 0));
  const vat = roundCentimes(Object.values(byGood).reduce((sum, line) => sum + line.vat, 0));
  return { byGood, htAmount, vat, ttcAmount: roundCentimes(htAmount + vat) };
}

/** @param {number} amount */
function roundCentimes(amount) {
  return Math.round(amount * 100) / 100;
}
