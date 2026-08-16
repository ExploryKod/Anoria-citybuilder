/**
 * HUD resource read models — city (mills + city barns) vs commerce barns.
 * Composition-only: reads Dexie directly (BC supply repos are active-hamlet only).
 */

import db from '../core/persistence/dexie/db.js';
import { hamletIdOf, getActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import {
  BARN_COMMERCE_PRODUCTS,
  createEmptyCommerceStocks,
} from '../contexts/supply/domain/catalogs/BarnCommerceCatalog.js';
import {
  isCityBarn,
  isCommerceBarn,
} from '../contexts/supply/domain/manufacturing/SupplyFlow.js';
import { createFoodStock } from '../contexts/supply/domain/value-objects/FoodStock.js';

/** City granary crops shown in the ressources rail (moulins + granges ville). */
export const HUD_CITY_RESOURCE_PRODUCTS = Object.freeze(['wheat', 'carrot', 'cabbage']);

/** @readonly */
export const HUD_RESOURCE_DESTINATIONS = Object.freeze({
  city: 'city',
  commerce: 'commerce',
});

/**
 * @param {object} row
 * @returns {boolean}
 */
export function isHudBarnRow(row) {
  const type = String(row?.type || '');
  return type.includes('Barn') || type === 'Barn-001';
}

/**
 * @param {object} row
 * @returns {boolean}
 */
export function isHudWindmillRow(row) {
  const type = String(row?.type || '');
  return type.includes('Windmill') || type.includes('windmill');
}

/**
 * Food stock for the city destination: windmills and city-dedicated barns.
 *
 * @param {object} row
 * @returns {boolean}
 */
export function isHudCityFoodStorageRow(row) {
  if (isHudWindmillRow(row)) return true;
  return isHudBarnRow(row) && isCityBarn(row);
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
 * @param {ReadonlyArray<object>} rows
 * @returns {Record<string, number>}
 */
export function sumCityStocksFromRows(rows) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(HUD_CITY_RESOURCE_PRODUCTS.map((id) => [id, 0]));
  for (const row of rows) {
    if (!isHudCityFoodStorageRow(row)) continue;
    const stocks = createFoodStock(row.stocks || {});
    for (const id of HUD_CITY_RESOURCE_PRODUCTS) {
      totals[id] += Math.max(0, Math.floor(stocks[id]) || 0);
    }
  }
  return totals;
}

/**
 * Commerce barns only (legacy barns without supplyFlow count as commerce).
 *
 * @param {ReadonlyArray<object>} rows
 * @returns {Record<string, number>}
 */
export function sumCommerceStocksFromRows(rows) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(BARN_COMMERCE_PRODUCTS.map((id) => [id, 0]));
  for (const row of rows) {
    if (!isHudBarnRow(row) || !isCommerceBarn(row)) continue;
    const stocks = createEmptyCommerceStocks(row.commerceStocks || {});
    for (const id of BARN_COMMERCE_PRODUCTS) {
      totals[id] += Math.max(0, Math.floor(stocks[id]) || 0);
    }
  }
  return totals;
}

/**
 * @param {Record<string, number>} stocks
 * @returns {number}
 */
export function sumStockValues(stocks) {
  return Object.values(stocks || {}).reduce(
    (sum, value) => sum + Math.max(0, Math.floor(value) || 0),
    0
  );
}

/**
 * @param {'country' | 'active' | string} [scope='active']
 * @returns {Promise<{
 *   city: Record<string, number>,
 *   commerce: Record<string, number>,
 *   cityTotal: number,
 *   commerceTotal: number,
 * }>}
 */
export async function getHudResourceScopeSnapshot(scope = 'active') {
  const rows = (await db.houses.toArray()).filter((row) => rowMatchesScope(row, scope));
  const city = sumCityStocksFromRows(rows);
  const commerce = sumCommerceStocksFromRows(rows);
  return {
    city,
    commerce,
    cityTotal: sumStockValues(city),
    commerceTotal: sumStockValues(commerce),
  };
}
