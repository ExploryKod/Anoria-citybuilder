/**
 * The purchases a delivery makes: one per house and good, whatever the prices of its units. The accounting writes one line per house, seller, good and turn (its business key),
 * so the units of a house at different prices (a stale one costs less, see FreshnessPricePolicy.js) are one purchase at the average price they were paid: what the house paid is kept to the centime.
 *
 * @param {ReadonlyArray<{ consumerId: string, category: string, amount: number, unitPrice: number }>} transfers the units delivered, each with the price it was paid
 * @returns {Array<{ houseId: string, category: string, units: number, unitPrice: number }>}
 */
export function purchasesOfDeliveries(transfers) {
  const byHouseAndGood = new Map();
  for (const transfer of transfers) {
    if (!Number.isFinite(transfer.unitPrice)) throw new Error(`[supply] a delivery of ${transfer.category} to ${transfer.consumerId} carries no price to be paid`);
    const key = `${transfer.consumerId}>${transfer.category}`;
    const line = byHouseAndGood.get(key) ?? { houseId: transfer.consumerId, category: transfer.category, units: 0, paid: 0 };
    line.units += transfer.amount;
    line.paid += transfer.amount * transfer.unitPrice;
    byHouseAndGood.set(key, line);
  }
  return [...byHouseAndGood.values()].map(({ houseId, category, units, paid }) => ({ houseId, category, units, unitPrice: paid / units }));
}
