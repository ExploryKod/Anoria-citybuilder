import { canPlaceBuildingAtTile } from '../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';
import { isMarketBuildingType } from '../shared/building-catalog/BuildingSupplyTypes.js';
import { canPlaceMarketAt } from '../contexts/supply/domain/policies/WindmillMarketLinkPolicy.js';
import { getSupplyPlacementWindmills } from '../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';

/**
 * Footprint + supply-link placement gate (sync, for ghost preview).
 *
 * @param {object} params
 * @param {{ size: number, tiles: object[][] }} params.city
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} params.buildingType
 * @param {Record<string, { gridSize?: number }>} params.assetCatalog
 * @returns {{ ok: boolean, reason?: string, gridSize: number, ownerWindmillId?: string }}
 */
export function canPlaceBuildingAtTileWithSupplyRules(params) {
  const base = canPlaceBuildingAtTile(params);
  if (!base.ok) {
    return base;
  }

  if (!isMarketBuildingType(params.buildingType)) {
    return base;
  }

  const marketCheck = canPlaceMarketAt({
    x: params.x,
    y: params.y,
    windmills: getSupplyPlacementWindmills(),
  });

  if (!marketCheck.ok) {
    return {
      ...base,
      ok: false,
      reason: marketCheck.reason,
    };
  }

  return {
    ...base,
    ok: true,
    ownerWindmillId: marketCheck.ownerWindmillId,
  };
}
