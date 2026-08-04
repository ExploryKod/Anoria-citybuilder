import { DexieHousingBuildingRepository } from '../contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { ClearPopulationWithoutRoadAccess } from '../contexts/housing/application/commands/ClearPopulationWithoutRoadAccess.js';
import { GrowHousePopulation } from '../contexts/housing/application/commands/growth/GrowHousePopulation.js';
import { GrowAllHousePopulation } from '../contexts/housing/application/commands/growth/GrowAllHousePopulation.js';
import { EvolveHouseBuilding } from '../contexts/housing/application/commands/evolution/EvolveHouseBuilding.js';
import { EvolveAllHouseBuildings } from '../contexts/housing/application/commands/evolution/EvolveAllHouseBuildings.js';
import { GetCityPopulationSummary } from '../contexts/housing/application/queries/GetCityPopulationSummary.js';
import { GetFamishedPopulation } from '../contexts/housing/application/queries/GetFamishedPopulation.js';
import { GetCityFoodSupply } from '../contexts/housing/application/queries/GetCityFoodSupply.js';
import { GetResidentialHouseAtTile } from '../contexts/housing/application/queries/GetResidentialHouseAtTile.js';
import { EvaluateHouseFoodAffluence } from '../contexts/housing/application/queries/EvaluateHouseFoodAffluence.js';
import { PreviewHouseEvolution } from '../contexts/housing/application/queries/PreviewHouseEvolution.js';
import { evaluateResidentialGroupUnlock } from '../contexts/housing/domain/policies/ResidentialGroupUnlockPolicy.js';

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
  const clearPopulationWithoutRoadAccess = new ClearPopulationWithoutRoadAccess(
    housingBuildingRepositoryImpl
  );
  const growHousePopulation = new GrowHousePopulation(housingBuildingRepositoryImpl);
  const growAllHousePopulation = new GrowAllHousePopulation(
    housingBuildingRepositoryImpl,
    growHousePopulation
  );
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
  const previewHouseEvolutionQuery = new PreviewHouseEvolution();

  return {
    housingBuildingRepository: housingBuildingRepositoryImpl,
    growHousePopulation,
    growAllHousePopulation,
    evolveHouseBuilding,
    evolveAllHouseBuildings,
    getCityPopulationSummaryQuery,
    getResidentialHouseAtTileQuery,
    getFamishedPopulationQuery,
    getCityFoodSupplyQuery,
    evaluateHouseFoodAffluenceQuery,
    previewHouseEvolutionQuery,

    clearPopulationWithoutRoadAccess,

    async growHousePopulation(houseId, monthIndex) {
      return growHousePopulation.execute({ houseId, monthIndex });
    },

    async growAllHousePopulation({ monthIndex }) {
      return growAllHousePopulation.execute({ monthIndex });
    },

    async evolveHouseBuilding(houseId) {
      return evolveHouseBuilding.execute({ houseId });
    },

    async evolveAllHouseBuildings() {
      return evolveAllHouseBuildings.execute();
    },

    async getCityPopulationSummary() {
      return getCityPopulationSummaryQuery.execute();
    },

    async getResidentialHouseAt({ x, y }) {
      return getResidentialHouseAtTileQuery.execute({ x, y });
    },

    async getFamishedPopulation() {
      return getFamishedPopulationQuery.execute();
    },

    async getCityFoodSupply() {
      return getCityFoodSupplyQuery.execute();
    },

    async clearPopulationWithoutRoadAccess() {
      return clearPopulationWithoutRoadAccess.execute();
    },

    evaluateHouseFoodAffluence({ stocks, population = 0 }) {
      return evaluateHouseFoodAffluenceQuery.execute({ stocks, population });
    },

    previewHouseEvolution({ stocks, population, buildingType, hasRoadAccess }) {
      return previewHouseEvolutionQuery.execute({
        stocks,
        population,
        buildingType,
        hasRoadAccess,
      });
    },

    /** @returns {Promise<{ unlocked: boolean, redLevel2Count: number, threshold: number }>} */
    async getResidentialGroupUnlockStatus() {
      const houses = await housingBuildingRepositoryImpl.findResidentialHouses();
      return evaluateResidentialGroupUnlock(houses);
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
