import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { TransferHubToHub } from '../contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { DistributeResourceToConsumers } from '../contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { CollectResourceToHub } from '../contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { UpdateHousesMarketReach } from '../contexts/supply/application/commands/distribution/UpdateHousesMarketReach.js';
import { UpdateMarketWindmillLink } from '../contexts/supply/application/commands/procurement/UpdateMarketWindmillLink.js';
import { RebalanceHubAllocations } from '../contexts/supply/application/commands/links/RebalanceHubAllocations.js';
import { AssignDistributorToHub } from '../contexts/supply/application/commands/links/AssignDistributorToHub.js';
import { DetachDistributorFromHub } from '../contexts/supply/application/commands/links/DetachDistributorFromHub.js';
import { CascadeDestroyHubDistributors } from '../contexts/supply/application/commands/links/CascadeDestroyHubDistributors.js';
import { UpdateMarketFarmProximity } from '../contexts/supply/application/commands/procurement/UpdateMarketFarmProximity.js';
import { MarkWindmillCollectingSeason } from '../contexts/supply/application/commands/surplus/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../contexts/supply/application/commands/surplus/ResetFarmsSoldToWindmill.js';
import { SetWindmillCollectingFlag } from '../contexts/supply/application/commands/surplus/SetWindmillCollectingFlag.js';
import { MarkFarmSoldToWindmill } from '../contexts/supply/application/commands/surplus/MarkFarmSoldToWindmill.js';
import { ProduceResource } from '../contexts/supply/application/commands/harvest/ProduceResource.js';
import { HarvestAllFarmCrops } from '../contexts/supply/application/commands/harvest/HarvestAllFarmCrops.js';
import { ConsumeResource } from '../contexts/supply/application/commands/consumption/ConsumeResource.js';
import { ConsumeAllHouseFood } from '../contexts/supply/application/commands/consumption/ConsumeAllHouseFood.js';
import { ProduceHouseSubsistenceFood } from '../contexts/supply/application/commands/subsistence/ProduceHouseSubsistenceFood.js';
import { ProduceAllHouseSubsistenceFood } from '../contexts/supply/application/commands/subsistence/ProduceAllHouseSubsistenceFood.js';
import { ProcessWindmillCollection } from '../contexts/supply/application/commands/surplus/ProcessWindmillCollection.js';
import { RunWindmillSurplusCycle } from '../contexts/supply/application/commands/surplus/RunWindmillSurplusCycle.js';
import { RunCityResourceCycle } from '../contexts/supply/application/commands/procurement/RunCityResourceCycle.js';
import { RunMonthlyFoodSupplyCycle } from '../contexts/supply/application/workflows/RunMonthlyFoodSupplyCycle.js';
import {
  FARM_HARVEST_CIRCUIT,
  WINDMILL_COLLECT_CIRCUIT,
  MARKET_WINDMILL_TRANSFER_CIRCUIT,
  MARKET_DISTRIBUTE_CIRCUIT,
  HOUSE_FOOD_CONSUMPTION_CIRCUIT,
} from '../contexts/supply/domain/catalogs/FoodCircuits.js';
import { FOOD_CIRCUIT } from '../contexts/supply/domain/catalogs/FoodCircuitCatalog.js';
import { DexieFoodTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieFoodTraceabilityRepository.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { SupplyFoodTraceability } from '../contexts/supply/infrastructure/presentation/SupplyFoodTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { ListSupplyMapBuildings } from '../contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListWindmillSupplyViews } from '../contexts/supply/application/queries/ListWindmillSupplyViews.js';
import { ListSupplyStockSnapshots } from '../contexts/supply/application/queries/ListSupplyStockSnapshots.js';
import { GetHubStorageInfoView } from '../contexts/supply/application/queries/GetHubStorageInfoView.js';
import {
  cycleHubStorageMode,
  normalizeHubStorageOrders,
  tryAdjustHubStoragePercent,
} from '../contexts/supply/domain/policies/HubStorageOrdersPolicy.js';
import { listHubProducts } from '../contexts/supply/domain/catalogs/HubStorageCatalog.js';
import { getSharedEventBus } from './sharedEventBus.js';

/**
 * Composition root — Supply bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/supply/application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} [deps.supplyBuildingRepository]
 * @param {import('../contexts/supply/infrastructure/dexie/DexieFoodTraceabilityRepository.js').DexieFoodTraceabilityRepository} [deps.foodTraceabilityRepository]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  foodTraceabilityRepository,
  getTimeInfo: getTimeInfoDep,
} = {}) {
  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();
  const supplyBuildingRepositoryImpl =
    supplyBuildingRepository ?? new DexieSupplyBuildingRepository();
  const foodTraceabilityRepositoryImpl =
    foodTraceabilityRepository ?? new DexieFoodTraceabilityRepository();
  const transferHubToHub = new TransferHubToHub(
    supplyBuildingRepositoryImpl
  );
  const rebalanceHubAllocations = new RebalanceHubAllocations(
    supplyBuildingRepositoryImpl
  );
  const assignDistributorToHub = new AssignDistributorToHub(
    supplyBuildingRepositoryImpl,
    rebalanceHubAllocations,
    FOOD_CIRCUIT.crops
  );
  const detachDistributorFromHub = new DetachDistributorFromHub(
    supplyBuildingRepositoryImpl,
    rebalanceHubAllocations
  );
  const cascadeDestroyHubDistributors = new CascadeDestroyHubDistributors(
    supplyBuildingRepositoryImpl
  );
  const distributeResourceToConsumers = new DistributeResourceToConsumers(
    supplyBuildingRepositoryImpl
  );
  const collectResourceToHub = new CollectResourceToHub(
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
  const produceResource = new ProduceResource(supplyBuildingRepositoryImpl);
  const harvestAllFarmCrops = new HarvestAllFarmCrops(
    supplyBuildingRepositoryImpl,
    produceResource
  );
  const consumeResource = new ConsumeResource(supplyBuildingRepositoryImpl);
  const consumeAllHouseFood = new ConsumeAllHouseFood(
    supplyBuildingRepositoryImpl,
    consumeResource
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
    collectResourceToHub,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill
  );
  const runWindmillSurplusCycle = new RunWindmillSurplusCycle(
    supplyBuildingRepositoryImpl,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    processWindmillCollection,
    {
      execute: ({ windmillId }) =>
        rebalanceHubAllocations.execute({ hubId: windmillId, categories: FOOD_CIRCUIT.crops }),
    }
  );
  const traceability = new SupplyFoodTraceability({
    foodTraceabilityRepository: foodTraceabilityRepositoryImpl,
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
  });
  const runCityResourceCycle = new RunCityResourceCycle(
    supplyBuildingRepositoryImpl,
    distributeResourceToConsumers,
    getSharedEventBus(),
    {
      transferHubToHub,
      onHubLinkResolved: (marketId, hasWindmillLink) =>
        updateMarketWindmillLink.execute({ marketId, hasWindmillLink }),
      onHubTransfer: (marketId, transfers, timeInfo) =>
        traceability.recordWindmillToMarketTransfers(
          timeInfo,
          marketId,
          transfers.map((t) => ({ windmillId: t.sourceId, crop: t.category, amount: t.amount }))
        ),
      onDistribute: (marketId, transfers, timeInfo) =>
        traceability.recordMarketToHouseTransfers(
          timeInfo,
          marketId,
          transfers.map((t) => ({ houseId: t.consumerId, crop: t.category, amount: t.amount }))
        ),
    }
  );
  const runMonthlyFoodSupplyCycle = new RunMonthlyFoodSupplyCycle(
    harvestAllFarmCrops,
    runCityResourceCycle,
    updateHousesMarketReach,
    runWindmillSurplusCycle,
    consumeAllHouseFood,
    traceability,
    produceAllHouseSubsistenceFood
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
  const getHubStorageInfoView = new GetHubStorageInfoView();

  return {
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
    transferHubToHub,
    assignDistributorToHub,
    detachDistributorFromHub,
    cascadeDestroyHubDistributors,
    rebalanceHubAllocations,
    distributeResourceToConsumers,
    collectResourceToHub,
    updateHousesMarketReach,
    updateMarketWindmillLink,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    setWindmillCollectingFlag,
    markFarmSoldToWindmill,
    produceResource,
    harvestAllFarmCrops,
    consumeResource,
    consumeAllHouseFood,
    produceHouseSubsistenceFood,
    produceAllHouseSubsistenceFood,
    processWindmillCollection,
    runWindmillSurplusCycle,
    runCityResourceCycle,
    runMonthlyFoodSupplyCycle,
    getBuildingSupplyViewQuery,
    listSupplyMapBuildingsQuery,
    listWindmillSupplyViewsQuery,
    listSupplyStockSnapshotsQuery,

    async buyFromAssignedWindmill(marketId, month = null) {
      return transferHubToHub.execute({
        targetId: marketId,
        period: { month },
        circuit: MARKET_WINDMILL_TRANSFER_CIRCUIT,
      });
    },

    async assignDistributorToHub({ distributorId, distributorType, x, y, ownerHubId }) {
      return assignDistributorToHub.execute({ distributorId, distributorType, x, y, ownerHubId });
    },

    async detachDistributorFromHub({ distributorId }) {
      return detachDistributorFromHub.execute({ distributorId, categories: FOOD_CIRCUIT.crops });
    },

    async cascadeDestroyHubDistributors({ hubId, city, bulldozeBuildingAtTile }) {
      return cascadeDestroyHubDistributors.execute({ hubId, city, bulldozeBuildingAtTile });
    },

    async rebalanceWindmillAllocations(windmillId) {
      return rebalanceHubAllocations.execute({ hubId: windmillId, categories: FOOD_CIRCUIT.crops });
    },

    async initializeHubLinks({ hubId }) {
      await supplyBuildingRepositoryImpl.saveLinkedMarkets(hubId, []);
      return { initialized: true, hubId };
    },

    async hasOperationalWindmill() {
      const windmills = await supplyBuildingRepositoryImpl.findWindmills();
      return windmills.length > 0;
    },

    async distributeToHouses(marketId, houseRefs, season) {
      return distributeResourceToConsumers.execute({
        sourceId: marketId,
        consumerRefs: houseRefs,
        period: { season },
        circuit: MARKET_DISTRIBUTE_CIRCUIT,
      });
    },

    async collectFromAllFarms(windmillId, farmRefs, month) {
      return collectResourceToHub.execute({
        hubId: windmillId,
        sourceRefs: farmRefs,
        period: { month },
        circuit: WINDMILL_COLLECT_CIRCUIT,
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
      return produceResource.execute({
        buildingId: farmId,
        period: { season, year, monthIndex },
        circuit: FARM_HARVEST_CIRCUIT,
      });
    },

    async harvestAllFarmCrops({ season, year, monthIndex = null }) {
      return harvestAllFarmCrops.execute({ season, year, monthIndex });
    },

    async consumeHouseFood(houseId, monthIndex) {
      return consumeResource.execute({
        buildingId: houseId,
        period: { monthIndex },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });
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
      return orders;
    },

    async adjustHubStorageOrderShare(hubKind, buildingId, productId, delta) {
      const row = await supplyBuildingRepositoryImpl.findRowById(buildingId);
      const productIds = listHubProducts(hubKind);
      const orders = normalizeHubStorageOrders(row?.hubStorageOrders, productIds);
      const stocks = row?.stocks ?? {};
      const totalCapacity = row?.maxStock ?? 1000;

      const currentAmount = Math.max(0, Math.floor(Number(stocks[productId]) || 0));

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
      return { ok: true, orders };
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

    async listNatureResources() {
      return supplyBuildingRepositoryImpl.listNatureItems();
    },

    async getSupplyBuildingRow(buildingId) {
      return supplyBuildingRepositoryImpl.findRowById(buildingId);
    },

    async updateSupplyBuildingFields(buildingId, fields) {
      return supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, fields);
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
