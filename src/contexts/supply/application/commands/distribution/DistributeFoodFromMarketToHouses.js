import { canMarketDistributeToHouses } from '../../../domain/policies/BuyingSeasonPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { CROPS } from '../../../domain/value-objects/CropType.js';
import {
  addCrop,
  createFoodStock,
  getCropAmount,
  takeCrop,
} from '../../../domain/value-objects/FoodStock.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';

/**
 * Command: market sells baskets to houses in range (not in autumn).
 * Round-robin: each iteration every house may take 1 basket per available crop.
 * Traceability stays in legacy — returns transfers.
 */
export class DistributeFoodFromMarketToHouses {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @param {object[]} params.houseRefs
   * @param {string} params.season
   * @returns {Promise<{
   *   distributed: boolean,
   *   reason?: string,
   *   transfers: Array<{ houseId: string, crop: string, amount: number }>,
   *   totalBaskets: number,
   * }>}
   */
  async execute({ marketId, houseRefs = [], season }) {
    if (!canMarketDistributeToHouses(season)) {
      return {
        distributed: false,
        reason: 'not_distribution_season',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const market = await this.supplyBuildingRepository.findById(marketId);
    if (!market) {
      return {
        distributed: false,
        reason: 'market_not_found',
        transfers: [],
        totalBaskets: 0,
      };
    }

    if (
      !isOperational({
        roadCount: market.roadCount,
        worker: market.worker,
        workerNeed: market.workerNeed,
      })
    ) {
      return {
        distributed: false,
        reason: 'market_not_operational',
        transfers: [],
        totalBaskets: 0,
      };
    }

    let marketStock = createFoodStock(market.stocks);
    const availableTotal = CROPS.reduce(
      (sum, crop) => sum + getCropAmount(marketStock, crop),
      0
    );
    if (availableTotal <= 0) {
      return {
        distributed: false,
        reason: 'market_empty',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const houseIds = [
      ...new Set(
        houseRefs.map(resolveInstanceIdFromNeighborRef).filter((id) => typeof id === 'string' && id.length > 0)
      ),
    ];
    if (houseIds.length === 0) {
      return {
        distributed: false,
        reason: 'no_houses',
        transfers: [],
        totalBaskets: 0,
      };
    }

    const transfers = [];
    const maxIterations = Math.max(
      getCropAmount(marketStock, 'wheat'),
      getCropAmount(marketStock, 'carrot'),
      getCropAmount(marketStock, 'cabbage'),
      1
    );

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let boughtThisRound = false;

      for (const houseId of houseIds) {
        const stillAvailable = CROPS.some((crop) => getCropAmount(marketStock, crop) > 0);
        if (!stillAvailable) break;

        const house = await this.supplyBuildingRepository.findById(houseId);
        if (!house) continue;

        // Houses need road access to receive deliveries (same as findHousesInRange filter)
        if (house.roadCount <= 0) continue;

        let houseStock = createFoodStock(house.stocks);
        let changed = false;

        for (const crop of CROPS) {
          if (getCropAmount(marketStock, crop) <= 0) continue;
          marketStock = takeCrop(marketStock, crop, 1);
          houseStock = addCrop(houseStock, crop, 1);
          transfers.push({ houseId, crop, amount: 1 });
          changed = true;
          boughtThisRound = true;
        }

        if (changed) {
          await this.supplyBuildingRepository.saveStocks(houseId, houseStock);
        }
      }

      if (!boughtThisRound) break;
    }

    if (transfers.length === 0) {
      return {
        distributed: false,
        reason: 'nothing_distributed',
        transfers: [],
        totalBaskets: 0,
      };
    }

    await this.supplyBuildingRepository.saveStocks(marketId, marketStock);

    const totalBaskets = transfers.reduce((sum, t) => sum + t.amount, 0);
    return { distributed: true, transfers, totalBaskets };
  }
}
