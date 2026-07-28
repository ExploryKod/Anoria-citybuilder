import { DexieSupplyBuildingRepository } from '../infrastructure/persistence/dexie/DexieSupplyBuildingRepository.js';
import { MarketBuysFromNearbyFarms } from '../contexts/supply/application/commands/MarketBuysFromNearbyFarms.js';
import { MarkMarketBuyingSeason } from '../contexts/supply/application/commands/MarkMarketBuyingSeason.js';
import { DistributeFoodFromMarketToHouses } from '../contexts/supply/application/commands/DistributeFoodFromMarketToHouses.js';
import { WindmillCollectsFromAllFarms } from '../contexts/supply/application/commands/WindmillCollectsFromAllFarms.js';
import { UpdateHousesMarketReach } from '../contexts/supply/application/commands/UpdateHousesMarketReach.js';
import { GetBuildingSupplyView } from '../contexts/supply/application/queries/GetBuildingSupplyView.js';

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
  const getBuildingSupplyViewQuery = new GetBuildingSupplyView(
    supplyBuildingRepository
  );

  return {
    supplyBuildingRepository,
    marketBuysFromNearbyFarms,
    markMarketBuyingSeason,
    distributeFoodFromMarketToHouses,
    windmillCollectsFromAllFarms,
    updateHousesMarketReach,
    getBuildingSupplyViewQuery,

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

    async getBuildingSupplyView(buildingId) {
      return getBuildingSupplyViewQuery.execute(buildingId);
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
