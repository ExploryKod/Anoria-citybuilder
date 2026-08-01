import {
  getDaysPerMonth,
  getEventProbability,
  isEventsEnabled,
} from '../../config/events.js';
import { listAllBuildingRows } from '../js/acl/construction.js';
import { syncRemovedBuilding } from '../js/acl/parcels.js';
import { instanceIdFromHouseRow } from '../js/acl/building-identity.js';
import { recordExceptionalRepairExpense } from '../js/acl/accountingGame.js';
import {
  getGameCity,
  getGameScene,
  getGameTime,
} from '../js/acl/appRuntime.js';
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
    listAllBuildingRows,
    syncRemovedBuilding,
    instanceIdFromHouseRow,
    recordExceptionalRepairExpense,
    getGameScene,
    getGameCity,
    getGameTime,
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
