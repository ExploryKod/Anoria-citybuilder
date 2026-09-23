import { hasResourceRole } from '../../domain/policies/ResourceRolePolicy.js';
import { getNaturalResourceKind } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Live index of placed buildings relevant to placement-requirement checks
 * (canPlaceBuildingAtTileWithSupplyRules) and link maintenance
 * (syncSupplyLinksAfterBuildingChange). Generic — indexes by catalog role
 * ('hub', 'distributor'), not a hardcoded windmill/market type check, so a
 * future hub type (warehouse, granary, ...) needs no new index.
 *
 * @type {Array<{ id: string, type: string, x: number, y: number, roadCount: number, linkedDistributors: object[] }>}
 */
let hubs = [];

/** @type {Array<{ id: string, type: string, x: number, y: number, supplyHubId: string | null }>} */
let distributors = [];

/**
 * Placed natural resources (trees, ...) — what a raw-material producer's
 * `source` catalog fact is matched against, at placement time.
 * @type {Array<{ id: string, type: string, x: number, y: number }>}
 */
let naturalResources = [];

/**
 * @param {object[]} rows - Dexie building rows
 */
export function refreshSupplyPlacementIndex(rows = []) {
  hubs = rows
    .filter((row) => hasResourceRole(row.type, 'hub'))
    .map((row) => ({
      id: instanceIdFromHouseRow(row),
      type: row.type,
      x: row.x ?? 0,
      y: row.y ?? 0,
      roadCount: row.roads ?? 0,
      linkedDistributors: row.linkedDistributors ?? [],
    }));

  naturalResources = rows
    .filter((row) => getNaturalResourceKind(row.type) && row.x != null && row.y != null)
    .map((row) => ({ id: instanceIdFromHouseRow(row), type: row.type, x: row.x, y: row.y }));

  distributors = rows
    .filter((row) => hasResourceRole(row.type, 'distributor'))
    .map((row) => ({
      id: instanceIdFromHouseRow(row),
      type: row.type,
      x: row.x ?? 0,
      y: row.y ?? 0,
      supplyHubId: row.supplyHubId ?? null,
    }));
}

export function getSupplyPlacementHubs() {
  return hubs;
}

export function getSupplyPlacementNaturalResources() {
  return naturalResources;
}

export function getSupplyPlacementDistributors() {
  return distributors;
}

export function hasSupplyPlacementHub() {
  return hubs.length > 0;
}

/** @internal Tests only */
export function resetSupplyPlacementIndexForTests() {
  hubs = [];
  distributors = [];
}
