import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { TransferHubToHub } from '../contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { DistributeResourceToConsumers } from '../contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { CollectResourceToHub } from '../contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { UpdateConsumerDistributorReach } from '../contexts/supply/application/commands/distribution/UpdateConsumerDistributorReach.js';
import { UpdateDistributorHubLink } from '../contexts/supply/application/commands/procurement/UpdateDistributorHubLink.js';
import { RebalanceHubAllocations } from '../contexts/supply/application/commands/links/RebalanceHubAllocations.js';
import { AssignDistributorToHub } from '../contexts/supply/application/commands/links/AssignDistributorToHub.js';
import { DetachDistributorFromHub } from '../contexts/supply/application/commands/links/DetachDistributorFromHub.js';
import { CascadeDestroyHubDistributors } from '../contexts/supply/application/commands/links/CascadeDestroyHubDistributors.js';
import { MarkHubCollectingSchedule } from '../contexts/supply/application/commands/surplus/MarkHubCollectingSchedule.js';
import { ResetSourcesCollectedFlag } from '../contexts/supply/application/commands/surplus/ResetSourcesCollectedFlag.js';
import { SetHubCollectingFlag } from '../contexts/supply/application/commands/surplus/SetHubCollectingFlag.js';
import { MarkSourceCollectedByHub } from '../contexts/supply/application/commands/surplus/MarkSourceCollectedByHub.js';
import { ProduceResource } from '../contexts/supply/application/commands/harvest/ProduceResource.js';
import { ConsumeResource } from '../contexts/supply/application/commands/consumption/ConsumeResource.js';
import { ProduceConsumerSubsistence } from '../contexts/supply/application/commands/subsistence/ProduceConsumerSubsistence.js';
import { RunResourceCommandForRole } from '../contexts/supply/application/commands/RunResourceCommandForRole.js';
import { ProcessHubCollection } from '../contexts/supply/application/commands/surplus/ProcessHubCollection.js';
import { RunHubSurplusCycle } from '../contexts/supply/application/commands/surplus/RunHubSurplusCycle.js';
import { RunCityResourceCycle } from '../contexts/supply/application/commands/procurement/RunCityResourceCycle.js';
import { RunMonthlyResourceCycle } from '../contexts/supply/application/workflows/RunMonthlyResourceCycle.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { SupplyTraceability } from '../contexts/supply/infrastructure/presentation/SupplyTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { ListSupplyMapBuildings } from '../contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListHubSupplyViews } from '../contexts/supply/application/queries/ListHubSupplyViews.js';
import { ListSupplyStockSnapshots } from '../contexts/supply/application/queries/ListSupplyStockSnapshots.js';
import { GetHubStorageInfoView } from '../contexts/supply/application/queries/GetHubStorageInfoView.js';
import {
  cycleHubStorageMode,
  normalizeHubStorageOrders,
  tryAdjustHubStoragePercent,
} from '../contexts/supply/domain/policies/HubStorageOrdersPolicy.js';
import { getCategoriesForRole } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { getSharedEventBus } from './sharedEventBus.js';
import {
  hasResourceRole,
  getPlacementRequirements,
  getAllCategoriesForRole,
} from '../contexts/supply/domain/policies/ResourceRolePolicy.js';

/**
 * Composition root — Supply bounded context. The only place allowed to name
 * a resource (food) — every class below (RunMonthlyResourceCycle,
 * RunHubSurplusCycle, ...) is resource-agnostic and only takes the resulting
 * category list as config. Once-per-period locking and hub-link storage
 * field names are no longer wired here at all — each command self-resolves
 * them from the building's own catalog facts (`periodLock`/`hubLink` — see
 * docs/period-lock-catalog-refactor.md in the supply context).
 *
 * @param {object} [deps]
 * @param {import('../contexts/supply/application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} [deps.supplyBuildingRepository]
 * @param {import('../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js').DexieSupplyTraceabilityRepository} [deps.foodTraceabilityRepository]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  foodTraceabilityRepository,
  getTimeInfo: getTimeInfoDep,
} = {}) {
  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();
  const producerCategories = getAllCategoriesForRole('producer');
  // Every category any distributor covers — food (has a producer/hub leg)
  // and any hub-less service like Chapel's 'faith' (none) alike. Kept
  // separate from producerCategories: the hub-link plumbing below
  // (assign/detach/rebalance) is specifically about the production→hub
  // chain, which a hub-less service never enters.
  const distributionCategories = getAllCategoriesForRole('distributor');
  const supplyBuildingRepositoryImpl =
    supplyBuildingRepository ?? new DexieSupplyBuildingRepository();
  const foodTraceabilityRepositoryImpl =
    foodTraceabilityRepository ?? new DexieSupplyTraceabilityRepository();
  const transferHubToHub = new TransferHubToHub(
    supplyBuildingRepositoryImpl
  );
  const rebalanceHubAllocations = new RebalanceHubAllocations(
    supplyBuildingRepositoryImpl
  );
  const assignDistributorToHub = new AssignDistributorToHub(
    supplyBuildingRepositoryImpl,
    rebalanceHubAllocations,
    producerCategories
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
  const updateConsumerDistributorReach = new UpdateConsumerDistributorReach(
    supplyBuildingRepositoryImpl
  );
  const updateDistributorHubLink = new UpdateDistributorHubLink(
    supplyBuildingRepositoryImpl
  );
  const markHubCollectingSchedule = new MarkHubCollectingSchedule(
    supplyBuildingRepositoryImpl
  );
  const resetSourcesCollectedFlag = new ResetSourcesCollectedFlag(
    supplyBuildingRepositoryImpl
  );
  const setHubCollectingFlag = new SetHubCollectingFlag(
    supplyBuildingRepositoryImpl
  );
  const markSourceCollectedByHub = new MarkSourceCollectedByHub(
    supplyBuildingRepositoryImpl
  );
  const produceResource = new ProduceResource(supplyBuildingRepositoryImpl);
  const runProducerCommand = new RunResourceCommandForRole(supplyBuildingRepositoryImpl, produceResource);
  const consumeResource = new ConsumeResource(supplyBuildingRepositoryImpl);
  const runConsumerCommand = new RunResourceCommandForRole(supplyBuildingRepositoryImpl, consumeResource);
  const produceConsumerSubsistence = new ProduceConsumerSubsistence(
    supplyBuildingRepositoryImpl
  );
  const runSubsistenceCommand = new RunResourceCommandForRole(
    supplyBuildingRepositoryImpl,
    produceConsumerSubsistence
  );
  const processHubCollection = new ProcessHubCollection(
    supplyBuildingRepositoryImpl,
    collectResourceToHub,
    setHubCollectingFlag,
    markSourceCollectedByHub
  );
  const runHubSurplusCycle = new RunHubSurplusCycle(
    supplyBuildingRepositoryImpl,
    markHubCollectingSchedule,
    resetSourcesCollectedFlag,
    processHubCollection,
    {
      execute: ({ hubId }) =>
        rebalanceHubAllocations.execute({ hubId, categories: producerCategories }),
    }
  );
  const traceability = new SupplyTraceability({
    foodTraceabilityRepository: foodTraceabilityRepositoryImpl,
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
  });
  const runCityResourceCycle = new RunCityResourceCycle(
    supplyBuildingRepositoryImpl,
    distributeResourceToConsumers,
    getSharedEventBus(),
    {
      transferHubToHub,
      onHubLinkResolved: (distributorId, hasHubLink) =>
        updateDistributorHubLink.execute({ distributorId, hasHubLink }),
      onHubTransfer: (distributorId, transfers, timeInfo) =>
        traceability.recordHubToDistributorTransfers(
          timeInfo,
          distributorId,
          transfers.map((t) => ({ hubId: t.sourceId, category: t.category, amount: t.amount }))
        ),
      onDistribute: (distributorId, transfers, timeInfo) =>
        traceability.recordDistributorToConsumerTransfers(
          timeInfo,
          distributorId,
          transfers.map((t) => ({ houseId: t.consumerId, category: t.category, amount: t.amount }))
        ),
    }
  );
  const runMonthlyResourceCycle = new RunMonthlyResourceCycle(
    runProducerCommand,
    runCityResourceCycle,
    updateConsumerDistributorReach,
    runHubSurplusCycle,
    runConsumerCommand,
    traceability,
    runSubsistenceCommand,
    { categories: distributionCategories, reachCategories: producerCategories }
  );
  const getBuildingSupplyViewQuery = new GetBuildingSupplyView(
    supplyBuildingRepositoryImpl
  );
  const listSupplyMapBuildingsQuery = new ListSupplyMapBuildings(
    supplyBuildingRepositoryImpl
  );
  const listHubSupplyViewsQuery = new ListHubSupplyViews(
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
    updateConsumerDistributorReach,
    updateDistributorHubLink,
    markHubCollectingSchedule,
    resetSourcesCollectedFlag,
    setHubCollectingFlag,
    markSourceCollectedByHub,
    produceResource,
    consumeResource,
    produceConsumerSubsistence,
    processHubCollection,
    runHubSurplusCycle,
    runCityResourceCycle,
    getBuildingSupplyViewQuery,
    listSupplyMapBuildingsQuery,
    listHubSupplyViewsQuery,
    listSupplyStockSnapshotsQuery,
    hasResourceRole,
    getPlacementRequirements,

    async assignDistributorToHub({ distributorId, distributorType, x, y, ownerHubId }) {
      return assignDistributorToHub.execute({ distributorId, distributorType, x, y, ownerHubId });
    },

    async detachDistributorFromHub({ distributorId }) {
      return detachDistributorFromHub.execute({ distributorId, categories: producerCategories });
    },

    async cascadeDestroyHubDistributors({ hubId, city, bulldozeBuildingAtTile }) {
      return cascadeDestroyHubDistributors.execute({ hubId, city, bulldozeBuildingAtTile });
    },

    async initializeHubLinks({ hubId }) {
      await supplyBuildingRepositoryImpl.saveHubLinkedDistributors(hubId, []);
      return { initialized: true, hubId };
    },

    async runMonthlyResourceCycle({ season, month, timeInfo, maxDistance = 5 }) {
      return runMonthlyResourceCycle.execute({
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
      const productIds = getCategoriesForRole(row?.type, 'hub');
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
      const productIds = getCategoriesForRole(row?.type, 'hub');
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

    async listHubSupplyViews() {
      return listHubSupplyViewsQuery.execute();
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

    async getAllSupplyTraceabilityTransactions(maxAge = null) {
      return foodTraceabilityRepositoryImpl.getAllTransactions(maxAge);
    },

    async getSupplyTraceabilityTransactionsForMonth(turn, month = null) {
      return foodTraceabilityRepositoryImpl.getTransactionsForMonth(turn, month);
    },

    async getSupplyTraceabilityTransactionsByMonth(turn) {
      return foodTraceabilityRepositoryImpl.getTransactionsByMonth(turn);
    },

    async cleanupOldSupplyTraceabilityTransactions(maxAge = 60) {
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
