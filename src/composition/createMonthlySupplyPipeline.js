import { createSupplyMonthlyResourceSystem } from '../contexts/supply/infrastructure/runtime/supplyMonthlyResourceSystem.js';

/**
 * Composition root — monthly Supply Chain tick (food v1).
 *
 * @param {object} deps
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {import('../shared/time/TimeManager.js').TimeManager} deps.timeManager
 * @param {typeof import('./supplyTimeLabels.js').toSupplySeason} deps.toSupplySeason
 * @param {typeof import('./supplyTimeLabels.js').toSupplyMonth} deps.toSupplyMonth
 */
export function createMonthlySupplyPipeline({
  supply,
  timeManager,
  toSupplySeason,
  toSupplyMonth,
}) {
  if (!supply?.runMonthlyResourceCycle) {
    throw new Error('createMonthlySupplyPipeline: supply context required');
  }

  const runMonthlyResourceCycle = createSupplyMonthlyResourceSystem({
    supply,
    timeManager,
    toSupplySeason,
    toSupplyMonth,
  });

  return {
    runMonthly: runMonthlyResourceCycle,
  };
}
