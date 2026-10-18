const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The price of one unit of a good, step by step from the reference to what a house pays: each step says what it adds and the price once it is
 * added. A made-here good goes reference → producer → warehouse → market → VAT; an imported good starts at the city's price and adds the
 * transport, the customs duty and the merchants' margin before the same last steps. The prices of the warehouse and of the market are the ones
 * they really sell at now (built on what their stock cost, see PriceBook), so the warehouse's step also carries a stock still held at an older cost.
 * Nothing is stored: every figure is read from the catalogs and the current prices.
 *
 * @param {object} params
 * @param {string} params.good
 * @param {number} params.reference the good's reference price (catalog base value)
 * @param {number} params.producerPrice what a producer sells it at
 * @param {{ cityId: string, cityPrice: number, transport: number, dutyRate: number, duty: number, merchantMargin: number } | null} params.import
 *   the import leg, null for a good made here
 * @param {number} params.warehousePrice what the warehouses sell it at now (HT)
 * @param {number | null} params.marketPrice what the markets sell it at now (HT), null when no market sells it
 * @param {number} params.vatPercent the VAT on this good, in percent
 * @returns {{ good: string, origin: string | null, steps: Array<{ id: string, label: string, amount: number, price: number }>, priceHT: number, vat: number, priceTTC: number, dutyShare: number }}
 */
export function buildPriceWaterfall({ good, reference, producerPrice, import: importLeg, warehousePrice, marketPrice, vatPercent }) {
  for (const [name, value] of Object.entries({ reference, producerPrice, warehousePrice, vatPercent })) {
    if (!Number.isFinite(value)) throw new Error(`[price-waterfall] the ${name} of "${good}" is missing (${value})`);
  }
  if (marketPrice !== null && !Number.isFinite(marketPrice)) throw new Error(`[price-waterfall] the market price of "${good}" is not a number (${marketPrice})`);
  const steps = [{ id: 'reference', label: 'Prix de référence', amount: centimes(reference), price: centimes(reference) }];
  let price = reference;
  const add = (id, label, amount) => {
    price = centimes(price + amount);
    steps.push({ id, label, amount: centimes(amount), price });
  };

  if (importLeg) {
    add('city', `Prix de la ville (écart au référence)`, importLeg.cityPrice - reference);
    add('transport', 'Transport', importLeg.transport);
    add('duty', 'Droits de douane', importLeg.duty);
    add('merchants', 'Marge des marchands', importLeg.merchantMargin);
  } else {
    add('producer', 'Producteur', producerPrice - reference);
  }
  add('warehouse', 'Entrepôt', warehousePrice - price);
  // A good no market sells (the fuel of a power plant, bought at the warehouse) ends at the warehouse's price: no market step, no VAT.
  let vat = 0;
  if (marketPrice !== null) {
    add('market', 'Marché', marketPrice - price);
    vat = centimes((marketPrice * vatPercent) / 100);
    add('vat', `TVA (${vatPercent} %)`, vat);
  }

  return {
    good,
    origin: importLeg ? importLeg.cityId : null,
    steps,
    priceHT: centimes(marketPrice ?? warehousePrice),
    vat,
    priceTTC: price,
    // The share of the price a house pays that is customs duty: it is the lever of the trade policy (phase 7).
    dutyShare: importLeg && price > 0 ? importLeg.duty / price : 0,
  };
}
