import {
  getDaysPerMonth,
  getEventProbability,
  isEventsEnabled,
} from '../config/events.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import {
  getSessionCity,
  getSessionGameTime,
  getSessionScene,
} from './sessionRuntime.js';
import { RandomEventsSimulationService } from '../contexts/gameplay/application/services/RandomEventsSimulationService.js';

/** @type {ReturnType<typeof createGameplayContext>|null} */
let sharedGameplay = null;

/**
 * @param {object} [deps]
 * @param {RandomEventsSimulationService} [deps.randomEventsSimulation]
 */
export function createGameplayContext(deps = {}) {
  const simulationDeps = {
    isEventsEnabled,
    getEventProbabilityPercent: getEventProbability,
    getDaysPerMonth,
    listAllBuildingRows: () => getOrCreateConstructionContext().listAllBuildingRows(),
    syncRemovedBuilding: (params) =>
      getOrCreateParcelsContext().syncRemovedBuilding(params),
    instanceIdFromHouseRow,
    recordExceptionalRepairExpense: (...args) =>
      getOrCreateAccountingContext().recordExceptionalRepairExpense(...args),
    getGameScene: () => getSessionScene(),
    getGameCity: () => getSessionCity(),
    getGameTime: () => getSessionGameTime(),
  };

  const randomEventsSimulation =
    deps.randomEventsSimulation ?? new RandomEventsSimulationService(simulationDeps);

  return {
    randomEventsSimulation,
    simulationDeps,
  };
}

/** @param {object} [deps] */
export function getOrCreateGameplayContext(deps = {}) {
  if (!sharedGameplay) {
    sharedGameplay = createGameplayContext(deps);
  }
  return sharedGameplay;
}

/** @internal Tests only */
export function resetGameplayContextForTests() {
  sharedGameplay = null;
}
