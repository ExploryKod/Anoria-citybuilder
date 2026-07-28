import { canWindmillCollectFromFarms } from '../../domain/policies/CollectingMonthPolicy.js';
import { remainingMarketCapacity } from '../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { cropFromFarmType } from '../../domain/value-objects/CropType.js';
import {
  addCrop,
  createFoodStock,
  getCropAmount,
  takeCrop,
} from '../../domain/value-objects/FoodStock.js';
import { resolveBuildingId } from './resolveBuildingId.js';

/**
 * Command: windmill collects crop baskets from all farm refs (December only).
 * Side effects (sales UI / isCollecting / soldToWindmill) stay in legacy — returns transfers.
 */
export class WindmillCollectsFromAllFarms {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.windmillId
   * @param {object[]} params.farmRefs
   * @param {string} params.month - English month (`december`, …)
   * @returns {Promise<{
   *   collected: boolean,
   *   reason?: string,
   *   transfers: Array<{ farmId: string, crop: string, amount: number }>,
   *   totalBaskets: number,
   * }>}
   */
  async execute({ windmillId, farmRefs = [], month }) {
    if (!canWindmillCollectFromFarms(month)) {
      return {
        collected: false,
        reason: 'not_collecting_month',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (!windmill) {
      return {
        collected: false,
        reason: 'windmill_not_found',
        transfers: [],
        totalBaskets: 0,
      };
    }

    if (
      !isOperational({
        roadCount: windmill.roadCount,
        worker: windmill.worker,
        workerNeed: windmill.workerNeed,
      })
    ) {
      return {
        collected: false,
        reason: 'windmill_not_operational',
        transfers: [],
        totalBaskets: 0,
      };
    }

    let capacity = remainingMarketCapacity(windmill.stocks.food, windmill.maxStock);
    if (capacity <= 0) {
      return {
        collected: false,
        reason: 'windmill_full',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const transfers = [];

    for (const ref of farmRefs) {
      if (capacity <= 0) break;

      const farmId = resolveBuildingId(ref);
      if (!farmId) continue;

      const farm = await this.supplyBuildingRepository.findById(farmId);
      if (!farm) continue;

      if (farm.roadCount <= 0) continue;

      const crop = cropFromFarmType(farm.type);
      if (!crop) continue;

      const available = getCropAmount(farm.stocks, crop);
      const amount = Math.min(available, capacity);
      if (amount <= 0) continue;

      const nextFarmStock = takeCrop(farm.stocks, crop, amount);
      await this.supplyBuildingRepository.saveStocks(farmId, nextFarmStock);

      capacity -= amount;
      transfers.push({ farmId, crop, amount });
    }

    if (transfers.length === 0) {
      return {
        collected: false,
        reason: 'nothing_to_collect',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const freshWindmill = await this.supplyBuildingRepository.findById(windmillId);
    const base = createFoodStock(freshWindmill?.stocks ?? windmill.stocks);
    let merged = base;
    for (const t of transfers) {
      merged = addCrop(merged, t.crop, t.amount);
    }
    const cappedFood = Math.min(
      freshWindmill?.maxStock ?? windmill.maxStock,
      merged.food
    );
    const finalStock = createFoodStock({
      wheat: merged.wheat,
      carrot: merged.carrot,
      cabbage: merged.cabbage,
      food: cappedFood,
    });
    await this.supplyBuildingRepository.saveStocks(windmillId, finalStock);

    const totalBaskets = transfers.reduce((sum, t) => sum + t.amount, 0);
    return { collected: true, transfers, totalBaskets };
  }
}
