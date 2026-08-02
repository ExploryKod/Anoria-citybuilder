import {
  createEmptyCommerceStocks,
  BARN_COMMERCE_PRODUCTS,
  BARN_UNITS_PER_WORKER,
  BARN_MAX_TOTAL_CAPACITY,
  getBarnMaxWorkers,
  getBarnCapacityForWorkerCount,
} from '../catalogs/BarnCommerceCatalog.js';

/**
 * @param {object|null|undefined} barnRow
 */
export function getBarnWorkerCount(barnRow) {
  return Math.max(0, barnRow?.employees?.worker ?? 0);
}

/**
 * Workers counted toward storage capacity (capped at derived barn max).
 *
 * @param {object|null|undefined} barnRow
 */
export function getEffectiveBarnWorkers(barnRow) {
  return Math.min(getBarnWorkerCount(barnRow), getBarnMaxWorkers());
}

/**
 * Total units the barn can store (all goods combined).
 *
 * @param {object|null|undefined} barnRow
 */
export function getBarnTotalCapacity(barnRow) {
  return getBarnCapacityForWorkerCount(getBarnWorkerCount(barnRow));
}

/**
 * @param {Record<string, number>|null|undefined} stocks
 */
export function getBarnTotalStock(stocks) {
  const normalized = createEmptyCommerceStocks(stocks);
  return BARN_COMMERCE_PRODUCTS.reduce(
    (sum, productId) => sum + (normalized[productId] ?? 0),
    0
  );
}

/**
 * @param {object|null|undefined} barnRow
 * @param {Record<string, number>|null|undefined} stocks
 */
export function getBarnRemainingCapacity(barnRow, stocks) {
  return Math.max(0, getBarnTotalCapacity(barnRow) - getBarnTotalStock(stocks));
}

/**
 * @param {Record<string, number>|null|undefined} stocks
 * @param {string} productId
 */
export function getBarnProductStock(stocks, productId) {
  const normalized = createEmptyCommerceStocks(stocks);
  return normalized[productId] ?? 0;
}

/**
 * @param {object|null|undefined} barnRow
 * @param {Record<string, number>|null|undefined} stocks
 * @param {string} productId
 * @param {number} quantity
 */
export function canCreditBarnStock(barnRow, stocks, productId, quantity) {
  if (quantity <= 0) return false;
  return quantity <= getBarnRemainingCapacity(barnRow, stocks);
}

/**
 * @param {Record<string, number>|null|undefined} stocks
 * @param {string} productId
 * @param {number} quantity
 */
export function canDebitBarnStock(stocks, productId, quantity) {
  if (quantity <= 0) return false;
  return getBarnProductStock(stocks, productId) >= quantity;
}

/**
 * @param {object|null|undefined} barnRow
 * @param {Record<string, number>|null|undefined} stocks
 * @param {string} productId
 * @param {number} quantity
 */
export function creditBarnStock(barnRow, stocks, productId, quantity) {
  if (!canCreditBarnStock(barnRow, stocks, productId, quantity)) {
    return null;
  }
  const next = createEmptyCommerceStocks(stocks);
  next[productId] = (next[productId] ?? 0) + quantity;
  return next;
}

/**
 * @param {Record<string, number>|null|undefined} stocks
 * @param {string} productId
 * @param {number} quantity
 */
export function debitBarnStock(stocks, productId, quantity) {
  if (!canDebitBarnStock(stocks, productId, quantity)) {
    return null;
  }
  const next = createEmptyCommerceStocks(stocks);
  next[productId] = Math.max(0, (next[productId] ?? 0) - quantity);
  return next;
}

/**
 * @param {object|null|undefined} barnRow
 */
export function isOperationalCommerceBarn(barnRow) {
  if (!barnRow) return false;
  const type = barnRow.type || '';
  if (!type.includes('Barn')) return false;
  if (barnRow.isActive === false) return false;
  if ((barnRow.roads ?? 0) <= 0) return false;
  return getBarnWorkerCount(barnRow) > 0;
}

/**
 * @param {object|null|undefined} barnRow
 * @param {Record<string, number>|null|undefined} stocks
 */
export function getBarnCapacitySummary(barnRow, stocks) {
  const workers = getBarnWorkerCount(barnRow);
  const maxTotal = getBarnTotalCapacity(barnRow);
  const currentTotal = getBarnTotalStock(stocks);
  return {
    workers,
    maxWorkers: getBarnMaxWorkers(),
    maxTotal,
    maxGoods: BARN_MAX_TOTAL_CAPACITY,
    currentTotal,
    remainingTotal: Math.max(0, maxTotal - currentTotal),
    unitsPerWorker: BARN_UNITS_PER_WORKER,
  };
}
