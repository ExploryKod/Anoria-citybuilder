import { canPlaceBuildingAtTile } from '../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';
import { canPlaceBuildingAt } from '../contexts/supply/domain/policies/PlacementRequirementPolicy.js';
import { getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import {
  getSupplyPlacementHubs,
  getSupplyPlacementNaturalResources,
} from '../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';

/** How many buildings of each type the hamlet holds (one per instance, whatever its footprint). */
function placedCountsOf(city) {
  const instances = new Map();
  for (const column of city.tiles ?? []) {
    for (const tile of column ?? []) {
      if (tile?.buildingId && tile.instanceId) instances.set(tile.instanceId, tile.buildingId);
    }
  }
  const counts = new Map();
  for (const type of instances.values()) counts.set(type, (counts.get(type) ?? 0) + 1);
  return counts;
}

/**
 * Two facts of the catalog about how many of a building the hamlet holds: `requiresPlaced` (other types that must be there first: every
 * house waits for the mayor's house) and `maxPerHamlet` (the mayor's house is unique). The hamlet is scanned only for a type that declares one.
 * @returns {'building_missing' | 'building_limit' | null} why the placement is refused, or null
 */
function placedCountRefusal(city, buildingType) {
  const definition = getBuildingDefinition(buildingType);
  const required = definition?.requiresPlaced ?? [];
  const limit = definition?.maxPerHamlet;
  if (required.length === 0 && limit === undefined) return null;
  const counts = placedCountsOf(city);
  if (required.some((type) => (counts.get(type) ?? 0) === 0)) return 'building_missing';
  if (limit !== undefined && (counts.get(buildingType) ?? 0) >= limit) return 'building_limit';
  return null;
}

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

  const countRefusal = placedCountRefusal(params.city, params.buildingType);
  if (countRefusal) {
    return { ...base, ok: false, reason: countRefusal };
  }

  const requirementCheck = canPlaceBuildingAt({
    x: params.x,
    y: params.y,
    buildingType: params.buildingType,
    candidates: getSupplyPlacementHubs(),
    naturalCandidates: getSupplyPlacementNaturalResources(),
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
