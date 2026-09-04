/**
 * What each generic command still needs beyond the building's own catalog
 * facts (categories/schedule/amount/totalKey — see buildingEconomy.js and
 * ResourceRolePolicy.js): a resource's own "once per period" lock field
 * names and, for the hub-to-distributor leg, its hub-link storage field
 * names. Neither of those is generalized across resources yet (a second
 * producer/collector needs its own lock field; a second hub-and-spoke
 * resource needs its own link storage) — that's real, separate follow-up
 * work, not something a new resource is blocked on today (a producer/
 * distributor pair with no hub leg, like a school, needs neither).
 */

/** Producer harvest/output — once-per-year lock. */
export const PRODUCER_BOOKKEEPING = Object.freeze({
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

/** Distributor restocks from its assigned hub — hub-link storage field names. */
export const HUB_TRANSFER_BOOKKEEPING = Object.freeze({
  sourceLinkField: 'supplyHubId',
  linksField: 'linkedDistributors',
  linkTargetIdField: 'distributorId',
  allocationField: 'allocatedStocks',
  saveLinks: (repository, sourceId, links) => repository.saveHubLinkedDistributors(sourceId, links),
});

/**
 * Consumer draws down its need (monthly) — bookkeeping only, same shape as
 * PRODUCER_BOOKKEEPING. What/when/how-much comes from the consumer's own
 * 'consumer' resourceRoles entry (see buildingEconomy.js) — total quantity
 * only, "satisfied or not"; per-category variety is a separate feature, not
 * modeled here.
 */
export const CONSUMER_BOOKKEEPING = Object.freeze({
  lastConsumedField: 'lastConsumptionMonth',
  periodKey: (period) => (Number.isFinite(period.monthIndex) ? Math.floor(period.monthIndex) : 0),
  saveConsumptionMetadata: (repository, buildingId, periodKey, period, record) =>
    repository.updateBuildingFields(buildingId, {
      lastConsumptionMonth: periodKey,
      lastConsumption: { month: period.monthIndex, ...record },
    }),
});
