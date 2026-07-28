import { CROPS } from './CropType.js';

/**
 * Building food stock (baskets per crop + total food).
 *
 * @param {object} [raw]
 * @returns {Readonly<{ wheat: number, carrot: number, cabbage: number, food: number }>}
 */
export function createFoodStock(raw = {}) {
  const wheat = nonNegInt(raw.wheat);
  const carrot = nonNegInt(raw.carrot);
  const cabbage = nonNegInt(raw.cabbage);
  const explicitFood = raw.food;
  const food =
    explicitFood === undefined || explicitFood === null
      ? wheat + carrot + cabbage
      : nonNegInt(explicitFood);

  return Object.freeze({ wheat, carrot, cabbage, food });
}

export function emptyFoodStock() {
  return createFoodStock();
}

/**
 * @param {ReturnType<typeof createFoodStock>} stock
 * @param {import('./CropType.js').Crop} crop
 */
export function getCropAmount(stock, crop) {
  return stock?.[crop] ?? 0;
}

/**
 * Remove baskets of a crop; sync `food` downward.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function takeCrop(stock, crop, amount) {
  const n = nonNegInt(amount);
  const current = getCropAmount(stock, crop);
  const taken = Math.min(current, n);
  return createFoodStock({
    ...stock,
    [crop]: current - taken,
    food: Math.max(0, (stock.food || 0) - taken),
  });
}

/**
 * Add baskets of a crop; sync `food` upward (caller may cap separately).
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function addCrop(stock, crop, amount) {
  const n = nonNegInt(amount);
  return createFoodStock({
    ...stock,
    [crop]: getCropAmount(stock, crop) + n,
    food: (stock.food || 0) + n,
  });
}

/**
 * Cap total food at maxStock; scale crops down proportionally if needed.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function capStockAt(stock, maxStock) {
  const cap = nonNegInt(maxStock);
  if (stock.food <= cap) {
    return createFoodStock(stock);
  }

  const totalCrops = CROPS.reduce((sum, crop) => sum + getCropAmount(stock, crop), 0);
  if (totalCrops <= 0) {
    return createFoodStock({ ...stock, food: cap });
  }

  const factor = cap / stock.food;
  const next = { wheat: 0, carrot: 0, cabbage: 0 };
  for (const crop of CROPS) {
    next[crop] = Math.round(getCropAmount(stock, crop) * factor);
  }
  return createFoodStock({ ...next, food: cap });
}

function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
