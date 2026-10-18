import { DexieHousingBuildingRepository } from '../contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { GrowHousePopulation } from '../contexts/housing/application/commands/growth/GrowHousePopulation.js';
import { GrowAllHousePopulation } from '../contexts/housing/application/commands/growth/GrowAllHousePopulation.js';
import { RunMonthlyDepartures } from '../contexts/housing/application/commands/departure/RunMonthlyDepartures.js';
import { EvolveHouseBuilding } from '../contexts/housing/application/commands/evolution/EvolveHouseBuilding.js';
import { EvolveAllHouseBuildings } from '../contexts/housing/application/commands/evolution/EvolveAllHouseBuildings.js';
import { GetCityPopulationSummary } from '../contexts/housing/application/queries/GetCityPopulationSummary.js';
import { GetFamishedPopulation } from '../contexts/housing/application/queries/GetFamishedPopulation.js';
import { GetCityFoodSupply } from '../contexts/housing/application/queries/GetCityFoodSupply.js';
import { GetResidentialHouseAtTile } from '../contexts/housing/application/queries/GetResidentialHouseAtTile.js';
import { EvaluateHouseFoodAffluence } from '../contexts/housing/application/queries/EvaluateHouseFoodAffluence.js';
import {
  getCitizenSkillsForHouse,
  houseCitizenHasSkillAtLevel,
  residentialGroupForHouseType,
} from '../contexts/housing/domain/policies/GroupSkillPolicy.js';
import { computeHouseCitizenComposition } from '../contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';

/**
 * Composition root — Housing bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/housing/application/ports/HousingBuildingRepository.js').HousingBuildingRepository} [deps.housingBuildingRepository]
 *   Tests : injecter un fake in-memory, ou utiliser core/db + resetHousingContextForTests().
 */
export function createHousingContext({ housingBuildingRepository } = {}) {
  const housingBuildingRepositoryImpl =
    housingBuildingRepository ?? new DexieHousingBuildingRepository();
  const growHousePopulation = new GrowHousePopulation(housingBuildingRepositoryImpl);
  const growAllHousePopulation = new GrowAllHousePopulation(
    housingBuildingRepositoryImpl,
    growHousePopulation
  );
  const runMonthlyDepartures = new RunMonthlyDepartures(housingBuildingRepositoryImpl);
  const evolveHouseBuilding = new EvolveHouseBuilding(housingBuildingRepositoryImpl);
  const evolveAllHouseBuildings = new EvolveAllHouseBuildings(
    housingBuildingRepositoryImpl,
    evolveHouseBuilding
  );
  const getCityPopulationSummaryQuery = new GetCityPopulationSummary(
    housingBuildingRepositoryImpl
  );
  const getResidentialHouseAtTileQuery = new GetResidentialHouseAtTile(
    housingBuildingRepositoryImpl
  );
  const getFamishedPopulationQuery = new GetFamishedPopulation(
    housingBuildingRepositoryImpl
  );
  const getCityFoodSupplyQuery = new GetCityFoodSupply(
    housingBuildingRepositoryImpl
  );
  const evaluateHouseFoodAffluenceQuery = new EvaluateHouseFoodAffluence();

  return {
    housingBuildingRepository: housingBuildingRepositoryImpl,
    growHousePopulation,
    growAllHousePopulation,
    evolveHouseBuilding,
    /** @param {(house: object) => Promise<boolean>} check whether a warehouse is within reach of the house's activity */
    setActivityAccessCheck: (check) => evolveHouseBuilding.setActivityAccessCheck(check),
    evolveAllHouseBuildings,
    getCityPopulationSummaryQuery,
    getResidentialHouseAtTileQuery,
    getFamishedPopulationQuery,
    getCityFoodSupplyQuery,
    evaluateHouseFoodAffluenceQuery,

    async growHousePopulation(houseId, monthIndex, options = {}) {
      return growHousePopulation.execute({
        houseId,
        monthIndex,
        applyFamineLimits: options.applyFamineLimits === true,
      });
    },

    async growAllHousePopulation({ monthIndex, applyFamineLimits = false }) {
      return growAllHousePopulation.execute({ monthIndex, applyFamineLimits });
    },

    /** @param {{ monthKey: number, signals: Record<string, Map<string, number>> }} params */
    async runMonthlyDepartures({ monthKey, signals }) {
      return runMonthlyDepartures.execute({ monthKey, signals });
    },

    async evolveHouseBuilding(houseId) {
      return evolveHouseBuilding.execute({ houseId });
    },

    async evolveAllHouseBuildings({ periodKey } = {}) {
      return evolveAllHouseBuildings.execute({ periodKey });
    },

    async getCityPopulationSummary() {
      return getCityPopulationSummaryQuery.execute();
    },

    async getResidentialHouseAt({ x, y }) {
      return getResidentialHouseAtTileQuery.execute({ x, y });
    },

    /** Every residential house by each tile of its footprint (keyed "x,y"), from one read: what the scene asks tile by tile otherwise. */
    async getResidentialHouseTileIndex() {
      return housingBuildingRepositoryImpl.indexResidentialByTile();
    },

    async getFamishedPopulation() {
      return getFamishedPopulationQuery.execute();
    },

    async getCityFoodSupply() {
      return getCityFoodSupplyQuery.execute();
    },

    evaluateHouseFoodAffluence({ stocks, population = 0 }) {
      return evaluateHouseFoodAffluenceQuery.execute({ stocks, population });
    },

    /**
     * @param {{ type?: string, level?: number }} house
     * @returns {ReadonlyArray<string>}
     */
    getCitizenSkillsForLaborSource(house) {
      return getCitizenSkillsForHouse({
        level: house.level ?? 2,
        residentialGroup: residentialGroupForHouseType(house.type),
      });
    },

    /**
     * @param {{ type?: string, level?: number }} house
     * @param {string} skillKey
     * @param {number} [requiredLevel]
     * @returns {boolean}
     */
    citizenProvidesSkillAtLevel(house, skillKey, requiredLevel) {
      return houseCitizenHasSkillAtLevel(
        { level: house.level ?? 2, residentialGroup: residentialGroupForHouseType(house.type) },
        skillKey,
        requiredLevel,
      );
    },

    /**
     * @param {{ level: 1 | 2, pop: number, buildingType: string, residentialGroup: string | null }} params
     */
    getHouseCitizenComposition(params) {
      return computeHouseCitizenComposition(params);
    },
  };
}

/** @type {ReturnType<typeof createHousingContext> | null} */
let sharedHousing = null;

export function getOrCreateHousingContext() {
  if (!sharedHousing) {
    sharedHousing = createHousingContext();
  }
  return sharedHousing;
}

/** @internal Tests only */
export function resetHousingContextForTests() {
  sharedHousing = null;
}
