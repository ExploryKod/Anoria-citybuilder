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
  return BUILDING_INFO_GROUPS.generic;
}
