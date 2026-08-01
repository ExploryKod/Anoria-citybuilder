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
import appRegistry from '../js/game/AppRegistry.js';
import { SupplyFoodTraceability } from '../contexts/supply/infrastructure/presentation/SupplyFoodTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { ListSupplyMapBuildings } from '../contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListWindmillSupplyViews } from '../contexts/supply/application/queries/ListWindmillSupplyViews.js';
import { ListSupplyStockSnapshots } from '../contexts/supply/application/queries/ListSupplyStockSnapshots.js';

/**
 * Composition root — Supply bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/supply/application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} [deps.supplyBuildingRepository]
 * @param {import('../contexts/supply/application/ports/FactoryBuildingRepository.js').FactoryBuildingRepository} [deps.factoryBuildingRepository]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  factoryBuildingRepository,
} = {}) {
  const supplyBuildingRepositoryImpl =
    supplyBuildingRepository ?? new DexieSupplyBuildingRepository();
  const factoryBuildingRepositoryImpl =
    factoryBuildingRepository ?? new DexieFactoryBuildingRepository();
  const productionJournal = new SupplyProductionJournal({
    resolveTimeInfo: (turn) => {
      const timeManager = appRegistry.get('timeManager');
      return timeManager?.getTimeInfo?.(turn) ?? null;
    },
  });
  const marketBuysFromNearbyFarms = new MarketBuysFromNearbyFarms(
    supplyBuildingRepositoryImpl
  );
  const markMarketBuyingSeason = new MarkMarketBuyingSeason(supplyBuildingRepositoryImpl);
  const distributeFoodFromMarketToHouses = new DistributeFoodFromMarketToHouses(
    supplyBuildingRepositoryImpl
  );
  const windmillCollectsFromAllFarms = new WindmillCollectsFromAllFarms(
    supplyBuildingRepositoryImpl
  );
  const updateHousesMarketReach = new UpdateHousesMarketReach(
    supplyBuildingRepositoryImpl
  );
  const updateMarketFarmProximity = new UpdateMarketFarmProximity(
    supplyBuildingRepositoryImpl
  );
  const markWindmillCollectingSeason = new MarkWindmillCollectingSeason(
    supplyBuildingRepositoryImpl
  );
  const resetFarmsSoldToWindmill = new ResetFarmsSoldToWindmill(
    supplyBuildingRepositoryImpl
  );
  const setWindmillCollectingFlag = new SetWindmillCollectingFlag(
    supplyBuildingRepositoryImpl
  );
  const markFarmSoldToWindmill = new MarkFarmSoldToWindmill(
    supplyBuildingRepositoryImpl
  );
  const harvestFarmCrop = new HarvestFarmCrop(supplyBuildingRepositoryImpl);
  const harvestAllFarmCrops = new HarvestAllFarmCrops(
    supplyBuildingRepositoryImpl,
    harvestFarmCrop
  );
  const consumeHouseFood = new ConsumeHouseFood(supplyBuildingRepositoryImpl);
  const consumeAllHouseFood = new ConsumeAllHouseFood(
    supplyBuildingRepositoryImpl,
    consumeHouseFood
  );
  const processWindmillCollection = new ProcessWindmillCollection(
    supplyBuildingRepositoryImpl,
    windmillCollectsFromAllFarms,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill
  );
  const runWindmillSurplusCycle = new RunWindmillSurplusCycle(
    supplyBuildingRepositoryImpl,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    processWindmillCollection
  );
  const traceability = new SupplyFoodTraceability({
    resolveFoodTraceabilityService: () => appRegistry.get('foodTraceabilityService'),
  });
  const runCityMarketFoodCycle = new RunCityMarketFoodCycle(
    supplyBuildingRepositoryImpl,
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
    factoryBuildingRepositoryImpl,
    productionJournal
  );
  const transformFactoryMaterials = new TransformFactoryMaterials(
    factoryBuildingRepositoryImpl,
    productionJournal
  );
  const produceFactoryGoods = new ProduceFactoryGoods(
    factoryBuildingRepositoryImpl,
    productionJournal
  );
  const processFactoryProductionStep = new ProcessFactoryProductionStep(
    factoryBuildingRepositoryImpl,
    collectFactoryResources,
    transformFactoryMaterials,
    produceFactoryGoods
  );
  const runCityFactoryProductionCycle = new RunCityFactoryProductionCycle(
    factoryBuildingRepositoryImpl,
    processFactoryProductionStep
  );
  const getCityFactoryResourcesQuery = new GetCityFactoryResources(
    factoryBuildingRepositoryImpl
  );
  const getBuildingSupplyViewQuery = new GetBuildingSupplyView(
    supplyBuildingRepositoryImpl
  );
  const listSupplyMapBuildingsQuery = new ListSupplyMapBuildings(
    supplyBuildingRepositoryImpl
  );
  const listWindmillSupplyViewsQuery = new ListWindmillSupplyViews(
    supplyBuildingRepositoryImpl
  );
  const listSupplyStockSnapshotsQuery = new ListSupplyStockSnapshots(
    supplyBuildingRepositoryImpl
  );

  return {
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
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
    factoryBuildingRepository: factoryBuildingRepositoryImpl,
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

    async listCityFactories() {
      return factoryBuildingRepositoryImpl.findFactories();
    },

    async listNatureResources() {
      return factoryBuildingRepositoryImpl.listNatureItems();
    },

    async getFactoryById(factoryId) {
      return factoryBuildingRepositoryImpl.findById(factoryId);
    },

    async updateFactoryFields(factoryId, fields) {
      return factoryBuildingRepositoryImpl.updateFields(factoryId, fields);
    },

    async getSupplyBuildingRow(buildingId) {
      return supplyBuildingRepositoryImpl.findRowById(buildingId);
    },

    async updateSupplyBuildingFields(buildingId, fields) {
      return supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, fields);
    },

    async listProductionJournalEntries(factoryId = null, turn = null) {
      return productionJournal.getProductionEntries(factoryId, turn);
    },

    async getFactoryProductionJournalEntries(factoryId) {
      return productionJournal.getFactoryProductionEntries(factoryId);
    },
  };
}

/** @type {ReturnType<typeof createSupplyContext> | null} */
let sharedSupply = null;

export function getOrCreateSupplyContext() {
  if (!sharedSupply) {
    sharedSupply = createSupplyContext();
  }
  return sharedSupply;
}

/** @internal Tests only */
export function resetSupplyContextForTests() {
  sharedSupply = null;
}
