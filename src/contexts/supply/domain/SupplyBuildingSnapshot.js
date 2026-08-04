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
  lastProductionYear = null,
  lastConsumptionMonth = null,
  lastSubsistenceMonth = null,
  pop = 0,
  level = 1,
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
    lastProductionYear:
      lastProductionYear === null || lastProductionYear === undefined
        ? null
        : Number.isFinite(lastProductionYear)
          ? Math.floor(lastProductionYear)
          : null,
    lastConsumptionMonth:
      lastConsumptionMonth === null || lastConsumptionMonth === undefined
        ? null
        : Number.isFinite(lastConsumptionMonth)
          ? Math.floor(lastConsumptionMonth)
          : null,
    lastSubsistenceMonth:
      lastSubsistenceMonth === null || lastSubsistenceMonth === undefined
        ? null
        : Number.isFinite(lastSubsistenceMonth)
          ? Math.floor(lastSubsistenceMonth)
          : null,
    pop: Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0,
    // Houses only (1 = autarky). Unused by non-residential buildings.
    level: level === 2 ? 2 : 1,
  });
}
