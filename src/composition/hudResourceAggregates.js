/**
 * HUD resource read models — city food storage and map nature deposits.
 * Composition-only: reads Dexie directly (BC supply repos are active-hamlet only).
 */

import db from '../core/persistence/dexie/db.js';
import { hamletIdOf, getActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import { createFoodStock } from '../contexts/supply/domain/value-objects/FoodStock.js';

/** Food lines shown only in the city block (moulins + granges ville). */
export const HUD_CITY_FOOD_PRODUCTS = Object.freeze(['wheat', 'carrot', 'cabbage']);

/** All product keys rendered in the city block. */
export const HUD_CITY_RESOURCE_PRODUCTS = Object.freeze([...HUD_CITY_FOOD_PRODUCTS]);

/** Map deposits (trees, boulders, clay tiles). */
export const HUD_NATURE_RESOURCE_PRODUCTS = Object.freeze([
  'wood',
  'rock',
  'clay',
  'iron',
  'gold',
]);

/** @readonly */
export const HUD_RESOURCE_DESTINATIONS = Object.freeze({
  city: 'city',
  nature: 'nature',
});

/**
 * @param {object} row
 * @returns {boolean}
 */
export function isHudWindmillRow(row) {
  const type = String(row?.type || '');
  return type.includes('Windmill') || type.includes('windmill');
}

/**
 * @param {object} row
 * @returns {boolean}
 */
export function isHudNatureRow(row) {
  return String(row?.category || '') === 'nature';
}

/**
 * @param {object} row
 * @param {'country' | 'active' | string} scope
 */
function rowMatchesScope(row, scope) {
  if (scope === 'country') return true;
  const hamletId = scope === 'active' ? getActiveHamletId() : scope;
  return hamletIdOf(row) === hamletId;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function stockAmount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/**
 * City destination stocks: food from windmills (`stocks`), wood also
 * counted from windmill `stocks.wood` when present (hub line).
 *
 * @param {ReadonlyArray<object>} rows
 * @returns {Record<string, number>}
 */
export function sumCityStocksFromRows(rows) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(HUD_CITY_RESOURCE_PRODUCTS.map((id) => [id, 0]));

  for (const row of rows) {
    if (!isHudWindmillRow(row)) continue;
    const food = createFoodStock(row.stocks || {});
    for (const id of HUD_CITY_FOOD_PRODUCTS) {
      totals[id] += stockAmount(food[id]);
    }
  }

  return totals;
}

/**
 * Nature deposits on the map (trees → wood, boulders → rock/iron/gold).
 * Clay is tile-based and added separately via {@link countClayTiles}.
 *
 * @param {ReadonlyArray<object>} rows
 * @returns {Record<string, number>}
 */
export function sumNatureStocksFromRows(rows) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(HUD_NATURE_RESOURCE_PRODUCTS.map((id) => [id, 0]));

  for (const row of rows) {
    if (!isHudNatureRow(row)) continue;
    const type = String(row.type || '');
    const stocks = row.stocks || {};

    if (type.includes('Tree')) {
      totals.wood += stockAmount(stocks.wood);
      continue;
    }
    if (type.includes('Boulder')) {
      totals.rock += stockAmount(stocks.rock);
      totals.iron += stockAmount(stocks.iron);
      totals.gold += stockAmount(stocks.gold);
    }
  }

  return totals;
}

/**
 * Clay is flagged on grass tiles (not a Dexie nature building).
 *
 * @param {object | null | undefined} city
 * @returns {number}
 */
export function countClayTiles(city) {
  const tiles = city?.tiles;
  const size = Math.max(0, Math.floor(Number(city?.size) || 0));
  if (!Array.isArray(tiles) || size <= 0) return 0;

  let count = 0;
  for (let x = 0; x < size; x++) {
    const column = tiles[x];
    if (!column) continue;
    for (let y = 0; y < size; y++) {
      if (column[y]?.hasClay) count += 1;
    }
  }
  return count;
}

/**
 * @param {Record<string, number>} stocks
 * @returns {number}
 */
export function sumStockValues(stocks) {
  return Object.values(stocks || {}).reduce((sum, value) => sum + stockAmount(value), 0);
}

/**
 * @param {'country' | 'active' | string} [scope='active']
 * @returns {Promise<{
 *   city: Record<string, number>,
 *   cityTotal: number,
 * }>}
 */
export async function getHudResourceScopeSnapshot(scope = 'active') {
  const rows = (await db.houses.toArray()).filter((row) => rowMatchesScope(row, scope));
  const city = sumCityStocksFromRows(rows);
  return {
    city,
    cityTotal: sumStockValues(city),
  };
}

/**
 * @param {'country' | 'active' | string} [scope='active']
 * @param {{ city?: object | null }} [options]
 * @returns {Promise<{
 *   nature: Record<string, number>,
 *   natureTotal: number,
 * }>}
 */
export async function getHudNatureResourceScopeSnapshot(scope = 'active', options = {}) {
  const rows = (await db.houses.toArray()).filter((row) => rowMatchesScope(row, scope));
  const nature = sumNatureStocksFromRows(rows);
  // Clay tiles are map-global (not tagged per hamlet) — same count for country & active.
  nature.clay = countClayTiles(options.city);
  return {
    nature,
    natureTotal: sumStockValues(nature),
  };
}
