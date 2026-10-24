import {
  getDaysPerMonth,
  getEventProbability,
  isEventsEnabled,
} from '../config/events.js';
import { BUILDING_KIND_HOUSE, instanceIdFromHouseRow, resolveBuildingKind } from '../shared/building-identity/index.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import {
  getSessionCity,
  getSessionGameTime,
  getSessionScene,
} from './sessionRuntime.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { isTutorialMode } from '../shared/gameplay/gameMode.js';
import { getTimeInfo } from '../shared/time/TimeCalendar.js';
import { getAnnualHarvestSchedule, getConsumerEntries } from '../shared/building-catalog/resourceRoleQueries.js';
import { matchesSchedule, monthsUntilNextMatch } from '../contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { RandomEventsSimulationService } from '../contexts/gameplay/application/services/RandomEventsSimulationService.js';
import { AdvanceTutorial } from '../contexts/gameplay/application/services/AdvanceTutorial.js';
import { TUTORIAL_DISPATCHES, TUTORIAL_START_TOOLS, TUTORIAL_STEPS, TUTORIAL_TOASTS } from '../contexts/gameplay/domain/catalogs/TutorialCatalog.js';

/** @type {ReturnType<typeof createGameplayContext>|null} */
let sharedGameplay = null;

/**
 * The categories a building was supplied with: each consumer need of the catalog files its last outcome under its `outcomeField` (ConsumeResource), and
 * a need that drew something (`taken` > 0) was reached by what serves it.
 */
function suppliedCategoriesOf(row) {
  return getConsumerEntries(row.type)
    .filter((entry) => entry.outcomeField && row[entry.outcomeField]?.taken > 0)
    .flatMap((entry) => entry.categories);
}

/** Whether a company (a building with an account of its own that is no house) has booked a sale of its production: read from the journal's fold. */
async function hasSoldProduction(row) {
  const accounting = getOrCreateAccountingContext();
  if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE || !accounting.hasBuildingAccount(row.type)) return false;
  return accounting.hasBuildingSold(instanceIdFromHouseRow(row));
}

/**
 * The tutorial's two ports, implemented here where the contexts meet: its facts are the building rows (Construction), its instructions are
 * filed as dépêches by Intelligence.
 */
function createTutorialPorts() {
  return {
    facts: {
      async read() {
        const rows = await getOrCreateConstructionContext().listAllBuildingRows();
        // The buildings that show the no-work sprite: the very list the scene draws it from, never a second reading of the rows.
        const understaffed = new Set((await getOrCreateEmploymentContext().getCityEmploymentSummary()).understaffedBuildingIds);
        const turn = getSessionGameTime();
        const daysPerMonth = getDaysPerMonth();
        const time = getTimeInfo(turn, daysPerMonth);
        const harvestSchedule = getAnnualHarvestSchedule();
        const harvesting = matchesSchedule(harvestSchedule, time);
        return {
          calendar: {
            turn,
            season: time.season,
            month: time.month,
            // The harvest is when the catalog's annual-supply schedule names the current period, the same match the supply cycle makes.
            harvesting,
            // Months until it next comes (0 when it is on now), looking at the same day of the months ahead; null when it never does within a year.
            monthsToHarvest: harvesting
              ? 0
              : monthsUntilNextMatch(harvestSchedule, (monthsAhead) => getTimeInfo(turn + monthsAhead * daysPerMonth, daysPerMonth)),
          },
          buildings: await Promise.all(rows.map(async (row) => ({
            type: row.type,
            pop: row.pop ?? 0,
            workers: row.employees?.worker ?? 0,
            workerNeed: row.employees?.worker_need ?? 0,
            understaffed: understaffed.has(instanceIdFromHouseRow(row)),
            supplied: suppliedCategoriesOf(row),
            sold: await hasSoldProduction(row),
          }))),
        };
      },
    },
    announcer: {
      announce: ({ stepId, ...guidance }) =>
        getOrCreateIntelligenceContext().announceGuidance({ guidanceId: `tutorial:${stepId}`, categoryId: 'tutorial', ...guidance }),
      wasAnnounced: (stepId) => getOrCreateIntelligenceContext().isGuidanceAnnounced({ guidanceId: `tutorial:${stepId}` }),
      wasRead: (stepId) => getOrCreateIntelligenceContext().isGuidanceRead({ guidanceId: `tutorial:${stepId}` }),
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
      dispatches: TUTORIAL_DISPATCHES,
      toasts: TUTORIAL_TOASTS,
      startTools: TUTORIAL_START_TOOLS,
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
