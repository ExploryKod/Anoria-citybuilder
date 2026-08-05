import { canMarketBuyFromWindmill } from '../../../domain/policies/BuyingSeasonPolicy.js';
import { remainingMarketCapacity } from '../../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { CROPS } from '../../../domain/value-objects/CropType.js';
import {
  addCrop,
  createFoodStock,
  getCropAmount,
  takeCrop,
} from '../../../domain/value-objects/FoodStock.js';

/**
 * Command: market restocks from its assigned windmill allocation bucket (monthly).
 */
export class MarketBuysFromAssignedWindmill {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @param {string | null} [params.month]
   * @returns {Promise<{
   *   bought: boolean,
   *   reason?: string,
   *   transfers: Array<{ windmillId: string, crop: string, amount: number }>,
   *   totalBaskets: number,
   * }>}
   */
  async execute({ marketId, month = null }) {
    if (!canMarketBuyFromWindmill(month)) {
      return { bought: false, reason: 'not_buying_month', transfers: [], totalBaskets: 0 };
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

    const windmillId = market.supplyWindmillId;
    if (!windmillId) {
      return { bought: false, reason: 'no_windmill_link', transfers: [], totalBaskets: 0 };
    }

    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (!windmill) {
      return { bought: false, reason: 'windmill_not_found', transfers: [], totalBaskets: 0 };
    }

    if (
      !isOperational({
        roadCount: windmill.roadCount,
        worker: windmill.worker,
        workerNeed: windmill.workerNeed,
      })
    ) {
      return { bought: false, reason: 'windmill_not_operational', transfers: [], totalBaskets: 0 };
    }

    const linkedMarkets = [...(windmill.linkedMarkets ?? [])];
    const linkIndex = linkedMarkets.findIndex((entry) => entry.marketId === marketId);
    if (linkIndex < 0) {
      return { bought: false, reason: 'market_not_linked', transfers: [], totalBaskets: 0 };
    }

    let marketCapacity = remainingMarketCapacity(market.stocks.food, market.maxStock);
    if (marketCapacity <= 0) {
      return { bought: false, reason: 'market_full', transfers: [], totalBaskets: 0 };
    }

    const allocation = linkedMarkets[linkIndex];
    const transfers = [];
    let windmillStock = createFoodStock(windmill.stocks);
    let marketStock = createFoodStock(market.stocks);
    const nextAllocated = {
      wheat: allocation.allocatedStocks?.wheat ?? 0,
      carrot: allocation.allocatedStocks?.carrot ?? 0,
      cabbage: allocation.allocatedStocks?.cabbage ?? 0,
    };

    for (const crop of CROPS) {
      if (marketCapacity <= 0) break;

      const allocated = Math.max(0, Math.floor(nextAllocated[crop] ?? 0));
      const availableOnWindmill = getCropAmount(windmillStock, crop);
      const amount = Math.min(allocated, availableOnWindmill, marketCapacity);
      if (amount <= 0) continue;

      windmillStock = takeCrop(windmillStock, crop, amount);
      marketStock = addCrop(marketStock, crop, amount);
      nextAllocated[crop] = allocated - amount;
      marketCapacity -= amount;
      transfers.push({ windmillId, crop, amount });
    }

    if (transfers.length === 0) {
      return { bought: false, reason: 'nothing_to_buy', transfers: [], totalBaskets: 0 };
    }

    linkedMarkets[linkIndex] = {
      ...allocation,
      allocatedStocks: nextAllocated,
    };

    await this.supplyBuildingRepository.saveStocks(windmillId, windmillStock);
    await this.supplyBuildingRepository.saveLinkedMarkets(windmillId, linkedMarkets);
    await this.supplyBuildingRepository.saveStocks(marketId, marketStock);

    const totalBaskets = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { bought: true, transfers, totalBaskets };
  }
}
