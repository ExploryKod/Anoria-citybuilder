/**
 * Which partner city offers its gift, if any (BenefactorGiftCatalog.js).
 * A State is helped from abroad only as a last resort: it has no money left AND it can no longer borrow (no bank, a bank that cannot lend, or its debt at the ceiling its income allows).
 * @param {{ funds: number, borrowingOpen: boolean, partnerIds: ReadonlyArray<string>, benefactors: ReadonlyArray<string> }} params
 *   `funds`: the city's cash now; `borrowingOpen`: whether it can still borrow; `partnerIds`: the cities it trades with (active relations); `benefactors`: the catalog's order of priority
 * @returns {string | null} the first benefactor, in the catalog's order, that is a commercial partner; null while the city has money or can borrow, or no benefactor trades with it
 */
export function benefactorOf({ funds, borrowingOpen, partnerIds, benefactors }) {
  if (typeof borrowingOpen !== 'boolean') throw new Error(`[benefactor-gift] whether the city can still borrow was not read (${borrowingOpen})`);
  if (!Number.isFinite(funds)) throw new Error(`[benefactor-gift] the city's funds were not read (${funds})`);
  if (funds > 0 || borrowingOpen) return null;
  return benefactors.find((cityId) => partnerIds.includes(cityId)) ?? null;
}
