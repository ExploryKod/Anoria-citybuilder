import { DexieSupplyBuildingRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyBuildingRepository.js';
import { GetClientPriorityBoardForBuilding } from '../contexts/supply/application/queries/GetClientPriorityBoardForBuilding.js';
import { EmptyHubGoods } from '../contexts/supply/application/commands/surplus/EmptyHubGoods.js';
import { MarkFailedSales } from '../contexts/supply/application/commands/surplus/MarkFailedSales.js';
import { HubServing } from '../contexts/supply/application/services/HubServing.js';
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
import { TRADE_CATALOG } from '../shared/trade-catalog/TradeCatalog.js';
import { lotOrigin } from '../contexts/supply/domain/policies/HubLotsPolicy.js';
import { getWorldCityById } from '../contexts/geography/domain/catalogs/WorldCityCatalog.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { syncRemovedBuilding } from './parcelsOps.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';
import { getNaturalResourceKind, getNaturalSources, getSuppliedCategories } from '../shared/building-catalog/resourceRoleQueries.js';
import { findNaturalSourcesInRange, isWithinRange } from '../contexts/supply/domain/policies/ResourceRangePolicy.js';
import { SupplyTraceability } from '../contexts/supply/infrastructure/presentation/SupplyTraceability.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';
import { DescribeActivitySupplyAccess } from '../contexts/supply/application/queries/DescribeActivitySupplyAccess.js';
import { DescribeFoodForecast } from '../contexts/supply/application/queries/DescribeFoodForecast.js';
import { DescribeSupplyBalance } from '../contexts/supply/application/queries/DescribeSupplyBalance.js';
import { purchasesOfDeliveries } from '../contexts/supply/domain/policies/DeliveryPurchasePolicy.js';
import { getSessionGameTime } from './sessionRuntime.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { DescribeShelfLife } from '../contexts/supply/application/queries/DescribeShelfLife.js';
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
import { DescribeResidentBasket } from '../contexts/supply/application/queries/DescribeResidentBasket.js';
import { PriceBook } from '../contexts/supply/application/services/PriceBook.js';
import { purchasingPower } from '../contexts/supply/domain/policies/SupplierCreditPolicy.js';
import { SUPPLIER_CREDIT_MONTHS_BY_STAGE, stageOfBuildingType } from '../shared/resource-catalog/ValueChainCatalog.js';
import { getResourceBaseValue, getServiceCategories } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import { getSharedEventBus } from './sharedEventBus.js';
import {
  hasResourceRole,
  getPlacementRequirements,
  getAllCategoriesForRole,
  getMaxStockForBuilding,
  listRoleEntries,
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
 * @param {import('../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js').DexieSupplyTraceabilityRepository} [deps.supplyTraceabilityRepository]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 */
export function createSupplyContext({
  supplyBuildingRepository,
  supplyTraceabilityRepository,
  getTimeInfo: getTimeInfoDep,
  consumerMoney,
} = {}) {
  if (!consumerMoney) throw new Error('[supply] createSupplyContext needs consumerMoney: the consumers\' accounts (fundsOf, recordPurchases)');
  const getTimeInfo = getTimeInfoDep ?? resolveGetTimeInfo();
  // Goods that travel the production → hub → market chain (what the citizens eat that a hub
  // stores) — NOT every producible good (household gathering never enters a hub) and not every
  // hub's goods (a goods warehouse has its own, and no market draws on it).
  const producerCategories = getSuppliedCategories();
  // Every category any distributor covers — food (has a producer/hub leg)
  // and any hub-less service like the water tank's 'water' (none) alike. Kept
  // separate from producerCategories: the hub-link plumbing below
  // (assign/detach/rebalance) is specifically about the production→hub
  // chain, which a hub-less service never enters.
  const distributionCategories = getAllCategoriesForRole('distributor');
  const supplyBuildingRepositoryImpl =
    supplyBuildingRepository ?? new DexieSupplyBuildingRepository();
  const supplyTraceabilityRepositoryImpl =
    supplyTraceabilityRepository ?? new DexieSupplyTraceabilityRepository();
  // A merchant's deal goods (dealWood/dealDecoratedPot/dealBook) are bought by an external trade
  // city (TradeCatalog.js, geography BC), never by a building — a city is a client exactly like a
  // market or workshop is: same priority board, same HubServing allocation engine, just sourced
  // from a different bounded context. This composition root is the one place supply is allowed to
  // reach into geography's catalog to say so (see RunMonthlyCityTradeCycle.js for the reverse: it
  // already reaches into supply's ResourceCategoryCatalog for baseValue the same way).
  function listExternalClientsForCategory(category) {
    return TRADE_CATALOG.filter((entry) => entry.wants.some((want) => want.merchantGood === category)).map(
      (entry) => ({
        id: `city:${entry.cityId}`,
        type: 'TradeCity',
        label: getWorldCityById(entry.cityId)?.name ?? entry.cityId,
      })
    );
  }
  const hubServing = new HubServing(supplyBuildingRepositoryImpl, {
    listExternalClients: listExternalClientsForCategory,
  });
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
  // Every seller's price is built on what its stock cost (see PriceBook): the traceability logs the transfers at it, the houses pay it.
  const priceBook = new PriceBook({
    sumInflowCosts: (range) => supplyTraceabilityRepositoryImpl.sumInflowCosts(range),
    loadProducerCosting: () => consumerMoney.producerCosting(),
  });
  // What a company can still buy from its suppliers: its cash plus the credit its stage gets (sales of the past months), less this month's unpaid purchases.
  // What a building sold in a month that is over does not change any more (the month's rows are only compacted, their sums are kept): it is read once, not on every purchase of every tick.
  const soldInClosedMonth = new Map();
  const closedMonthSales = async (buyerId, key) => {
    const cacheKey = `${buyerId}|${key}`;
    if (!soldInClosedMonth.has(cacheKey)) {
      soldInClosedMonth.set(cacheKey, (await supplyTraceabilityRepositoryImpl.sumTradeOf(buyerId, Math.floor(key / MONTHS_PER_YEAR), key % MONTHS_PER_YEAR)).sold);
    }
    return soldInClosedMonth.get(cacheKey);
  };
  const purchasingPowerOf = async ({ buyerId, period }) => {
    const buyer = await supplyBuildingRepositoryImpl.findRowById(buyerId);
    if (!buyer) throw new Error(`[supply] the purchasing power of ${buyerId} was asked, but no such building stands`);
    if (listRoleEntries(buyer.type, 'hub').some((entry) => entry.unlimitedSupplierCredit === true)) return Infinity;
    const creditMonths = SUPPLIER_CREDIT_MONTHS_BY_STAGE[stageOfBuildingType(buyer.type)];
    if (!(creditMonths > 0)) throw new Error(`[supply] ${buyer.type} buys at a stage with no supplier credit declared (SUPPLIER_CREDIT_MONTHS_BY_STAGE)`);
    const monthKey = period.year * MONTHS_PER_YEAR + period.monthIndex;
    // Only this month is read each time (its purchases grow as the day goes on); the months before it come from the cache.
    const [now, cash, ...past] = await Promise.all([
      supplyTraceabilityRepositoryImpl.sumTradeOf(buyerId, period.year, period.monthIndex),
      consumerMoney.companyFundsOf(buyerId),
      ...Array.from({ length: creditMonths }, (_, back) => closedMonthSales(buyerId, monthKey - 1 - back)),
    ]);
    return purchasingPower({ cash, creditLine: past.reduce((sum, sold) => sum + sold, 0), committed: now.bought });
  };
  const transferHubToHub = new TransferHubToHub(supplyBuildingRepositoryImpl, hubServing, priceBook, purchasingPowerOf);
  const distributeResourceToConsumers = new DistributeResourceToConsumers(
    supplyBuildingRepositoryImpl,
    consumerMoney,
    priceBook
  );
  const collectResourceToHub = new CollectResourceToHub(supplyBuildingRepositoryImpl, hubServing, { priceBook, purchasingPower: purchasingPowerOf });
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
  // Which deals the merchants may make is the trade context's to say, and it is built after this one: it registers
  // its answer through `setOpenDealCheck`. Asked before that, the gate throws (see ProduceResource).
  let openDealCheck = null;
  const dealGate = {
    isOpen: (category) => {
      if (!openDealCheck) throw new Error('[supply] the open-deal check was never set: the trade context must register it');
      return openDealCheck(category);
    },
  };
  const produceResource = new ProduceResource(supplyBuildingRepositoryImpl, {
    hubServing,
    dealGate,
    recordInputPurchase: (purchase) => traceability.recordInputPurchase(purchase),
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
    new MarkFailedSales(supplyBuildingRepositoryImpl),
    new EmptyHubGoods(supplyBuildingRepositoryImpl, hubServing)
  );
  const traceability = new SupplyTraceability({
    supplyTraceabilityRepository: supplyTraceabilityRepositoryImpl,
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
    priceBook,
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
          transfers.map((t) => ({ hubId: t.sourceId, category: t.category, amount: t.amount, unitPrice: t.unitPrice }))
        ),
      onDistribute: async (distributorId, transfers, timeInfo) => {
        await traceability.recordDistributorToConsumerTransfers(
          timeInfo,
          distributorId,
          transfers.map((t) => ({ houseId: t.consumerId, category: t.category, amount: t.amount, unitPrice: t.unitPrice }))
        );
        // Each unit of a GOOD is paid when it is delivered: one purchase per house and good, at the chain's
        // final price (TTC, extracted here). A service is not a good: it is a prestation, priced HT with the
        // VAT added on top, and settled once a month in arrears (subsidy, insolvency) by SettleProducerCharges
        // from sumServiceFlows — never here, or it would be billed twice (this instant TTC-shaped line, then
        // the arrears service_purchase line for the same delivery).
        const serviceCategories = getServiceCategories();
        const goodsTransfers = transfers.filter((t) => !serviceCategories.includes(t.category));
        if (goodsTransfers.length === 0) return;
        const distributor = await supplyBuildingRepositoryImpl.findById(distributorId);
        if (!distributor) throw new Error(`[supply] distributor ${distributorId} of a delivery is not in the city`);
        // A unit is paid at its own price (a stale one costs less), and the accounting keeps one line per house and good: see DeliveryPurchasePolicy.js.
        const purchases = purchasesOfDeliveries(goodsTransfers);
        await consumerMoney.recordPurchases({
          turn: timeInfo?.turn ?? timeInfo?.days ?? 0,
          timeInfo,
          distributorId,
          distributorType: distributor.type,
          purchases,
        });
      },
    }
  );
  const runMonthlyResourceCycle = new RunMonthlyResourceCycle(
    runProducerCommand,
    runCityResourceCycle,
    updateConsumerDistributorReach,
    runHubSurplusCycle,
    runConsumerCommand,
    traceability,
    { supplyBuildingRepository: supplyBuildingRepositoryImpl, recordSpoilage: (loss) => traceability.recordSpoilage(loss) },
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
  const getClientPriorityBoardForBuildingQuery = new GetClientPriorityBoardForBuilding(supplyBuildingRepositoryImpl, {
    listExternalClients: listExternalClientsForCategory,
  });
  const describeActivitySupplyAccessQuery = new DescribeActivitySupplyAccess(supplyBuildingRepositoryImpl);
  const describeFoodForecastQuery = new DescribeFoodForecast(supplyBuildingRepositoryImpl);
  const describeSupplyBalanceQuery = new DescribeSupplyBalance(supplyBuildingRepositoryImpl, {
    readChainFlows: (range) => supplyTraceabilityRepositoryImpl.sumChainFlows(range),
    currentMonthKey: () => {
      const now = getTimeInfo(getSessionGameTime());
      return now.year * MONTHS_PER_YEAR + now.monthIndex;
    },
  });
  const describeShelfLifeQuery = new DescribeShelfLife(supplyBuildingRepositoryImpl, {
    sumShelfFlowsOf: (buildingId, range) => supplyTraceabilityRepositoryImpl.sumShelfFlowsOf(buildingId, range),
  });

  // What each seller of the hamlet charges per unit this month: its goods, or its services.
  const listPrices = async (period, { services: wantServices }) => {
    await priceBook.ensure(period);
    const serviceCategories = getServiceCategories();
    const prices = [];
    for (const role of ['producer', 'hub', 'distributor']) {
      for (const building of await supplyBuildingRepositoryImpl.findByResourceRole(role)) {
        for (const category of getCategoriesForRole(building.type, role)) {
          if (serviceCategories.includes(category) !== wantServices) continue;
          // A good with no reference value (a trade deal, bandwidth…) has no price to list: nothing to mark up, nothing to read.
          if (!wantServices && !(getResourceBaseValue(category) > 0)) continue;
          prices.push({ stage: role, buildingId: building.id, category, price: priceBook.sellingPrice(building, category, period) });
        }
      }
    }
    return prices;
  };

  // The price a good sells at in the markets now: the average of the markets that sell it, null for a good none sells.
  const describeResidentBasketQuery = new DescribeResidentBasket(supplyBuildingRepositoryImpl, {
    marketPrices: async () => {
      const now = getTimeInfo(getSessionGameTime());
      const sold = (await listPrices({ year: now.year, monthIndex: now.monthIndex }, { services: false })).filter((price) => price.stage === 'distributor');
      return (category) => {
        const prices = sold.filter((price) => price.category === category).map((price) => price.price);
        return prices.length === 0 ? null : prices.reduce((sum, price) => sum + price, 0) / prices.length;
      };
    },
  });

  return {
    /** @param {(dealCategory: string) => Promise<boolean>} check whether the merchants may make this deal now */
    setOpenDealCheck(check) {
      openDealCheck = check;
    },
    supplyBuildingRepository: supplyBuildingRepositoryImpl,
    hubServing,
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

    /** The Clients tab on one producer building: one board per good it produces, each its own candidate list and order. */
    async getClientPriorityBoardForBuilding(buildingId) {
      return getClientPriorityBoardForBuildingQuery.execute(buildingId);
    },

    /** This instance's own order (and refusals) among ONE good's candidate clients; effective from the next tick. */
    async saveClientPriorityForBuilding(buildingId, category, { order, disabled }) {
      const producer = await supplyBuildingRepositoryImpl.findById(buildingId);
      await supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, {
        clientPriorityByGood: { ...(producer?.clientPriorityByGood ?? {}), [category]: { order, disabled } },
      });
    },

    /** Back to the default order for this instance, for that one good. */
    async resetClientPriorityForBuilding(buildingId, category) {
      const producer = await supplyBuildingRepositoryImpl.findById(buildingId);
      const clientPriorityByGood = { ...(producer?.clientPriorityByGood ?? {}) };
      delete clientPriorityByGood[category];
      await supplyBuildingRepositoryImpl.updateBuildingFields(buildingId, { clientPriorityByGood });
    },

    async runMonthlyResourceCycle({ season, month, timeInfo }) {
      // One building-table snapshot for this whole tick (see HubServing.invalidateCache) instead
      // of a fresh full scan on every single producer's every single draw from a hub.
      hubServing.invalidateCache();
      const run = () => runMonthlyResourceCycle.execute({
        season,
        month,
        timeInfo,
      });
      // A repository with a unit of work reads each building once and writes what changed in one go at the end of the cycle (the cycle reads and rewrites the same
      // few dozen rows hundreds of times a day, each a transaction); one without runs the cycle as it always did.
      // The traceability rows the cycle adds go the same way: one write at the end instead of one per row.
      const traceabilityRun =
        typeof supplyTraceabilityRepositoryImpl.inUnitOfWork === 'function' ? () => supplyTraceabilityRepositoryImpl.inUnitOfWork(run) : run;
      return typeof supplyBuildingRepositoryImpl.inUnitOfWork === 'function' ? supplyBuildingRepositoryImpl.inUnitOfWork(traceabilityRun) : traceabilityRun();
    },

    // The pie chart's origin breakdown ("who delivered this part of the stock") names a producer
    // INSTANCE (see HubLotsPolicy.js's lot keys) that buildingName() can't read — it needs that
    // instance's catalog TYPE. This view has no repository of its own, so the one full-table read it
    // needs happens once, here, before the otherwise-pure GetHubStorageInfoView.execute() runs.
    async getHubStorageInfoView(hubKind, buildingRow, options = {}) {
      const rows = await supplyBuildingRepositoryImpl.listAllBuildingRows();
      const typeById = new Map(rows.map((row) => [row.id, row.type]));
      return getHubStorageInfoView.execute({
        hubKind,
        buildingRow,
        ...options,
        resolveProducerType: (producerId) => typeById.get(producerId) ?? null,
        // A lot filed under a trade city (`city:<id>`, see RunMonthlyCityTradeCycle's imports) is told by its name.
        resolveProducerName: (producerId) => (producerId.startsWith('city:') ? getWorldCityById(producerId.slice('city:'.length))?.name ?? null : null),
      });
    },

    /** Structural gaps in a building's own recipe(s) — see DescribeActivitySupplyAccess.js. */
    async describeActivitySupplyAccess(building) {
      return describeActivitySupplyAccessQuery.execute(building);
    },

    /** Whether the producers make what the citizens use up, need by need, and how many are missing — see DescribeSupplyBalance.js. */
    async describeSupplyBalance() {
      return describeSupplyBalanceQuery.execute();
    },

    /** What the basic needs of each house cost it in a month at the markets' prices — see DescribeResidentBasket.js. */
    async describeResidentBasket() {
      return describeResidentBasketQuery.execute();
    },

    /** What the farms can expect in a year against the citizens' meals and the granaries' room — see DescribeFoodForecast.js. */
    async describeFoodForecast() {
      return describeFoodForecastQuery.execute();
    },

    /** How long the stock of one building has left to live, good by good — see DescribeShelfLife.js. */
    async describeShelfLife(params) {
      return describeShelfLifeQuery.execute(params);
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

    /**
     * The buildings that draw on a natural resource: the raw-material producers whose `source` is this resource's kind and
     * reaches it (the same range rule ProduceResource uses). Derived from the map every time, never stored.
     * @param {string} natureBuildingId
     * @returns {Promise<Array<{ id: string, type: string, x: number, y: number }>>}
     */
    async listNaturalCollectors(natureBuildingId) {
      const node = await supplyBuildingRepositoryImpl.findRowById(natureBuildingId);
      if (!node) throw new Error(`[supply] listNaturalCollectors: no building "${natureBuildingId}"`);
      const kind = getNaturalResourceKind(node.type);
      if (!kind) throw new Error(`[supply] listNaturalCollectors: "${node.type}" is not a natural resource`);
      const rows = await supplyBuildingRepositoryImpl.listAllBuildingRows();
      return rows
        .filter((row) =>
          row.x != null && row.y != null
          && getNaturalSources(row.type).some((source) => source.resource === kind && isWithinRange(row, node, source.range))
        )
        .map((row) => ({ id: instanceIdFromHouseRow(row), type: row.type, x: row.x, y: row.y }));
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

    async getAllSupplyTraceabilityTransactions(hamletId = null) {
      return supplyTraceabilityRepositoryImpl.getAllTransactions(hamletId);
    },

    async getSupplyTraceabilityTransactionsForMonth(turn, month = null) {
      return supplyTraceabilityRepositoryImpl.getTransactionsForMonth(turn, month);
    },

    async getSupplyTraceabilityTransactionsByMonth(turn) {
      return supplyTraceabilityRepositoryImpl.getTransactionsByMonth(turn);
    },

    /** A building was placed / demolished — kept in the city's history. */
    async recordBuildingEvent({ timeInfo, event, building }) {
      return traceability.recordBuildingEvent(timeInfo, event, building);
    },

    /** Houses that went up or down a level this month. */
    async recordHouseChanges(timeInfo, changes) {
      return traceability.recordHouseChanges(timeInfo, changes);
    },

    /** Inhabitants lost to famine this month. */
    async recordFamineDeaths(timeInfo, deaths) {
      return traceability.recordFamineDeaths(timeInfo, deaths);
    },

    /** The merchants' sale of an imported good to a warehouse — see SupplyTraceability.recordImportDelivery. */
    async recordImportDelivery(params) {
      return traceability.recordImportDelivery(params);
    },

    /**
     * The unit price (HT) a building sells a good or a service at in a month: a producer at its cost plus its margin, a warehouse and a market at
     * the average cost of their deliveries plus theirs (see PriceBook).
     * @param {{ id: string, type: string }} building
     * @param {string} category
     * @param {{ year?: number, monthIndex?: number }} period
     * @returns {Promise<number>}
     */
    async sellingPriceOf(building, category, period) {
      await priceBook.ensure(period);
      return priceBook.sellingPrice(building, category, period);
    },

    /**
     * What a building's stock is worth at cost, good by good (a service is not a stock): the units it holds times what a unit cost it (see PriceBook.stockUnitCost).
     * @param {string} buildingId
     * @param {{ year?: number, monthIndex?: number }} period
     * @returns {Promise<Array<{ category: string, amount: number, unitCost: number, value: number }>>}
     */
    async valueStockOf(buildingId, period) {
      const building = await supplyBuildingRepositoryImpl.findById(buildingId);
      if (!building) throw new Error(`[supply] building ${buildingId} is not in the hamlet: its stock cannot be valued`);
      await priceBook.ensure(period);
      const services = new Set(getServiceCategories());
      const seen = new Set();
      const items = [];
      for (const role of ['producer', 'hub', 'distributor']) {
        for (const entry of listRoleEntries(building.type, role)) {
          for (const category of entry.categories) {
            if (seen.has(category) || services.has(category)) continue;
            seen.add(category);
            const amount = building.stocks?.[category] ?? 0;
            if (!(amount > 0)) continue;
            const unitCost = priceBook.stockUnitCost({ id: building.id, type: building.type }, category, period);
            items.push({ category, amount, unitCost, value: Math.round(amount * unitCost * 100) / 100 });
          }
        }
      }
      return items;
    },

    /**
     * What every producer, warehouse and market of the hamlet sells each of its goods at this month (HT), for the price panel.
     * @param {{ year?: number, monthIndex?: number }} period
     * @returns {Promise<Array<{ stage: 'producer' | 'hub' | 'distributor', buildingId: string, category: string, price: number }>>}
     */
    async listSellingPrices(period) {
      return listPrices(period, { services: false });
    },

    /**
     * What every seller of a service (a tank, a plant, a doctor's, a fire station...) charges per unit this month (HT, before the city's subsidy
     * and the VAT): the services `listSellingPrices` leaves out.
     * @param {{ year?: number, monthIndex?: number }} period
     * @returns {Promise<Array<{ stage: 'producer' | 'hub' | 'distributor', buildingId: string, category: string, price: number }>>}
     */
    async listServicePrices(period) {
      return listPrices(period, { services: true });
    },

    /** The building that made the goods of a hub's lot (a lot key), or null when it has none. */
    producerOfLot: (lotKey) => lotOrigin(lotKey).producerId ?? null,

    /** A merchant city-trade sale — records a merchant_sale traceability entry. */
    async recordMerchantSale(params) {
      return traceability.recordMerchantSale(params);
    },

    /** All merchant_sale traceability rows for a city partner, newest first. */
    async getMerchantSalesForCity(cityId) {
      return traceability.getMerchantSalesForCity(cityId);
    },
  };
}

/** @type {ReturnType<typeof createSupplyContext> | null} */
let sharedSupply = null;

/** @param {{ consumerMoney: object }} deps the consumers' accounts, from the accounting context (see consumerMoneyPort.js) */
export function getOrCreateSupplyContext(deps) {
  if (!sharedSupply) {
    sharedSupply = createSupplyContext(deps);
  }
  return sharedSupply;
}

/** @internal Tests only */
export function resetSupplyContextForTests() {
  sharedSupply = null;
}
