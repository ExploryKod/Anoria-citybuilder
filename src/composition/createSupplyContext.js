import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { MarketBuysFromNearbyFarms } from '../contexts/supply/application/commands/procurement/MarketBuysFromNearbyFarms.js';
import { MarkMarketBuyingSeason } from '../contexts/supply/application/commands/procurement/MarkMarketBuyingSeason.js';
import { DistributeFoodFromMarketToHouses } from '../contexts/supply/application/commands/distribution/DistributeFoodFromMarketToHouses.js';
import { WindmillCollectsFromAllFarms } from '../contexts/supply/application/commands/surplus/WindmillCollectsFromAllFarms.js';
import { UpdateHousesMarketReach } from '../contexts/supply/application/commands/distribution/UpdateHousesMarketReach.js';
import { UpdateMarketFarmProximity } from '../contexts/supply/application/commands/procurement/UpdateMarketFarmProximity.js';
import { MarkWindmillCollectingSeason } from '../contexts/supply/application/commands/surplus/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../contexts/supply/application/commands/surplus/ResetFarmsSoldToWindmill.js';
import { SetWindmillCollectingFlag } from '../contexts/supply/application/commands/surplus/SetWindmillCollectingFlag.js';
import { MarkFarmSoldToWindmill } from '../contexts/supply/application/commands/surplus/MarkFarmSoldToWindmill.js';
import { HarvestFarmCrop } from '../contexts/supply/application/commands/harvest/HarvestFarmCrop.js';
import { HarvestAllFarmCrops } from '../contexts/supply/application/commands/harvest/HarvestAllFarmCrops.js';
import { ConsumeHouseFood } from '../contexts/supply/application/commands/consumption/ConsumeHouseFood.js';
import { ConsumeAllHouseFood } from '../contexts/supply/application/commands/consumption/ConsumeAllHouseFood.js';
import { ProcessWindmillCollection } from '../contexts/supply/application/commands/surplus/ProcessWindmillCollection.js';
import { RunWindmillSurplusCycle } from '../contexts/supply/application/commands/surplus/RunWindmillSurplusCycle.js';
import { RunCityMarketFoodCycle } from '../contexts/supply/application/commands/procurement/RunCityMarketFoodCycle.js';
import { RunMonthlyFoodSupplyCycle } from '../contexts/supply/application/workflows/RunMonthlyFoodSupplyCycle.js';
import { CollectFactoryResources } from '../contexts/supply/application/commands/manufacturing/CollectFactoryResources.js';
import { TransformFactoryMaterials } from '../contexts/supply/application/commands/manufacturing/TransformFactoryMaterials.js';
import { ProduceFactoryGoods } from '../contexts/supply/application/commands/manufacturing/ProduceFactoryGoods.js';
import { ProcessFactoryProductionStep } from '../contexts/supply/application/commands/manufacturing/ProcessFactoryProductionStep.js';
import { RunCityFactoryProductionCycle } from '../contexts/supply/application/commands/manufacturing/RunCityFactoryProductionCycle.js';
import { GetCityFactoryResources } from '../contexts/supply/application/queries/GetCityFactoryResources.js';
import { DexieFactoryBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieFactoryBuildingRepository.js';
import { SupplyProductionJournal } from '../contexts/supply/infrastructure/presentation/SupplyProductionJournal.js';
import { SupplyFoodTraceability } from '../contexts/supply/infrastructure/presentation/SupplyFoodTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { ListSupplyMapBuildings } from '../contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListWindmillSupplyViews } from '../contexts/supply/application/queries/ListWindmillSupplyViews.js';
import { ListSupplyStockSnapshots } from '../contexts/supply/application/queries/ListSupplyStockSnapshots.js';

/**
 * Composition root — Supply bounded context.
 *
 * @param {object} deps
 * @param {import('../js/stores/HousesStore.js').default} deps.housesStore
 */
export function createSupplyContext({ housesStore }) {
  const supplyBuildingRepository = new DexieSupplyBuildingRepository(housesStore);
  const factoryBuildingRepository = new DexieFactoryBuildingRepository(housesStore);
  const productionJournal = new SupplyProductionJournal();
  const marketBuysFromNearbyFarms = new MarketBuysFromNearbyFarms(
    supplyBuildingRepository
  );
  const markMarketBuyingSeason = new MarkMarketBuyingSeason(supplyBuildingRepository);
  const distributeFoodFromMarketToHouses = new DistributeFoodFromMarketToHouses(
    supplyBuildingRepository
  );
  const windmillCollectsFromAllFarms = new WindmillCollectsFromAllFarms(
    supplyBuildingRepository
  );
  const updateHousesMarketReach = new UpdateHousesMarketReach(
    supplyBuildingRepository
  );
  const updateMarketFarmProximity = new UpdateMarketFarmProximity(
    supplyBuildingRepository
  );
  const markWindmillCollectingSeason = new MarkWindmillCollectingSeason(
    supplyBuildingRepository
  );
  const resetFarmsSoldToWindmill = new ResetFarmsSoldToWindmill(
    supplyBuildingRepository
  );
  const setWindmillCollectingFlag = new SetWindmillCollectingFlag(
    supplyBuildingRepository
  );
  const markFarmSoldToWindmill = new MarkFarmSoldToWindmill(
    supplyBuildingRepository
  );
  const harvestFarmCrop = new HarvestFarmCrop(supplyBuildingRepository);
  const harvestAllFarmCrops = new HarvestAllFarmCrops(
    supplyBuildingRepository,
    harvestFarmCrop
  );
  const consumeHouseFood = new ConsumeHouseFood(supplyBuildingRepository);
  const consumeAllHouseFood = new ConsumeAllHouseFood(
    supplyBuildingRepository,
    consumeHouseFood
  );
  const processWindmillCollection = new ProcessWindmillCollection(
    supplyBuildingRepository,
    windmillCollectsFromAllFarms,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill
  );
  const runWindmillSurplusCycle = new RunWindmillSurplusCycle(
    supplyBuildingRepository,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    processWindmillCollection
  );
  const traceability = new SupplyFoodTraceability(housesStore);
  const runCityMarketFoodCycle = new RunCityMarketFoodCycle(
    supplyBuildingRepository,
    marketBuysFromNearbyFarms,
    distributeFoodFromMarketToHouses,
    updateMarketFarmProximity,
    traceability
  );
  const runMonthlyFoodSupplyCycle = new RunMonthlyFoodSupplyCycle(
    harvestAllFarmCrops,
    markMarketBuyingSeason,
    runCityMarketFoodCycle,
    updateHousesMarketReach,
    runWindmillSurplusCycle,
    consumeAllHouseFood,
    traceability
  );
  const collectFactoryResources = new CollectFactoryResources(
    factoryBuildingRepository,
    productionJournal
  );
  const transformFactoryMaterials = new TransformFactoryMaterials(
    factoryBuildingRepository,
    productionJournal
  );
  const produceFactoryGoods = new ProduceFactoryGoods(
    factoryBuildingRepository,
    productionJournal
  );
  const processFactoryProductionStep = new ProcessFactoryProductionStep(
    factoryBuildingRepository,
    collectFactoryResources,
    transformFactoryMaterials,
    produceFactoryGoods
  );
  const runCityFactoryProductionCycle = new RunCityFactoryProductionCycle(
    factoryBuildingRepository,
    processFactoryProductionStep
  );
  const getCityFactoryResourcesQuery = new GetCityFactoryResources(
    factoryBuildingRepository
  );
  const getBuildingSupplyViewQuery = new GetBuildingSupplyView(
    supplyBuildingRepository
  );
  const listSupplyMapBuildingsQuery = new ListSupplyMapBuildings(
    supplyBuildingRepository
  );
  const listWindmillSupplyViewsQuery = new ListWindmillSupplyViews(
    supplyBuildingRepository
  );
  const listSupplyStockSnapshotsQuery = new ListSupplyStockSnapshots(
    supplyBuildingRepository
  );

  return {
    supplyBuildingRepository,
    marketBuysFromNearbyFarms,
    markMarketBuyingSeason,
    distributeFoodFromMarketToHouses,
    windmillCollectsFromAllFarms,
    updateHousesMarketReach,
    updateMarketFarmProximity,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill,
    harvestFarmCrop,
    harvestAllFarmCrops,
    consumeHouseFood,
    consumeAllHouseFood,
    processWindmillCollection,
    runWindmillSurplusCycle,
    runCityMarketFoodCycle,
    runMonthlyFoodSupplyCycle,
    runCityFactoryProductionCycle,
    collectFactoryResources,
    transformFactoryMaterials,
    produceFactoryGoods,
    processFactoryProductionStep,
    getCityFactoryResourcesQuery,
    factoryBuildingRepository,
    getBuildingSupplyViewQuery,
    listSupplyMapBuildingsQuery,
    listWindmillSupplyViewsQuery,
    listSupplyStockSnapshotsQuery,

    async buyFromNearbyFarms(marketId, farmRefs, season) {
      return marketBuysFromNearbyFarms.execute({ marketId, farmRefs, season });
    },

    async markBuyingSeason(season) {
      return markMarketBuyingSeason.execute(season);
    },

    async distributeToHouses(marketId, houseRefs, season) {
      return distributeFoodFromMarketToHouses.execute({
        marketId,
        houseRefs,
        season,
      });
    },

    async collectFromAllFarms(windmillId, farmRefs, month) {
      return windmillCollectsFromAllFarms.execute({
        windmillId,
        farmRefs,
        month,
      });
    },

    async updateMarketReach(maxDistance) {
      return updateHousesMarketReach.execute({ maxDistance });
    },

    async updateFarmProximity(marketId, hasFarmsNearby) {
      return updateMarketFarmProximity.execute({ marketId, hasFarmsNearby });
    },

    async markCollectingSeason(month) {
      return markWindmillCollectingSeason.execute(month);
    },

    async resetSoldToWindmill(options) {
      return resetFarmsSoldToWindmill.execute(options);
    },

    async setWindmillCollecting(windmillId, isCollecting) {
      return setWindmillCollectingFlag.execute({ windmillId, isCollecting });
    },

    async markFarmSoldToWindmill(farmId, soldToWindmill = true) {
      return markFarmSoldToWindmill.execute({ farmId, soldToWindmill });
    },

    async harvestFarmCrop(farmId, season, year, monthIndex = null) {
      return harvestFarmCrop.execute({ farmId, season, year, monthIndex });
    },

    async harvestAllFarmCrops({ season, year, monthIndex = null }) {
      return harvestAllFarmCrops.execute({ season, year, monthIndex });
    },

    async consumeHouseFood(houseId, monthIndex) {
      return consumeHouseFood.execute({ houseId, monthIndex });
    },

    async consumeAllHouseFood({ monthIndex }) {
      return consumeAllHouseFood.execute({ monthIndex });
    },

    async runWindmillSurplusCycle({ month, monthIndex, dayInMonth, year }) {
      return runWindmillSurplusCycle.execute({
        month,
        monthIndex,
        dayInMonth,
        year,
      });
    },

    async runMonthlyFoodSupplyCycle({ season, month, timeInfo, maxDistance = 5 }) {
      return runMonthlyFoodSupplyCycle.execute({
        season,
        month,
        timeInfo,
        maxDistance,
      });
    },

    async runCityFactoryProductionCycle({ city, time = 0 }) {
      return runCityFactoryProductionCycle.execute({ city, time });
    },

    async getCityFactoryResources(city) {
      return getCityFactoryResourcesQuery.execute({ city });
    },

    async getBuildingSupplyView(buildingId) {
      return getBuildingSupplyViewQuery.execute(buildingId);
    },

    async listSupplyMapBuildings() {
      return listSupplyMapBuildingsQuery.execute();
    },

    async listWindmillSupplyViews() {
      return listWindmillSupplyViewsQuery.execute();
    },

    async listSupplyStockSnapshots() {
      return listSupplyStockSnapshotsQuery.execute();
    },
  };
}

/** @type {ReturnType<typeof createSupplyContext> | null} */
let sharedSupply = null;
/** @type {object | null} */
let sharedHousesStore = null;

export function getOrCreateSupplyContext(housesStore) {
  if (!sharedSupply || sharedHousesStore !== housesStore) {
    sharedSupply = createSupplyContext({ housesStore });
    sharedHousesStore = housesStore;
  }
  return sharedSupply;
}

/** @internal Tests only */
export function resetSupplyContextForTests() {
  sharedSupply = null;
  sharedHousesStore = null;
}
