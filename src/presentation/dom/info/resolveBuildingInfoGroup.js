/**
 * Maps a selected building to an info-panel group (presenter).
 */

/** @typedef {typeof BUILDING_INFO_GROUPS[keyof typeof BUILDING_INFO_GROUPS]} BuildingInfoGroupId */

export const BUILDING_INFO_GROUPS = Object.freeze({
  house: 'house',
  nature: 'nature',
  hubStorage: 'hubStorage',
  farm: 'farm',
  market: 'market',
  service: 'service',
  generic: 'generic',
});

/**
 * @param {{ buildingRow: object | null, supplyView: object | null }} params
 * @returns {BuildingInfoGroupId}
 */
export function resolveBuildingInfoGroup({ buildingRow, supplyView }) {
  if (buildingRow?.category === 'nature') {
    return BUILDING_INFO_GROUPS.nature;
  }
  if (supplyView?.kind === 'house') {
    return BUILDING_INFO_GROUPS.house;
  }
  if (supplyView?.kind === 'hub') {
    return BUILDING_INFO_GROUPS.hubStorage;
  }
  if (supplyView?.kind === 'farm') {
    return BUILDING_INFO_GROUPS.farm;
  }
  if (supplyView?.kind === 'market') {
    return BUILDING_INFO_GROUPS.market;
  }
  // 'service' — a flag-distributor (Chapel, School, Library, Doctor,
  // Hospital, PublicBath, Theatre, Cinema, Pub, ...): see classifySupplyKind
  // in GetBuildingSupplyView.js. Its own group, not market's, since it has
  // no stock/buying-period concept at all.
  if (supplyView?.kind === 'service') {
    return BUILDING_INFO_GROUPS.service;
  }
  // A workplace with no resourceRole at all (today only the Bank — it holds and lends money, not goods: see
  // buildingEconomy.js's 'Bank' entry) is classifySupplyKind's 'other', which has no stock/production/service
  // category to show either — but it still has workers, so it belongs with the other staffed buildings
  // (service's panel already renders an empty "État" section gracefully when there is no category/range to
  // report), not with `generic`, which has no Personnel tab at all and labels its one KV row "Habitants" — a
  // house's word for a building with no residents.
  if (buildingRow?.employees?.worker_need > 0) {
    return BUILDING_INFO_GROUPS.service;
  }
  return BUILDING_INFO_GROUPS.generic;
}
