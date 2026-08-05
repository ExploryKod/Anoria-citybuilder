import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { MarketBuysFromAssignedWindmill } from '../contexts/supply/application/commands/procurement/MarketBuysFromAssignedWindmill.js';
import { DistributeFoodFromMarketToHouses } from '../contexts/supply/application/commands/distribution/DistributeFoodFromMarketToHouses.js';
import { WindmillCollectsFromAllFarms } from '../contexts/supply/application/commands/surplus/WindmillCollectsFromAllFarms.js';
import { UpdateHousesMarketReach } from '../contexts/supply/application/commands/distribution/UpdateHousesMarketReach.js';
import { UpdateMarketWindmillLink } from '../contexts/supply/application/commands/procurement/UpdateMarketWindmillLink.js';
import { RebalanceWindmillMarketAllocations } from '../contexts/supply/application/commands/links/RebalanceWindmillMarketAllocations.js';
import { AssignMarketToWindmill } from '../contexts/supply/application/commands/links/AssignMarketToWindmill.js';
import { DetachMarketFromWindmill } from '../contexts/supply/application/commands/links/DetachMarketFromWindmill.js';
import { CascadeDestroyWindmillMarkets } from '../contexts/supply/application/commands/links/CascadeDestroyWindmillMarkets.js';
import { UpdateMarketFarmProximity } from '../contexts/supply/application/commands/procurement/UpdateMarketFarmProximity.js';
import { MarkWindmillCollectingSeason } from '../contexts/supply/application/commands/surplus/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../contexts/supply/application/commands/surplus/ResetFarmsSoldToWindmill.js';
import { SetWindmillCollectingFlag } from '../contexts/supply/application/commands/surplus/SetWindmillCollectingFlag.js';
import { MarkFarmSoldToWindmill } from '../contexts/supply/application/commands/surplus/MarkFarmSoldToWindmill.js';
import { HarvestFarmCrop } from '../contexts/supply/application/commands/harvest/HarvestFarmCrop.js';
import { HarvestAllFarmCrops } from '../contexts/supply/application/commands/harvest/HarvestAllFarmCrops.js';
import { ConsumeHouseFood } from '../contexts/supply/application/commands/consumption/ConsumeHouseFood.js';
import { ConsumeAllHouseFood } from '../contexts/supply/application/commands/consumption/ConsumeAllHouseFood.js';
import { ProduceHouseSubsistenceFood } from '../contexts/supply/application/commands/subsistence/ProduceHouseSubsistenceFood.js';
import { ProduceAllHouseSubsistenceFood } from '../contexts/supply/application/commands/subsistence/ProduceAllHouseSubsistenceFood.js';
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
import { DexieFoodTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieFoodTraceabilityRepository.js';
import { SupplyProductionJournal } from '../contexts/supply/infrastructure/presentation/SupplyProductionJournal.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { SupplyFoodTraceability } from '../contexts/supply/infrastructure/presentation/SupplyFoodTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { ListSupplyMapBuildings } from '../contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListWindmillSupplyViews } from '../contexts/supply/application/queries/ListWindmillSupplyViews.js';
import { ListSupplyStockSnapshots } from '../contexts/supply/application/queries/ListSupplyStockSnapshots.js';
import { BarnStockOperations } from '../contexts/supply/application/services/BarnStockOperations.js';
import { TransferFactoryToBarn } from '../contexts/supply/application/commands/commerce/TransferFactoryToBarn.js';
import { RunMonthlyCommerceSupplyCycle } from '../contexts/supply/application/workflows/RunMonthlyCommerceSupplyCycle.js';
import { UpdateFactoryWorkerDemandFromCaps } from '../contexts/supply/application/commands/manufacturing/UpdateFactoryWorkerDemandFromCaps.js';
import { AllocateFactoryWorkersToCommodityLines } from '../contexts/supply/application/commands/manufacturing/AllocateFactoryWorkersToCommodityLines.js';
import { GetFactoryWorkerPlanView } from '../contexts/supply/application/queries/GetFactoryWorkerPlanView.js';
import { GetHubStorageInfoView } from '../contexts/supply/application/queries/GetHubStorageInfoView.js';
import { ExecuteHubFetchOrders } from '../contexts/supply/application/commands/commerce/ExecuteHubFetchOrders.js';
import {
  cycleHubStorageMode,
  normalizeHubStorageOrders,
  tryAdjustHubStoragePercent,
} from '../contexts/supply/domain/policies/HubStorageOrdersPolicy.js';
import { HUB_KIND, listHubProducts } from '../contexts/supply/domain/catalogs/HubStorageCatalog.js';
import { createEmptyCommerceStocks } from '../contexts/supply/domain/catalogs/BarnCommerceCatalog.js';
import {
  getBarnProductStock,
  getBarnTotalCapacity,
} from '../contexts/supply/domain/policies/BarnStockPolicy.js';

/**
 * Composition root — Supply bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/supply/application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} [deps.supplyBuildingRepository]
 * @param {import('../contexts/supply/application/ports/FactoryBuildingRepository.js').FactoryBuildingRepository} [deps.factoryBuildingRepository]
 * @param {import('../contexts/supply/infrastructure/dexie/DexieFoodTraceabilityRepository.js').DexieFoodTraceabilityRepository} [deps.foodTraceabilityRepository]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  factoryBuildingRepository,
  foodTraceabilityRepository,
  getTimeInfo: getTimeInfoDep,
} = {}) {
  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();
  const supplyBuildingRepositoryImpl =
    supplyBuildingRepository ?? new DexieSupplyBuildingRepository();
  const factoryBuildingRepositoryImpl =
    factoryBuildingRepository ?? new DexieFactoryBuildingRepository();
  const foodTraceabilityRepositoryImpl =
    foodTraceabilityRepository ?? new DexieFoodTraceabilityRepository();
  const productionJournal = new SupplyProductionJournal({
    resolveTimeInfo: (turn) => getTimeInfo(turn) ?? null,
  });
  const marketBuysFromAssignedWindmill = new MarketBuysFromAssignedWindmill(
    supplyBuildingRepositoryImpl
  );
  const rebalanceWindmillMarketAllocations = new RebalanceWindmillMarketAllocations(
    supplyBuildingRepositoryImpl
  );
  const assignMarketToWindmill = new AssignMarketToWindmill(
    supplyBuildingRepositoryImpl,
    rebalanceWindmillMarketAllocations
  );
  const detachMarketFromWindmill = new DetachMarketFromWindmill(
    supplyBuildingRepositoryImpl,
    rebalanceWindmillMarketAllocations
  );
  const cascadeDestroyWindmillMarkets = new CascadeDestroyWindmillMarkets(
    supplyBuildingRepositoryImpl,
    detachMarketFromWindmill
  );
  const distributeFoodFromMarketToHouses = new DistributeFoodFromMarketToHouses(
    supplyBuildingRepositoryImpl
  );
  const windmillCollectsFromAllFarms = new WindmillCollectsFromAllFarms(
    supplyBuildingRepositoryImpl
  );
  const updateHousesMarketReach = new UpdateHousesMarketReach(
    supplyBuildingRepositoryImpl
  );
  const updateMarketWindmillLink = new UpdateMarketWindmillLink(
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
  const produceHouseSubsistenceFood = new ProduceHouseSubsistenceFood(
    supplyBuildingRepositoryImpl
  );
  const produceAllHouseSubsistenceFood = new ProduceAllHouseSubsistenceFood(
    supplyBuildingRepositoryImpl,
    produceHouseSubsistenceFood
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
    processWindmillCollection,
    rebalanceWindmillMarketAllocations
  );
  const traceability = new SupplyFoodTraceability({
    foodTraceabilityRepository: foodTraceabilityRepositoryImpl,
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
  });
  const runCityMarketFoodCycle = new RunCityMarketFoodCycle(
    supplyBuildingRepositoryImpl,
    marketBuysFromAssignedWindmill,
    distributeFoodFromMarketToHouses,
    updateMarketWindmillLink,
    traceability
  );
  const runMonthlyFoodSupplyCycle = new RunMonthlyFoodSupplyCycle(
    harvestAllFarmCrops,
    runCityMarketFoodCycle,
    updateHousesMarketReach,
    runWindmillSurplusCycle,
    consumeAllHouseFood,
    traceability,
    produceAllHouseSubsistenceFood
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
  const barnStockOperations = new BarnStockOperations(supplyBuildingRepositoryImpl);
  const transferFactoryToBarn = new TransferFactoryToBarn(
    factoryBuildingRepositoryImpl,
    supplyBuildingRepositoryImpl,
    barnStockOperations
  );
  const runMonthlyCommerceSupplyCycle = new RunMonthlyCommerceSupplyCycle(
    transferFactoryToBarn
  );
  const updateFactoryWorkerDemandFromCaps = new UpdateFactoryWorkerDemandFromCaps(
    factoryBuildingRepositoryImpl
  );
  const allocateFactoryWorkersToCommodityLines = new AllocateFactoryWorkersToCommodityLines(
    factoryBuildingRepositoryImpl
  );
  const getFactoryWorkerPlanView = new GetFactoryWorkerPlanView();
  const getHubStorageInfoView = new GetHubStorageInfoView();
  const executeHubFetchOrders = new ExecuteHubFetchOrders(
    supplyBuildingRepositoryImpl,
    factoryBuildingRepositoryImpl
  );

  return {
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
    marketBuysFromAssignedWindmill,
    assignMarketToWindmill,
    detachMarketFromWindmill,
    cascadeDestroyWindmillMarkets,
    rebalanceWindmillMarketAllocations,
    distributeFoodFromMarketToHouses,
    windmillCollectsFromAllFarms,
    updateHousesMarketReach,
    updateMarketWindmillLink,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill,
    harvestFarmCrop,
    harvestAllFarmCrops,
    consumeHouseFood,
    consumeAllHouseFood,
    produceHouseSubsistenceFood,
    produceAllHouseSubsistenceFood,
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
    barnStockOperations,
    transferFactoryToBarn,
    runMonthlyCommerceSupplyCycle,
    updateFactoryWorkerDemandFromCaps,
    allocateFactoryWorkersToCommodityLines,
    getFactoryWorkerPlanView,

    async buyFromAssignedWindmill(marketId, month = null) {
      return marketBuysFromAssignedWindmill.execute({ marketId, month });
    },

    async assignMarketToWindmill(params) {
      return assignMarketToWindmill.execute(params);
    },

    async detachMarketFromWindmill(params) {
      return detachMarketFromWindmill.execute(params);
    },

    async cascadeDestroyWindmillMarkets(params) {
      return cascadeDestroyWindmillMarkets.execute(params);
    },

    async rebalanceWindmillAllocations(windmillId) {
      return rebalanceWindmillMarketAllocations.execute({ windmillId });
    },

    async initializeWindmillLinks({ windmillId }) {
      await supplyBuildingRepositoryImpl.saveLinkedMarkets(windmillId, []);
      return { initialized: true, windmillId };
    },

    async hasOperationalWindmill() {
      const windmills = await supplyBuildingRepositoryImpl.findWindmills();
      return windmills.length > 0;
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

    async updateWindmillLink(marketId, hasWindmillLink) {
      return updateMarketWindmillLink.execute({ marketId, hasWindmillLink });
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

    async produceHouseSubsistenceFood(houseId, monthIndex) {
      return produceHouseSubsistenceFood.execute({ houseId, monthIndex });
    },

    async produceAllHouseSubsistenceFood({ monthIndex }) {
      return produceAllHouseSubsistenceFood.execute({ monthIndex });
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

    async runMonthlyCommerceSupplyCycle({ monthIndex, time = 0 }) {
      return runMonthlyCommerceSupplyCycle.execute({ monthIndex, time });
    },

    async syncFactoryWorkerDemandFromCaps() {
      return updateFactoryWorkerDemandFromCaps.execute();
    },

    async allocateFactoryWorkersToCommodityLines() {
      return allocateFactoryWorkersToCommodityLines.execute();
    },

    getFactoryWorkerPlanView(factory, options = {}) {
      return getFactoryWorkerPlanView.execute({ factory, ...options });
    },

    getHubStorageInfoView(hubKind, buildingRow, options = {}) {
      return getHubStorageInfoView.execute({ hubKind, buildingRow, ...options });
    },

    async updateHubStorageOrderMode(hubKind, buildingId, productId) {
      const row = await supplyBuildingRepositoryImpl.findRowById(buildingId);
      const productIds = listHubProducts(hubKind);
      const orders = normalizeHubStorageOrders(row?.hubStorageOrders, productIds);
      orders[productId] = {
        ...orders[productId],
        mode: cycleHubStorageMode(orders[productId].mode),
      };
      await supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, {
        hubStorageOrders: orders,
      });
      if (hubKind === HUB_KIND.BARN && orders[productId].mode === 'fetch') {
        await executeHubFetchOrders.execute({ hubKind, buildingId });
      }
      return orders;
    },

    async adjustHubStorageOrderShare(hubKind, buildingId, productId, delta) {
      const row = await supplyBuildingRepositoryImpl.findRowById(buildingId);
      const productIds = listHubProducts(hubKind);
      const orders = normalizeHubStorageOrders(row?.hubStorageOrders, productIds);
      const stocks =
        hubKind === HUB_KIND.BARN
          ? createEmptyCommerceStocks(row?.commerceStocks)
          : row?.stocks ?? {};
      const totalCapacity =
        hubKind === HUB_KIND.BARN ? getBarnTotalCapacity(row) : row?.maxStock ?? 1000;

      const currentAmount =
        hubKind === HUB_KIND.BARN
          ? getBarnProductStock(stocks, productId)
          : Math.max(0, Math.floor(Number(stocks[productId]) || 0));

      const attempt = tryAdjustHubStoragePercent({
        order: orders[productId],
        deltaSteps: delta,
        currentAmount,
        totalCapacity,
      });

      if (!attempt.ok) {
        return attempt;
      }

      orders[productId] = attempt.order;
      await supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, {
        hubStorageOrders: orders,
      });
      if (hubKind === HUB_KIND.BARN && orders[productId].mode === 'fetch') {
        await executeHubFetchOrders.execute({ hubKind, buildingId });
      }
      return { ok: true, orders };
    },

    async executeHubFetchOrders(hubKind, buildingId) {
      return executeHubFetchOrders.execute({ hubKind, buildingId });
    },

    async getCommerceHubStocks() {
      return barnStockOperations.getAllCommerceStocks();
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

    async getAllFoodTraceabilityTransactions(maxAge = null) {
      return foodTraceabilityRepositoryImpl.getAllTransactions(maxAge);
    },

    async getFoodTraceabilityTransactionsForMonth(turn, month = null) {
      return foodTraceabilityRepositoryImpl.getTransactionsForMonth(turn, month);
    },

    async getFoodTraceabilityTransactionsByMonth(turn) {
      return foodTraceabilityRepositoryImpl.getTransactionsByMonth(turn);
    },

    async cleanupOldFoodTraceabilityTransactions(maxAge = 60) {
      return foodTraceabilityRepositoryImpl.cleanupOldTransactions(maxAge);
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
