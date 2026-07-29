import { World } from '../engine/ecs/World.js';
import { Pipeline } from '../engine/loop/Pipeline.js';
import { createParcelsRoadAccessSystem } from '../contexts/parcels/infrastructure/runtime/parcelsRoadAccessSystem.js';
import { createSupplyMonthlyFoodSystem } from '../contexts/supply/infrastructure/runtime/supplyMonthlyFoodSystem.js';
import { createHousingPopulationGrowthSystem } from '../contexts/housing/infrastructure/runtime/housingPopulationGrowthSystem.js';
import { createHousingEvolutionSystem } from '../contexts/housing/infrastructure/runtime/housingEvolutionSystem.js';
import { createFactoryProductionSystem } from '../contexts/supply/infrastructure/runtime/supplyFactoryProductionSystem.js';

/**
 * Composition root du runtime ECS (engine + systèmes minces).
 * Les BC restent owners métier ; le pipeline orchestre quand ils tournent.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createParcelsContext.js').createParcelsContext>} deps.parcels
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {ReturnType<import('./createHousingContext.js').createHousingContext>} deps.housing
 * @param {import('../js/game/utils/TimeManager.js').TimeManager} deps.timeManager
 * @param {Function} deps.toSupplySeason
 * @param {Function} deps.toSupplyMonth
 * @param {number} [deps.foodDistributionDistance=5]
 */
export function createGameRuntime({
  parcels,
  supply,
  housing,
  timeManager,
  toSupplySeason,
  toSupplyMonth,
  foodDistributionDistance = 5,
}) {
  if (!parcels) {
    throw new Error('createGameRuntime: parcels context required');
  }
  if (!supply) {
    throw new Error('createGameRuntime: supply context required');
  }
  if (!housing) {
    throw new Error('createGameRuntime: housing context required');
  }

  const world = new World();
  const pipeline = new Pipeline();

  const supplyMonthlyFood = createSupplyMonthlyFoodSystem({
    supply,
    timeManager,
    toSupplySeason,
    toSupplyMonth,
    foodDistributionDistance,
  });
  const housingPopulationGrowth = createHousingPopulationGrowthSystem({
    housing,
    timeManager,
  });
  const housingEvolution = createHousingEvolutionSystem({ housing });
  const supplyFactoryProduction = createFactoryProductionSystem({ supply });

  pipeline
    .group('simulation')
    .register('parcels.roadAccess', createParcelsRoadAccessSystem(parcels))
    .register('supply.monthlyFood', supplyMonthlyFood)
    .register('housing.populationGrowth', housingPopulationGrowth)
    .register('housing.evolution', housingEvolution)
    .register('supply.factoryProduction', supplyFactoryProduction);

  return {
    world,
    pipeline,

    /**
     * Un tick de simulation ECS (groupe `simulation`).
     * @param {{ city?: object, housesStore?: object, time?: number }} [context]
     */
    async runSimulation(context = {}) {
      await pipeline.runGroup('simulation', world, context);
    },
  };
}
