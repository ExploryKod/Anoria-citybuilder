import {
  isMarketBuildingType,
  isWindmillBuildingType,
} from '../../../../shared/building-catalog/BuildingSupplyTypes.js';
import { instanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/** @type {Array<{ id: string, x: number, y: number, roadCount: number, linkedMarkets: object[] }>} */
let windmills = [];

/** @type {Array<{ id: string, x: number, y: number, supplyWindmillId: string | null }>} */
let markets = [];

/**
 * @param {object[]} rows - Dexie building rows
 */
export function refreshSupplyPlacementIndex(rows = []) {
  windmills = rows
    .filter((row) => isWindmillBuildingType(row.type))
    .map((row) => ({
      id: instanceIdFromHouseRow(row),
      x: row.x ?? 0,
      y: row.y ?? 0,
      roadCount: row.roads ?? 0,
      linkedMarkets: row.linkedMarkets ?? [],
    }));

  markets = rows
    .filter((row) => isMarketBuildingType(row.type))
    .map((row) => ({
      id: instanceIdFromHouseRow(row),
      x: row.x ?? 0,
      y: row.y ?? 0,
      supplyWindmillId: row.supplyWindmillId ?? null,
    }));
}

export function getSupplyPlacementWindmills() {
  return windmills;
}

export function getSupplyPlacementMarkets() {
  return markets;
}

export function hasSupplyPlacementWindmill() {
  return windmills.length > 0;
}

/** @internal Tests only */
export function resetSupplyPlacementIndexForTests() {
  windmills = [];
  markets = [];
}
