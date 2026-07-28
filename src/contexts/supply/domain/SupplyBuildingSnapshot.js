import { createFoodStock } from './value-objects/FoodStock.js';

/**
 * Read model for Supply use cases.
 */
export function createSupplyBuildingSnapshot({
  id,
  type = '',
  x = null,
  y = null,
  roadCount = 0,
  stocks = {},
  maxStock = 500,
  worker = 0,
  workerNeed = 0,
  neighbors = [],
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('SupplyBuildingSnapshot: id is required');
  }

  return Object.freeze({
    id,
    type: typeof type === 'string' ? type : '',
    x: typeof x === 'number' ? x : null,
    y: typeof y === 'number' ? y : null,
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    stocks: createFoodStock(stocks),
    maxStock: Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : 500,
    worker: Number.isFinite(worker) ? worker : 0,
    workerNeed: Number.isFinite(workerNeed) ? workerNeed : 0,
    neighbors: Object.freeze(Array.isArray(neighbors) ? [...neighbors] : []),
  });
}
