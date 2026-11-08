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
import { getAnnualHarvestSchedule, getConsumerEntries, getResourceStockShape } from '../shared/building-catalog/resourceRoleQueries.js';
import { matchesSchedule, monthsUntilNextMatch } from '../contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { RandomEventsSimulationService } from '../contexts/gameplay/application/services/RandomEventsSimulationService.js';
import { LiquidateInsolventCompanies } from '../contexts/gameplay/application/services/LiquidateInsolventCompanies.js';
import { WearBuildings } from '../contexts/gameplay/application/services/WearBuildings.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { recordDeaths } from './gameplayMortalityState.js';
import { getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import { buildingNameOf } from '../shared/building-catalog/buildingCompanies.js';
import { getSharedEventBus } from './sharedEventBus.js';
import { residentsCountOf } from '../shared/population/residentsCount.js';
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

/**
 * Whether a building drew food in its last consumption: its diet (the need whose stock is the catalog's food stock) filed an outcome that took something.
 * What serves it is the market: the houses are fed from there.
 */
function isFed(row) {
  const { totalKey } = getResourceStockShape();
  const diet = getConsumerEntries(row.type).find((entry) => entry.totalKey === totalKey);
  return Boolean(diet?.outcomeField && row[diet.outcomeField]?.taken > 0);
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
            pop: residentsCountOf(row),
            workers: row.employees?.worker ?? 0,
            workerNeed: row.employees?.worker_need ?? 0,
            understaffed: understaffed.has(instanceIdFromHouseRow(row)),
            supplied: suppliedCategoriesOf(row),
            fed: isFed(row),
            sold: await hasSoldProduction(row),
            // A house's stored level (what it has evolved to); a building that is no house has none, and no condition asks it.
            level: Number.isFinite(row.level) ? row.level : 0,
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

  // A company that cannot pay its debts the grace months in a row is liquidated and demolished as the player's own demolition would (see LiquidateInsolventCompanies.js).
  const liquidateInsolventCompanies =
    deps.liquidateInsolventCompanies ??
    new LiquidateInsolventCompanies({
      listAllBuildingRows: simulationDeps.listAllBuildingRows,
      instanceIdFromHouseRow,
      isLiquidatedWhenInsolvent: (type) => getBuildingDefinition(type)?.liquidatedWhenInsolvent === true,
      getInsolvency: (instanceId) => getOrCreateAccountingContext().getInsolvency(instanceId),
      bulldozeBuildingAtTile: (params) => getOrCreateConstructionContext().bulldozeBuildingAtTile(params),
      getGameCity: simulationDeps.getGameCity,
      nameOfRow: (row) => {
        const name = buildingNameOf(row.type, row);
        if (!name) throw new Error(`[insolvency] ${row.type} has no catalog name: the liquidation cannot be announced`);
        return name;
      },
      announce: (event) => getSharedEventBus().publish({ type: 'gameplay.companyLiquidated', ...event }),
      reportFailure: (failure) => getSharedEventBus().publish({ type: 'gameplay.companyLiquidationFailed', ...failure }),
    });

  // The buildings wear when their upkeep is not paid and may collapse (docs/gameplay/PLAN_COLLAPSE.md): the people inside who are hit die, the building is demolished.
  const wearBuildings =
    deps.wearBuildings ??
    new WearBuildings({
      listAllBuildingRows: simulationDeps.listAllBuildingRows,
      instanceIdFromHouseRow,
      updateBuildingFields: (instanceId, fields) => getOrCreateConstructionContext().updateBuildingFields(instanceId, fields),
      citizensInside: (row) => getOrCreateHousingContext().citizensInside(row),
      killCitizens: (dead) => getOrCreateHousingContext().killCitizens(dead),
      recordAccidentDeaths: (count) => recordDeaths(count, 'accident'),
      bulldozeBuildingAtTile: (params) => getOrCreateConstructionContext().bulldozeBuildingAtTile(params),
      getGameCity: simulationDeps.getGameCity,
      nameOfRow: (row) => buildingNameOf(row.type, row),
      random: Math.random,
      announce: (event) => getSharedEventBus().publish({ type: 'gameplay.buildingCollapsed', ...event }),
      reportFailure: (failure) => getSharedEventBus().publish({ type: 'gameplay.buildingCollapseFailed', ...failure }),
    });

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

  /**
   * The player liquidates the insolvent bank (from the central bank's section): it is demolished as an insolvent company is, its books closed first (its depositors
   * repaid, the city guaranteeing what its cash does not cover: LiquidateDemolishedBuilding.js), and the screen follows the announcement. Refused while the bank is solvent.
   * @returns {Promise<{ liquidated: true } | { liquidated: false, refused: string }>}
   */
  async function liquidateBank() {
    const accounting = getOrCreateAccountingContext();
    const solvency = await accounting.getBankSolvency();
    if (!solvency?.insolvent) throw new Error('[bank] only an insolvent bank is liquidated from the central bank: a solvent one is demolished like any building');
    const row = (await simulationDeps.listAllBuildingRows()).find((candidate) => instanceIdFromHouseRow(candidate) === solvency.bankId);
    if (!row) throw new Error(`[bank] the bank ${solvency.bankId} has no row: it cannot be liquidated`);
    const city = simulationDeps.getGameCity();
    if (!city) throw new Error('[bank] there is no city on screen to take the bank off');
    const outcome = await getOrCreateConstructionContext().bulldozeBuildingAtTile({ city, x: row.x, y: row.y, meshInstanceId: solvency.bankId });
    if (outcome.refused) return { liquidated: false, refused: outcome.refused };
    const name = buildingNameOf(row.type, row);
    if (!name) throw new Error(`[bank] ${row.type} has no catalog name: the liquidation cannot be announced`);
    getSharedEventBus().publish({ type: 'gameplay.companyLiquidated', instanceId: solvency.bankId, buildingType: row.type, name, x: row.x, y: row.y });
    return { liquidated: true };
  }

  return {
    randomEventsSimulation,
    liquidateInsolventCompanies,
    wearBuildings,
    simulationDeps,
    advanceTutorial,
    liquidateBank,
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
