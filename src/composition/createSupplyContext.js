import { DexieSupplyBuildingRepository } from '../infrastructure/persistence/dexie/DexieSupplyBuildingRepository.js';
import { MarketBuysFromNearbyFarms } from '../contexts/supply/application/commands/MarketBuysFromNearbyFarms.js';
import { MarkMarketBuyingSeason } from '../contexts/supply/application/commands/MarkMarketBuyingSeason.js';
import { DistributeFoodFromMarketToHouses } from '../contexts/supply/application/commands/DistributeFoodFromMarketToHouses.js';
import { WindmillCollectsFromAllFarms } from '../contexts/supply/application/commands/WindmillCollectsFromAllFarms.js';
import { UpdateHousesMarketReach } from '../contexts/supply/application/commands/UpdateHousesMarketReach.js';
import { UpdateMarketFarmProximity } from '../contexts/supply/application/commands/UpdateMarketFarmProximity.js';
import { MarkWindmillCollectingSeason } from '../contexts/supply/application/commands/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../contexts/supply/application/commands/ResetFarmsSoldToWindmill.js';
import { SetWindmillCollectingFlag } from '../contexts/supply/application/commands/SetWindmillCollectingFlag.js';
import { MarkFarmSoldToWindmill } from '../contexts/supply/application/commands/MarkFarmSoldToWindmill.js';
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
