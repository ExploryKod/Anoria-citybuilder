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
  if (
    supplyView?.kind === 'windmill'
    || buildingRow?.type?.includes('Barn')
  ) {
    return BUILDING_INFO_GROUPS.hubStorage;
  }
  if (supplyView?.kind === 'farm') {
    return BUILDING_INFO_GROUPS.farm;
  }
  if (supplyView?.kind === 'market') {
    return BUILDING_INFO_GROUPS.market;
  }
  return BUILDING_INFO_GROUPS.generic;
}
