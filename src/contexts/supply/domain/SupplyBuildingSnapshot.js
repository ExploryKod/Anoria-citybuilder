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
  lastConsumption = null,
  pop = 0,
  level = 1,
  supplyWindmillId = null,
  linkedMarkets = [],
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
    lastConsumption: lastConsumption
      ? Object.freeze({
          month: Number.isFinite(lastConsumption.month) ? Math.floor(lastConsumption.month) : 0,
          consumed: Object.freeze({ ...lastConsumption.consumed }),
          demanded: Object.freeze({ ...lastConsumption.demanded }),
          unfed: Object.freeze({ ...lastConsumption.unfed }),
          totalUnfed: Number.isFinite(lastConsumption.totalUnfed) ? lastConsumption.totalUnfed : 0,
        })
      : null,
    pop: Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0,
    // Houses only (1 = autarky). Unused by non-residential buildings.
    level: level === 2 ? 2 : 1,
    supplyWindmillId:
      typeof supplyWindmillId === 'string' && supplyWindmillId.length > 0
        ? supplyWindmillId
        : null,
    linkedMarkets: Object.freeze(
      Array.isArray(linkedMarkets)
        ? linkedMarkets.map((entry) =>
            Object.freeze({
              marketId: entry.marketId,
              x: Number.isFinite(entry.x) ? Math.floor(entry.x) : 0,
              y: Number.isFinite(entry.y) ? Math.floor(entry.y) : 0,
              allocatedStocks: Object.freeze({
                wheat: Math.max(0, Math.floor(entry.allocatedStocks?.wheat ?? 0)),
                carrot: Math.max(0, Math.floor(entry.allocatedStocks?.carrot ?? 0)),
                cabbage: Math.max(0, Math.floor(entry.allocatedStocks?.cabbage ?? 0)),
              }),
            })
          )
        : []
    ),
  });
}
