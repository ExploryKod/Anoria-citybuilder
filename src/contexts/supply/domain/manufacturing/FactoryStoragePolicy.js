import { getFactoryMaxStorage } from './ProductRecipeCatalog.js';

const REFINED_STORAGE_ALIASES = Object.freeze({
  logs: 'wood',
  refinedGold: 'gold',
  refinedClay: 'clay',
  refinedIron: 'iron',
});

/**
 * @param {string} resourceType
 */
export function factoryMaxStorage(resourceType) {
  const key = REFINED_STORAGE_ALIASES[resourceType] ?? resourceType;
  return getFactoryMaxStorage(key);
}

/**
 * @param {number} allocatedWorkers
 * @param {number} [maxWorkersPerProduct=2]
 */
export function workerProductionPercentage(allocatedWorkers, maxWorkersPerProduct = 2) {
  const workers = Number.isFinite(allocatedWorkers) ? allocatedWorkers : 0;
  const max = maxWorkersPerProduct > 0 ? maxWorkersPerProduct : 2;
  return Math.floor((workers / max) * 100);
}

/**
 * @param {object} recipe
 * @param {object} availableMaterials
 */
export function canProduceFromRecipe(recipe, availableMaterials) {
  for (const [material, amount] of Object.entries(recipe)) {
    if ((availableMaterials[material] || 0) < amount) return false;
  }
  return true;
}
