import { World } from '../engine/ecs/World.js';
import { Pipeline } from '../engine/loop/Pipeline.js';
import { createParcelsRoadAccessSystem } from '../contexts/parcels/infrastructure/runtime/parcelsRoadAccessSystem.js';
import { createSupplyMonthlyResourceSystem } from '../contexts/supply/infrastructure/runtime/supplyMonthlyResourceSystem.js';
import { createHousingPopulationGrowthSystem } from '../contexts/housing/infrastructure/runtime/housingPopulationGrowthSystem.js';
import { createHousingEvolutionSystem } from '../contexts/housing/infrastructure/runtime/housingEvolutionSystem.js';
import { createEmploymentRedistributeSystem } from '../contexts/employment/infrastructure/runtime/employmentRedistributeSystem.js';
import { createRandomEventsSystem } from '../contexts/gameplay/infrastructure/runtime/randomEventsSystem.js';
import { createIntelligenceMonthlyNewsSystem } from '../contexts/intelligence/infrastructure/runtime/intelligenceMonthlyNewsSystem.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { isLoseMode } from '../config/loseMode.js';
import { recordDeaths } from './gameplayMortalityState.js';
import { getSharedEventBus } from './sharedEventBus.js';
import { TimeManager } from '../shared/time/TimeManager.js';

/**
 * Composition root du runtime ECS (engine + systèmes minces).
 * Les BC restent owners métier ; le pipeline orchestre quand ils tournent.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createParcelsContext.js').createParcelsContext>} deps.parcels
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} deps.supply
 * @param {ReturnType<import('./createHousingContext.js').createHousingContext>} deps.housing
 * @param {ReturnType<import('./createEmploymentContext.js').createEmploymentContext>} deps.employment
 * @param {ReturnType<import('./createGameplayContext.js').createGameplayContext>} deps.gameplay
 * @param {ReturnType<import('./createIntelligenceContext.js').createIntelligenceContext>} deps.intelligence
 * @param {(time: number) => object} [deps.getTimeInfo]
 * @param {Function} deps.toSupplySeason
 * @param {Function} deps.toSupplyMonth
 * @param {() => Record<string, number>} deps.getSkillPriorities
 */
export function createGameRuntime({
  parcels,
  supply,
  housing,
  employment,
  gameplay,
  intelligence,
  getTimeInfo: getTimeInfoDep,
  toSupplySeason,
  toSupplyMonth,
  getSkillPriorities,
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
  if (!employment) {
    throw new Error('createGameRuntime: employment context required');
  }
  if (!gameplay) {
    throw new Error('createGameRuntime: gameplay context required');
  }
  if (!intelligence) {
    throw new Error('createGameRuntime: intelligence context required');
  }
  if (typeof getSkillPriorities !== 'function') {
    throw new Error('createGameRuntime: getSkillPriorities required');
  }

  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();

  const world = new World();
  const pipeline = new Pipeline();

  const supplyMonthlyResourceCycle = createSupplyMonthlyResourceSystem({
    supply,
    getTimeInfo,
    toSupplySeason,
    toSupplyMonth,
  });
  const housingPopulationGrowth = createHousingPopulationGrowthSystem({
    housing,
    getTimeInfo,
    areFamineLimitsEnabled: isLoseMode,
    onFamineDeaths: (deaths, timeInfo) => {
      recordDeaths(deaths);
      void supply.recordFamineDeaths(timeInfo, deaths);
    },
  });
  const housingEvolution = createHousingEvolutionSystem({
    housing,
    getTimeInfo,
    onChanges: (changes, timeInfo) => supply.recordHouseChanges(timeInfo, changes),
    // The player is told, with the reason, when inhabitants leave (see BuildingNotifications.js)
    onPopulationDeparted: (departure) =>
      getSharedEventBus().publish({ type: 'housing.populationDeparted', ...departure }),
  });
  const employmentRedistribute = createEmploymentRedistributeSystem({
    employment,
    getSkillPriorities,
  });
  // The city's employment at each month's end, for its history (the log keeps a row only on change)
  const historyEmploymentSummary = async (_world, context = {}) => {
    const timeInfo = getTimeInfo(context.time ?? 0);
    if (timeInfo.dayInMonth !== TimeManager.DAYS_PER_MONTH) return;
    await supply.recordEmploymentSummary(timeInfo, await employment.getCityEmploymentSummary());
  };
  pipeline
    .group('simulation')
    .register('parcels.roadAccess', createParcelsRoadAccessSystem(parcels))
    .register('supply.monthlyResourceCycle', supplyMonthlyResourceCycle)
    .register('housing.populationGrowth', housingPopulationGrowth)
    .register('housing.evolution', housingEvolution)
    .register('employment.redistribute', employmentRedistribute)
    .register('history.employmentSummary', historyEmploymentSummary)
    .register('gameplay.randomEvents', createRandomEventsSystem({ gameplay }))
    .register(
      'intelligence.monthlyNews',
      createIntelligenceMonthlyNewsSystem({ intelligence, getTimeInfo })
    );

  return {
    world,
    pipeline,

    /**
     * Un tick de simulation ECS (groupe `simulation`).
     * @param {{ city?: object, time?: number }} [context]
     */
    async runSimulation(context = {}) {
      await pipeline.runGroup('simulation', world, context);
    },
  };
}
