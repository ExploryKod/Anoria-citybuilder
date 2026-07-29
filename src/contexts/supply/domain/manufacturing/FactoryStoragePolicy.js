import config from '../../../../js/game/config.js';

/**
 * @param {string} resourceType
 */
export function factoryMaxStorage(resourceType) {
  if (resourceType === 'logs') {
    return config.factoryMaxStorage?.wood || 200;
  }
  if (resourceType === 'refinedGold') {
    return config.factoryMaxStorage?.gold || 200;
  }
  if (resourceType === 'refinedClay') {
    return config.factoryMaxStorage?.clay || 200;
  }
  if (resourceType === 'refinedIron') {
    return config.factoryMaxStorage?.iron || 200;
  }
  return config.factoryMaxStorage?.[resourceType] || 200;
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
