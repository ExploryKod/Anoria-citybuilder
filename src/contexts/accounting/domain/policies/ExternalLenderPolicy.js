/**
 * The external lenders the city can borrow from now: those of the catalog that are its commercial partners, in the catalog's order.
 * @param {{ partnerIds: ReadonlyArray<string>, lenders: ReadonlyArray<{ cityId: string, extraSpread: number, maxAmount: number }> }} params
 * @returns {Array<{ cityId: string, extraSpread: number, maxAmount: number }>}
 */
export function availableExternalLenders({ partnerIds, lenders }) {
  if (!Array.isArray(partnerIds)) throw new Error('[external-lender] the partner cities must be told to tell who lends');
  return lenders.filter((lender) => partnerIds.includes(lender.cityId));
}

/**
 * @param {{ cityId: string, extraSpread: number, maxAmount: number }} lender
 * @param {{ amount: number }} request
 * @returns {void} throws when the loan asked is more than the lender gives
 */
export function assertWithinLender(lender, { amount }) {
  if (!(amount > 0) || amount > lender.maxAmount) throw new Error(`[external-lender] ${lender.cityId} lends between 1 and ${lender.maxAmount} € in one loan, not ${amount}`);
}
