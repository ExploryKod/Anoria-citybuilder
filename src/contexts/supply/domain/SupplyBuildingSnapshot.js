import { createSupplyStock } from './value-objects/SupplyStock.js';

/**
 * Read model for Supply use cases.
 *
 * Any field beyond the named ones below (`...rest`) passes through as-is —
 * this is what lets a catalog-declared `periodLock`/`hubLink` field name
 * (see PeriodLockPolicy.js / ResourceRolePolicy.getHubLinkForRole) survive a
 * read without this file needing to know that field name exists. Only
 * fields this read model actually validates/coerces are named explicitly.
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
  supplyHubId = null,
  linkedDistributors = [],
  ...rest
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('SupplyBuildingSnapshot: id is required');
  }

  return Object.freeze({
    ...rest,
    id,
    type: typeof type === 'string' ? type : '',
    x: typeof x === 'number' ? x : null,
    y: typeof y === 'number' ? y : null,
    roadCount: Number.isInteger(roadCount) ? roadCount : 0,
    stocks: createSupplyStock(stocks),
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
    // `...lastConsumption` passthrough first — same fix as `servedFlags`
    // (see PeriodLockPolicy.js docs): a field this constructor doesn't name
    // explicitly (e.g. `categoriesTaken`, added for diet-variety tracking)
    // must still round-trip, not silently vanish on next read.
    lastConsumption: lastConsumption
      ? Object.freeze({
          ...lastConsumption,
          month: Number.isFinite(lastConsumption.month) ? Math.floor(lastConsumption.month) : 0,
          demand: Number.isFinite(lastConsumption.demand) ? lastConsumption.demand : 0,
          taken: Number.isFinite(lastConsumption.taken) ? lastConsumption.taken : 0,
          totalUnfed: Number.isFinite(lastConsumption.totalUnfed) ? lastConsumption.totalUnfed : 0,
        })
      : null,
    pop: Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0,
    // Houses only (1 = autarky). Unused by non-residential buildings.
    level: Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1,
    supplyHubId:
      typeof supplyHubId === 'string' && supplyHubId.length > 0
        ? supplyHubId
        : null,
    linkedDistributors: Object.freeze(
      Array.isArray(linkedDistributors)
        ? linkedDistributors.map((entry) =>
            Object.freeze({
              distributorId: entry.distributorId,
              x: Number.isFinite(entry.x) ? Math.floor(entry.x) : 0,
              y: Number.isFinite(entry.y) ? Math.floor(entry.y) : 0,
              allocatedStocks: Object.freeze({ ...entry.allocatedStocks }),
            })
          )
        : []
    ),
  });
}
