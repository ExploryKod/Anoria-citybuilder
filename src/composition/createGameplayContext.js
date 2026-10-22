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
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { isTutorialMode } from '../shared/gameplay/gameMode.js';
import { RandomEventsSimulationService } from '../contexts/gameplay/application/services/RandomEventsSimulationService.js';
import { AdvanceTutorial } from '../contexts/gameplay/application/services/AdvanceTutorial.js';
import { TUTORIAL_STEPS } from '../contexts/gameplay/domain/catalogs/TutorialCatalog.js';

/** @type {ReturnType<typeof createGameplayContext>|null} */
let sharedGameplay = null;

/**
 * The tutorial's two ports, implemented here where the contexts meet: its facts are the building rows (Construction), its instructions are
 * filed as dépêches by Intelligence.
 */
function createTutorialPorts() {
  return {
    facts: {
      async read() {
        const rows = await getOrCreateConstructionContext().listAllBuildingRows();
        return {
          buildings: rows.map((row) => ({
            type: row.type,
            pop: row.pop ?? 0,
            workers: row.employees?.worker ?? 0,
            workerNeed: row.employees?.worker_need ?? 0,
          })),
        };
      },
    },
    announcer: {
      announce: ({ stepId, ...guidance }) =>
        getOrCreateIntelligenceContext().announceGuidance({ guidanceId: `tutorial:${stepId}`, categoryId: 'tutorial', ...guidance }),
    },
  };
}

/**
 * @param {object} [deps]
 * @param {RandomEventsSimulationService} [deps.randomEventsSimulation]
 * @param {AdvanceTutorial} [deps.advanceTutorial]
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

  const advanceTutorial =
    deps.advanceTutorial ??
    new AdvanceTutorial({
      steps: TUTORIAL_STEPS,
      isActive: isTutorialMode,
      ...createTutorialPorts(),
      getGameTime: () => getSessionGameTime(),
    });

  return {
    randomEventsSimulation,
    simulationDeps,
    advanceTutorial,
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
