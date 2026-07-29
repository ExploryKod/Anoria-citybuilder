import { DexieHousingBuildingRepository } from '../contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { GrowHousePopulation } from '../contexts/housing/application/commands/growth/GrowHousePopulation.js';
import { GrowAllHousePopulation } from '../contexts/housing/application/commands/growth/GrowAllHousePopulation.js';
import { EvolveHouseBuilding } from '../contexts/housing/application/commands/evolution/EvolveHouseBuilding.js';
import { EvolveAllHouseBuildings } from '../contexts/housing/application/commands/evolution/EvolveAllHouseBuildings.js';
import { GetCityPopulationSummary } from '../contexts/housing/application/queries/GetCityPopulationSummary.js';
import { GetFamishedPopulation } from '../contexts/housing/application/queries/GetFamishedPopulation.js';
import { GetResidentialHouseAtTile } from '../contexts/housing/application/queries/GetResidentialHouseAtTile.js';
import { EvaluateHouseFoodAffluence } from '../contexts/housing/application/queries/EvaluateHouseFoodAffluence.js';
import { PreviewHouseEvolution } from '../contexts/housing/application/queries/PreviewHouseEvolution.js';

/**
 * Composition root — Housing bounded context.
 *
 * @param {object} deps
 * @param {import('../js/stores/HousesStore.js').default} deps.housesStore
 */
export function createHousingContext({ housesStore }) {
  const housingBuildingRepository = new DexieHousingBuildingRepository(housesStore);
  const growHousePopulation = new GrowHousePopulation(housingBuildingRepository);
  const growAllHousePopulation = new GrowAllHousePopulation(
    housingBuildingRepository,
    growHousePopulation
  );
  const evolveHouseBuilding = new EvolveHouseBuilding(housingBuildingRepository);
  const evolveAllHouseBuildings = new EvolveAllHouseBuildings(
    housingBuildingRepository,
    evolveHouseBuilding
  );
  const getCityPopulationSummaryQuery = new GetCityPopulationSummary(
    housingBuildingRepository
  );
  const getResidentialHouseAtTileQuery = new GetResidentialHouseAtTile(
    housingBuildingRepository
  );
  const getFamishedPopulationQuery = new GetFamishedPopulation(
    housingBuildingRepository
  );
  const evaluateHouseFoodAffluenceQuery = new EvaluateHouseFoodAffluence();
  const previewHouseEvolutionQuery = new PreviewHouseEvolution();

  return {
    housingBuildingRepository,
    growHousePopulation,
    growAllHousePopulation,
    evolveHouseBuilding,
    evolveAllHouseBuildings,
    getCityPopulationSummaryQuery,
    getResidentialHouseAtTileQuery,
    getFamishedPopulationQuery,
    evaluateHouseFoodAffluenceQuery,
    previewHouseEvolutionQuery,

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
  };
}

/** @type {ReturnType<typeof createHousingContext> | null} */
let sharedHousing = null;
/** @type {object | null} */
let sharedHousesStore = null;

export function getOrCreateHousingContext(housesStore) {
  if (!sharedHousing || sharedHousesStore !== housesStore) {
    sharedHousing = createHousingContext({ housesStore });
    sharedHousesStore = housesStore;
  }
  return sharedHousing;
}

/** @internal Tests only */
export function resetHousingContextForTests() {
  sharedHousing = null;
  sharedHousesStore = null;
}
