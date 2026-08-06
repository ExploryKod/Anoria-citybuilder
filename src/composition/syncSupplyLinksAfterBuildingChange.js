import {
  isMarketBuildingType,
  isWindmillBuildingType,
} from '../shared/building-catalog/BuildingSupplyTypes.js';
import { refreshSupplyPlacementIndex } from '../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';

/**
 * Event-driven supply link maintenance after placement / demolition.
 *
 * @param {object} params
 * @param {object} params.supply
 * @param {object} params.construction
 * @param {{ size: number, tiles: object[][] }} [params.city]
 * @param {'placed' | 'bulldozed'} params.event
 * @param {string | null | undefined} params.buildingType
 * @param {string | null | undefined} params.instanceId
 * @param {number} [params.x]
 * @param {number} [params.y]
 * @returns {Promise<object>}
 */
export async function syncSupplyLinksAfterBuildingChange({
  supply,
  construction,
  city = null,
  event,
  buildingType,
  instanceId,
  x,
  y,
}) {
  let outcome = { handled: false };

  if (event === 'bulldozed' && isWindmillBuildingType(buildingType) && instanceId && city) {
    outcome = await supply.cascadeDestroyWindmillMarkets({
      windmillId: instanceId,
      city,
      bulldozeBuildingAtTile: (params) => construction.bulldozeBuildingAtTile(params),
    });
  }

  if (event === 'placed' && isMarketBuildingType(buildingType) && instanceId) {
    outcome = await supply.assignMarketToWindmill({
      marketId: instanceId,
      x: x ?? 0,
      y: y ?? 0,
    });
  }

  if (event === 'bulldozed' && isMarketBuildingType(buildingType) && instanceId) {
    outcome = await supply.detachMarketFromWindmill({ marketId: instanceId });
  }

  if (event === 'placed' && isWindmillBuildingType(buildingType) && instanceId) {
    await supply.initializeWindmillLinks({ windmillId: instanceId });
    outcome = { handled: true, initialized: true };
  }

  const rows = await construction.listAllBuildingRows();
  refreshSupplyPlacementIndex(rows);

  return outcome;
}
