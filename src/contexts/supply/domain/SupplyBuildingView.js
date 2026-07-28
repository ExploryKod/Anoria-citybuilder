import { createFoodStock } from './value-objects/FoodStock.js';

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
  maxStock = 500,
  neighbors = [],
  isBuying = false,
  noFarmsNearby = false,
  marketTooFar = false,
  isCollecting = false,
  soldToWindmill = false,
  lastCollection = null,
  lastImport = null,
  lastImportDetails = null,
  salesToMarket = [],
  salesToWindmill = [],
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('SupplyBuildingView: id is required');
  }

  const food = createFoodStock(stocks);
  const presentationStocks = Object.freeze({
    wheat: food.wheat,
    carrot: food.carrot,
    cabbage: food.cabbage,
    food: food.food,
    dattes: nonNegInt(stocks?.dattes),
    wood: nonNegInt(stocks?.wood),
  });

  return Object.freeze({
    id,
    type: typeof type === 'string' ? type : '',
    x: typeof x === 'number' && Number.isFinite(x) ? x : null,
    y: typeof y === 'number' && Number.isFinite(y) ? y : null,
    roadCount: Number.isInteger(roadCount) ? roadCount : Number(roadCount) || 0,
    stocks: presentationStocks,
    maxStock:
      Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : 500,
    neighbors: Object.freeze(Array.isArray(neighbors) ? [...neighbors] : []),
    isBuying: isBuying === true,
    noFarmsNearby: noFarmsNearby === true,
    marketTooFar: marketTooFar === true,
    isCollecting: isCollecting === true,
    soldToWindmill: soldToWindmill === true,
    lastCollection: lastCollection ? Object.freeze({ ...lastCollection }) : null,
    lastImport: lastImport ? Object.freeze({ ...lastImport }) : null,
    lastImportDetails: lastImportDetails
      ? Object.freeze({ ...lastImportDetails })
      : null,
    salesToMarket: Object.freeze(
      Array.isArray(salesToMarket) ? salesToMarket.map((s) => ({ ...s })) : []
    ),
    salesToWindmill: Object.freeze(
      Array.isArray(salesToWindmill)
        ? salesToWindmill.map((s) => ({ ...s }))
        : []
    ),
  });
}

function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
