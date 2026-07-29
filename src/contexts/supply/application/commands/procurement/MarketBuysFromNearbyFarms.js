import { canMarketBuyFromFarms } from '../../../domain/policies/BuyingSeasonPolicy.js';
import { remainingMarketCapacity } from '../../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { cropFromFarmType } from '../../../domain/value-objects/CropType.js';
import {
  addCrop,
  createFoodStock,
  getCropAmount,
  takeCrop,
} from '../../../domain/value-objects/FoodStock.js';
import { resolvePublishedBuildingIdFromRef } from '../../../../../shared/building-identity/BuildingId.js';

/**
 * Command: market buys crop baskets from nearby farm refs (autumn only).
 * Side effects (sales UI / traceability) stay in legacy — returns transfers.
 */
export class MarketBuysFromNearbyFarms {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @param {object[]} params.farmRefs - neighbor-like refs { id?, buildingId?, name?, type?, x?, y? }
   * @param {string} params.season - English season (`autumn`, …)
   * @returns {Promise<{
   *   bought: boolean,
   *   reason?: string,
   *   transfers: Array<{ farmId: string, crop: string, amount: number }>,
   *   totalBaskets: number,
   * }>}
   */
  async execute({ marketId, farmRefs = [], season }) {
    if (!canMarketBuyFromFarms(season)) {
      return { bought: false, reason: 'not_buying_season', transfers: [], totalBaskets: 0 };
    }

    const market = await this.supplyBuildingRepository.findById(marketId);
    if (!market) {
      return { bought: false, reason: 'market_not_found', transfers: [], totalBaskets: 0 };
    }

    if (
      !isOperational({
        roadCount: market.roadCount,
        worker: market.worker,
        workerNeed: market.workerNeed,
      })
    ) {
      return { bought: false, reason: 'market_not_operational', transfers: [], totalBaskets: 0 };
    }

    let capacity = remainingMarketCapacity(market.stocks.food, market.maxStock);
    if (capacity <= 0) {
      return { bought: false, reason: 'market_full', transfers: [], totalBaskets: 0 };
    }

    const transfers = [];
    let marketStock = createFoodStock(market.stocks);

    for (const ref of farmRefs) {
      if (capacity <= 0) break;

      const farmId = resolvePublishedBuildingIdFromRef(ref);
      if (!farmId) continue;

      const farm = await this.supplyBuildingRepository.findById(farmId);
      if (!farm) continue;

      // Farms need road access to sell; staffing is a market concern
      if (farm.roadCount <= 0) continue;

      const crop = cropFromFarmType(farm.type);
      if (!crop) continue;

      const available = getCropAmount(farm.stocks, crop);
      const amount = Math.min(available, capacity);
      if (amount <= 0) continue;

      const nextFarmStock = takeCrop(farm.stocks, crop, amount);
      await this.supplyBuildingRepository.saveStocks(farmId, nextFarmStock);

      marketStock = addCrop(marketStock, crop, amount);
      capacity -= amount;

      transfers.push({ farmId, crop, amount });
    }

    if (transfers.length === 0) {
      return { bought: false, reason: 'nothing_to_buy', transfers: [], totalBaskets: 0 };
    }

    // Re-read market to avoid stomping concurrent writes, then add purchased totals
    const freshMarket = await this.supplyBuildingRepository.findById(marketId);
    const base = createFoodStock(freshMarket?.stocks ?? market.stocks);
    let merged = base;
    for (const t of transfers) {
      merged = addCrop(merged, t.crop, t.amount);
    }
    const cappedFood = Math.min(
      freshMarket?.maxStock ?? market.maxStock,
      merged.food
    );
    const finalStock = createFoodStock({
      wheat: merged.wheat,
      carrot: merged.carrot,
      cabbage: merged.cabbage,
      food: cappedFood,
    });
    await this.supplyBuildingRepository.saveStocks(marketId, finalStock);

    const totalBaskets = transfers.reduce((sum, t) => sum + t.amount, 0);
    return { bought: true, transfers, totalBaskets };
  }
}
