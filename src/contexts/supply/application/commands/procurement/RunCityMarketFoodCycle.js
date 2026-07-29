import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  findHousesInMarketRange,
  isFarmNeighborRef,
} from '../../../domain/policies/MarketRangePolicy.js';

/**
 * Orchestration: procurement + distribution for every market in the city.
 */
export class RunCityMarketFoodCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./MarketBuysFromNearbyFarms.js').MarketBuysFromNearbyFarms} marketBuysFromNearbyFarms
   * @param {import('../distribution/DistributeFoodFromMarketToHouses.js').DistributeFoodFromMarketToHouses} distributeFoodFromMarketToHouses
   * @param {import('./UpdateMarketFarmProximity.js').UpdateMarketFarmProximity} updateMarketFarmProximity
   * @param {import('../../../infrastructure/presentation/SupplyFoodTraceability.js').SupplyFoodTraceability} traceability
   */
  constructor(
    supplyBuildingRepository,
    marketBuysFromNearbyFarms,
    distributeFoodFromMarketToHouses,
    updateMarketFarmProximity,
    traceability
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.marketBuysFromNearbyFarms = marketBuysFromNearbyFarms;
    this.distributeFoodFromMarketToHouses = distributeFoodFromMarketToHouses;
    this.updateMarketFarmProximity = updateMarketFarmProximity;
    this.traceability = traceability;
  }

  /**
   * @param {object} params
   * @param {string | null} params.season
   * @param {object} params.timeInfo
   * @param {number} params.maxDistance
   * @returns {Promise<{ marketsProcessed: number }>}
   */
  async execute({ season, timeInfo, maxDistance = 5 }) {
    const markets = await this.supplyBuildingRepository.findMarkets();
    const allBuildings = await this.supplyBuildingRepository.listAllBuildingRows();
    let marketsProcessed = 0;

    for (const market of markets) {
      const processed = await this.#processMarket({
        market,
        allBuildings,
        season,
        timeInfo,
        maxDistance,
      });
      if (processed) marketsProcessed += 1;
    }

    return { marketsProcessed };
  }

  async #processMarket({ market, allBuildings, season, timeInfo, maxDistance }) {
    const marketRow = await this.supplyBuildingRepository.findBuildingRow(market.id);
    if (!marketRow) return false;

    if (
      !isOperational({
        roadCount: marketRow.roads ?? market.roadCount,
        worker: market.worker,
        workerNeed: market.workerNeed,
      })
    ) {
      return false;
    }

    const neighbors = marketRow.neighbors || [];
    const farmsNearby = neighbors.filter(isFarmNeighborRef);
    const hasFarmsNearby = farmsNearby.length > 0;

    await this.updateMarketFarmProximity.execute({
      marketId: market.id,
      hasFarmsNearby,
    });

    if (hasFarmsNearby) {
      const buyOutcome = await this.marketBuysFromNearbyFarms.execute({
        marketId: market.id,
        farmRefs: farmsNearby,
        season,
      });

      if (buyOutcome.bought) {
        for (const transfer of buyOutcome.transfers) {
          await this.supplyBuildingRepository.recordFarmSaleToMarket(
            transfer.farmId,
            {
              year: timeInfo.year ?? 0,
              month: timeInfo.monthIndex ?? 0,
              monthName: timeInfo.month || '',
              turn: timeInfo.turn ?? 0,
              productType: transfer.crop,
              quantity: transfer.amount,
              marketId: market.id,
            }
          );
        }
        await this.traceability.recordFarmToMarketTransfers(
          timeInfo,
          market.id,
          buyOutcome.transfers
        );
      }
    }

    const housesInRange = findHousesInMarketRange(marketRow, allBuildings, maxDistance);
    if (housesInRange.length > 0) {
      const distributeOutcome = await this.distributeFoodFromMarketToHouses.execute({
        marketId: market.id,
        houseRefs: housesInRange,
        season,
      });

      if (distributeOutcome.distributed) {
        await this.traceability.recordMarketToHouseTransfers(
          timeInfo,
          market.id,
          distributeOutcome.transfers
        );
      }
    }

    return true;
  }
}
