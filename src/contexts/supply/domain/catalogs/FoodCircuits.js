/**
 * What each generic command still needs beyond the building's own catalog
 * facts (categories/schedule/amount/totalKey — see buildingEconomy.js and
 * ResourceRolePolicy.js): a resource's own "once per period" lock field
 * names and, for the windmill-to-market leg, its hub-link storage field
 * names. Neither of those is generalized across resources yet (a second
 * producer/collector needs its own lock field; a second hub-and-spoke
 * resource needs its own link storage) — that's real, separate follow-up
 * work, not something a new resource is blocked on today (a producer/
 * distributor pair with no hub leg, like a school, needs neither).
 */

/** Farm harvest — once-per-year lock. */
export const FARM_HARVEST_BOOKKEEPING = Object.freeze({
  lastProducedField: 'lastProductionYear',
  periodKey: (period) => (Number.isFinite(period.year) ? Math.floor(period.year) : 0),
  saveProductionMetadata: (repository, buildingId, period) => {
    const fields = { lastProductionYear: Number.isFinite(period.year) ? Math.floor(period.year) : 0 };
    if (Number.isFinite(period.monthIndex)) {
      fields.lastProductionMonth = period.monthIndex;
    }
    return repository.updateBuildingFields(buildingId, fields);
  },
});

/** Market restocks from its assigned windmill — hub-link storage field names. */
export const MARKET_WINDMILL_TRANSFER_BOOKKEEPING = Object.freeze({
  sourceLinkField: 'supplyWindmillId',
  linksField: 'linkedMarkets',
  linkTargetIdField: 'marketId',
  allocationField: 'allocatedStocks',
  saveLinks: (repository, sourceId, links) => repository.saveLinkedMarkets(sourceId, links),
});

/**
 * House consumes food for its population (monthly) — bookkeeping only, same
 * shape as FARM_HARVEST_BOOKKEEPING. What/when/how-much comes from the
 * house's own 'consumer' resourceRoles entry (see buildingEconomy.js) —
 * total quantity only, "fed or not"; per-category diet variety is a
 * separate feature, not modeled here.
 */
export const HOUSE_FOOD_CONSUMPTION_BOOKKEEPING = Object.freeze({
  lastConsumedField: 'lastConsumptionMonth',
  periodKey: (period) => (Number.isFinite(period.monthIndex) ? Math.floor(period.monthIndex) : 0),
  saveConsumptionMetadata: (repository, buildingId, periodKey, period, record) =>
    repository.updateBuildingFields(buildingId, {
      lastConsumptionMonth: periodKey,
      lastConsumption: { month: period.monthIndex, ...record },
    }),
});
