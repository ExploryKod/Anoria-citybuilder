/**
 * HUD resource read models — city food storage and map nature deposits.
 * Composition-only: reads Dexie directly (BC supply repos are active-hamlet only).
 */

import db from '../core/persistence/dexie/db.js';
import { hamletIdOf, getActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import { getSuppliedCategories } from '../shared/building-catalog/resourceRoleQueries.js';
import { depositKindsOf, listDepositKinds, listTileDeposits } from '../shared/building-catalog/depositQueries.js';
import { hasResourceRole } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { createSupplyStock } from '../contexts/supply/domain/value-objects/SupplyStock.js';

/** Goods the citizens eat that a hub stores, shown in the city block — derived from the catalog. */
export const HUD_CITY_FOOD_PRODUCTS = getSuppliedCategories();

/** All product keys rendered in the city block. */
export const HUD_CITY_RESOURCE_PRODUCTS = Object.freeze([...HUD_CITY_FOOD_PRODUCTS]);

/** Map deposits (trees, boulders, the clay of the ground…) — every kind the catalog declares. */
export const HUD_NATURE_RESOURCE_PRODUCTS = Object.freeze(listDepositKinds());

/** @readonly */
export const HUD_RESOURCE_DESTINATIONS = Object.freeze({
  city: 'city',
  nature: 'nature',
});

/**
 * Whether a row is a hub of the goods the citizens eat (what the city block counts): decided by its role in the
 * catalog, not by its name.
 * @param {object} row
 * @returns {boolean}
 */
export function isHudCityHubRow(row) {
  return hasResourceRole(String(row?.type || ''), 'hub', HUD_CITY_FOOD_PRODUCTS);
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
    if (!isHudCityHubRow(row)) continue;
    const food = createSupplyStock(row.stocks || {});
    for (const id of HUD_CITY_FOOD_PRODUCTS) {
      totals[id] += stockAmount(food[id]);
    }
  }

  return totals;
}

/**
 * Deposits held by nature buildings: each row counts, for every kind of deposit its type holds (the catalog's
 * `naturalResource` and `deposits`), what its `stocks` says of it. The ground's own deposits (clay) are counted
 * separately, from the tiles, by {@link countDepositTiles}.
 *
 * @param {ReadonlyArray<object>} rows
 * @returns {Record<string, number>}
 */
export function sumNatureStocksFromRows(rows) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(HUD_NATURE_RESOURCE_PRODUCTS.map((id) => [id, 0]));

  for (const row of rows) {
    if (!isHudNatureRow(row)) continue;
    const stocks = row.stocks || {};
    for (const kind of depositKindsOf(String(row.type || ''))) {
      totals[kind] += stockAmount(stocks[kind]);
    }
  }

  return totals;
}

/**
 * Tiles of the map whose ground carries a kind of deposit (not a Dexie nature building).
 *
 * @param {object | null | undefined} city
 * @param {string} kind
 * @returns {number}
 */
export function countDepositTiles(city, kind) {
  const tiles = city?.tiles;
  const size = Math.max(0, Math.floor(Number(city?.size) || 0));
  if (!Array.isArray(tiles) || size <= 0) return 0;

  let count = 0;
  for (let x = 0; x < size; x++) {
    const column = tiles[x];
    if (!column) continue;
    for (let y = 0; y < size; y++) {
      if (column[y]?.deposits?.[kind]) count += 1;
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
  // The ground's deposits are map-global (not tagged per hamlet) — same count for country & active.
  for (const { kind } of listTileDeposits()) nature[kind] = countDepositTiles(options.city, kind);
  return {
    nature,
    natureTotal: sumStockValues(nature),
  };
}
