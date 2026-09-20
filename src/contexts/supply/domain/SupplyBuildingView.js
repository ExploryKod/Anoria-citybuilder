import { createSupplyStock } from './value-objects/SupplyStock.js';

/**
 * Read-side model for Supply UI queries (richer than command snapshot).
 */
export function createSupplyBuildingView({
  id,
  type = '',
  x = null,
  y = null,
  roadCount = 0,
  stocks = {},
  maxStock,
  neighbors = [],
  pop = 0,
  isBuying = false,
  noSourcesNearby = false,
  distributorTooFar = false,
  isCollecting = false,
  collectedByHub = false,
  lastCollection = null,
  lastImport = null,
  lastImportDetails = null,
  salesToDistributor = [],
  salesToHub = [],
  /** @deprecated until Commerce BC — hub export UI flags */
  isActive = true,
  /** @deprecated until Commerce BC — hub export UI flags */
  commercializeEnabled = true,
  supplyHubId = null,
  linkedDistributors = [],
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('SupplyBuildingView: id is required');
  }

  const stock = createSupplyStock(stocks);
  // The catalog-derived shape only — no good is added by name here.
  const presentationStocks = Object.freeze({ ...stock });

  return Object.freeze({
    id,
    type: typeof type === 'string' ? type : '',
    x: typeof x === 'number' && Number.isFinite(x) ? x : null,
    y: typeof y === 'number' && Number.isFinite(y) ? y : null,
    roadCount: Number.isInteger(roadCount) ? roadCount : Number(roadCount) || 0,
    pop: Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0,
    stocks: presentationStocks,
    maxStock:
      Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : Infinity,
    neighbors: Object.freeze(Array.isArray(neighbors) ? [...neighbors] : []),
    isBuying: isBuying === true,
    noSourcesNearby: noSourcesNearby === true,
    distributorTooFar: distributorTooFar === true,
    isCollecting: isCollecting === true,
    collectedByHub: collectedByHub === true,
    lastCollection: lastCollection ? Object.freeze({ ...lastCollection }) : null,
    lastImport: lastImport ? Object.freeze({ ...lastImport }) : null,
    lastImportDetails: lastImportDetails
      ? Object.freeze({ ...lastImportDetails })
      : null,
    salesToDistributor: Object.freeze(
      Array.isArray(salesToDistributor) ? salesToDistributor.map((s) => ({ ...s })) : []
    ),
    salesToHub: Object.freeze(
      Array.isArray(salesToHub)
        ? salesToHub.map((s) => ({ ...s }))
        : []
    ),
    isActive: isActive !== false,
    commercializeEnabled: commercializeEnabled !== false,
    supplyHubId:
      typeof supplyHubId === 'string' && supplyHubId.length > 0
        ? supplyHubId
        : null,
    linkedDistributors: Object.freeze(
      Array.isArray(linkedDistributors)
        ? linkedDistributors.map((entry) =>
            Object.freeze({
              distributorId: entry.distributorId,
              x: entry.x,
              y: entry.y,
              allocatedStocks: Object.freeze({ ...entry.allocatedStocks }),
            })
          )
        : []
    ),
  });
}

function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
