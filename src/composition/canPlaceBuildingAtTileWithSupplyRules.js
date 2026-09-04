import { canPlaceBuildingAtTile } from '../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';
import { canPlaceBuildingAt } from '../contexts/supply/domain/policies/PlacementRequirementPolicy.js';
import { getSupplyPlacementHubs } from '../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';

/**
 * Footprint + supply placement-requirement gate (sync, for ghost preview).
 * Generic — driven by the building's own `placementRequires` catalog fact
 * (see buildingCatalog.js / PlacementRequirementPolicy.js), not a hardcoded
 * "is this a market" check. A type with no requirement just passes through.
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

  const requirementCheck = canPlaceBuildingAt({
    x: params.x,
    y: params.y,
    buildingType: params.buildingType,
    candidates: getSupplyPlacementHubs(),
  });

  if (!requirementCheck.ok) {
    return {
      ...base,
      ok: false,
      reason: requirementCheck.reason,
    };
  }

  return {
    ...base,
    ok: true,
    ownerWindmillId: requirementCheck.ownerId,
  };
}
