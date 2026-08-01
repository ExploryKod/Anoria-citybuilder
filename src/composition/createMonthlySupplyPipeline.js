import { createSupplyMonthlyFoodSystem } from '../contexts/supply/infrastructure/runtime/supplyMonthlyFoodSystem.js';

/**
 * Composition root — monthly Supply Chain tick (food v1).
 *
 * @param {object} deps
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {import('../shared/time/TimeManager.js').TimeManager} deps.timeManager
 * @param {typeof import('../js/acl/supply.js').toSupplySeason} deps.toSupplySeason
 * @param {typeof import('../js/acl/supply.js').toSupplyMonth} deps.toSupplyMonth
 * @param {number} [deps.foodDistributionDistance=5]
 */
export function createMonthlySupplyPipeline({
  supply,
  timeManager,
  toSupplySeason,
  toSupplyMonth,
  foodDistributionDistance = 5,
}) {
  if (!supply?.runMonthlyFoodSupplyCycle) {
    throw new Error('createMonthlySupplyPipeline: supply context required');
  }

  const runMonthlyFood = createSupplyMonthlyFoodSystem({
    supply,
    timeManager,
    toSupplySeason,
    toSupplyMonth,
    foodDistributionDistance,
  });

  return {
    runMonthly: runMonthlyFood,
  };
}
