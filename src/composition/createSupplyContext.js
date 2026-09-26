import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { ListClientPriorityBoards } from '../contexts/supply/application/queries/ListClientPriorityBoards.js';
import { MarkFailedSales } from '../contexts/supply/application/commands/surplus/MarkFailedSales.js';
import { HubServing } from '../contexts/supply/application/services/HubServing.js';
import { LocalStorageClientPriorityRepository } from '../contexts/supply/infrastructure/browser/LocalStorageClientPriorityRepository.js';
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
import { RunResourceCommandForRole } from '../contexts/supply/application/commands/RunResourceCommandForRole.js';
import { ProcessHubCollection } from '../contexts/supply/application/commands/surplus/ProcessHubCollection.js';
import { RunHubSurplusCycle } from '../contexts/supply/application/commands/surplus/RunHubSurplusCycle.js';
import { RunCityResourceCycle } from '../contexts/supply/application/commands/procurement/RunCityResourceCycle.js';
import { RunMonthlyResourceCycle } from '../contexts/supply/application/workflows/RunMonthlyResourceCycle.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { syncRemovedBuilding } from './parcelsOps.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import { getNaturalSources, getSuppliedCategories } from '../shared/building-catalog/resourceRoleQueries.js';
import { findNaturalSourcesInRange } from '../contexts/supply/domain/policies/ResourceRangePolicy.js';
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
  getMaxStockForBuilding,
} from '../contexts/supply/domain/policies/ResourceRolePolicy.js';

/**
 * Composition root — Supply bounded context. No good is named anywhere: the
 * category lists below are derived from the catalog's `resourceRoles`, and
 * every class (RunMonthlyResourceCycle, RunHubSurplusCycle, ...) is
 * resource-agnostic and only takes the resulting category list as config. Once-per-period locking and hub-link storage
 * field names are no longer wired here at all — each command self-resolves
 * them from the building's own catalog facts (`periodLock`/`hubLink` — see
 * docs/period-lock-catalog-refactor.md in the supply context).
 *
 * @param {object} [deps]
 * @param {import('../contexts/supply/application/ports/SupplyBuildingRepository.js').SupplyBuildingRepository} [deps.supplyBuildingRepository]
 * @param {import('../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js').DexieSupplyTraceabilityRepository} [deps.foodTraceabilityRepository]
 * @param {{ load: () => object, save: (priorities: object) => void }} [deps.clientPriorityRepository] The player's client priorities.
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  foodTraceabilityRepository,
  clientPriorityRepository,
  getTimeInfo: getTimeInfoDep,
} = {}) {
  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();
  // Goods that travel the production → hub → market chain (what the citizens eat that a hub
  // stores) — NOT every producible good (household gathering never enters a hub) and not every
  // hub's goods (a goods warehouse has its own, and no market draws on it).
  const producerCategories = getSuppliedCategories();
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
  // The player's client priorities (saved settings); none saved means the catalog's defaults.
  const clientPriorityRepositoryImpl = clientPriorityRepository ?? new LocalStorageClientPriorityRepository();
  const hubServing = new HubServing(supplyBuildingRepositoryImpl, {
    loadSettings: () => clientPriorityRepositoryImpl.load(),
  });
  const transferHubToHub = new TransferHubToHub(
    supplyBuildingRepositoryImpl,
    hubServing
  );
  const rebalanceHubAllocations = new RebalanceHubAllocations(
    supplyBuildingRepositoryImpl
  );
  const assignDistributorToHub = new AssignDistributorToHub(
    supplyBuildingRepositoryImpl,
    rebalanceHubAllocations
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
    supplyBuildingRepositoryImpl,
    hubServing
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
  // A used-up natural resource (a felled tree) leaves the game like any demolished building.
  const produceResource = new ProduceResource(supplyBuildingRepositoryImpl, {
    hubServing,
    removeBuilding: (params) => syncRemovedBuilding(params),
  });
  const runProducerCommand = new RunResourceCommandForRole(supplyBuildingRepositoryImpl, produceResource);
  const consumeResource = new ConsumeResource(supplyBuildingRepositoryImpl);
  const runConsumerCommand = new RunResourceCommandForRole(supplyBuildingRepositoryImpl, consumeResource);
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
      execute: async ({ hubId }) => {
        const hub = await supplyBuildingRepositoryImpl.findById(hubId);
        return rebalanceHubAllocations.execute({ hubId, categories: getCategoriesForRole(hub?.type, 'hub') });
      },
    },
    new MarkFailedSales(supplyBuildingRepositoryImpl)
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
      linkDistributorEntry: (params) => assignDistributorToHub.linkEntryToAnyHub(params),
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
  const listClientPriorityBoardsQuery = new ListClientPriorityBoards(supplyBuildingRepositoryImpl, {
    loadSettings: () => clientPriorityRepositoryImpl.load(),
  });

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
    processHubCollection,
    runHubSurplusCycle,
    runCityResourceCycle,
    getBuildingSupplyViewQuery,
    listSupplyMapBuildingsQuery,
    listHubSupplyViewsQuery,
    listSupplyStockSnapshotsQuery,
    hasResourceRole,
    getPlacementRequirements,

    async assignDistributorToHub({ distributorId, distributorType, x, y }) {
      return assignDistributorToHub.execute({ distributorId, distributorType, x, y });
    },

    /** A hub just placed: the distributors still lacking a hub it may serve are linked to it. */
    async linkWaitingDistributors({ hubId }) {
      return assignDistributorToHub.linkWaitingDistributors({ hubId });
    },

    async detachDistributorFromHub({ distributorId }) {
      return detachDistributorFromHub.execute({ distributorId });
    },

    /** What demolishing this hub would take down, for the player to confirm before it happens. */
    async previewHubCascade({ hubId }) {
      return cascadeDestroyHubDistributors.findDependents({ hubId });
    },

    async cascadeDestroyHubDistributors({ hubId, city, bulldozeBuildingAtTile }) {
      return cascadeDestroyHubDistributors.execute({ hubId, city, bulldozeBuildingAtTile });
    },

    async initializeHubLinks({ hubId }) {
      await supplyBuildingRepositoryImpl.saveHubLinkedDistributors(hubId, []);
      return { initialized: true, hubId };
    },

    /** The Clients tab: each producer type's clients, in the order it serves them. */
    async listClientPriorityBoards() {
      return listClientPriorityBoardsQuery.execute();
    },

    /** The player's order (and refusals) for one producer type; effective from the next tick. */
    saveClientPriorities(producerType, { order, disabled }) {
      clientPriorityRepositoryImpl.save({ ...clientPriorityRepositoryImpl.load(), [producerType]: { order, disabled } });
    },

    /** Back to the catalog's default for one producer type. */
    resetClientPriorities(producerType) {
      const { [producerType]: _dropped, ...rest } = clientPriorityRepositoryImpl.load();
      clientPriorityRepositoryImpl.save(rest);
    },

    async runMonthlyResourceCycle({ season, month, timeInfo }) {
      return runMonthlyResourceCycle.execute({
        season,
        month,
        timeInfo,
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
      const totalCapacity = getMaxStockForBuilding(row?.type);

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

    /**
     * Ids of the raw-material producers with no natural resource left in range — the "no
     * resource" warning. Derived from the map every time it is asked (never stored), by the
     * same `source` rule ProduceResource works with, so it can neither lag nor flicker.
     */
    async listNoResourceBuildingIds() {
      const rows = await supplyBuildingRepositoryImpl.listAllBuildingRows();
      const naturals = await supplyBuildingRepositoryImpl.listNaturalResources();
      return rows
        .filter((row) =>
          getNaturalSources(row.type).some(
            (source) => findNaturalSourcesInRange(row, naturals, source).length < (source.consume ?? 1)
          )
        )
        .map((row) => instanceIdFromHouseRow(row));
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

    /** A building was placed / demolished — kept in the city's history. */
    async recordBuildingEvent({ timeInfo, event, building }) {
      return traceability.recordBuildingEvent(timeInfo, event, building);
    },

    /** The city's employment at the end of a month, kept in its history. */
    async recordEmploymentSummary(timeInfo, summary) {
      return traceability.recordEmploymentSummary(timeInfo, summary);
    },

    /** Houses that went up or down a level this month. */
    async recordHouseChanges(timeInfo, changes) {
      return traceability.recordHouseChanges(timeInfo, changes);
    },

    /** Inhabitants lost to famine this month. */
    async recordFamineDeaths(timeInfo, deaths) {
      return traceability.recordFamineDeaths(timeInfo, deaths);
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
