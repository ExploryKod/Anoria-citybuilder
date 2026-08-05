import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  findHousesInMarketRange,
} from '../../../domain/policies/MarketRangePolicy.js';

/**
 * Orchestration: windmill procurement + distribution for every market in the city.
 */
export class RunCityMarketFoodCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./MarketBuysFromAssignedWindmill.js').MarketBuysFromAssignedWindmill} marketBuysFromAssignedWindmill
   * @param {import('../distribution/DistributeFoodFromMarketToHouses.js').DistributeFoodFromMarketToHouses} distributeFoodFromMarketToHouses
   * @param {import('./UpdateMarketWindmillLink.js').UpdateMarketWindmillLink} updateMarketWindmillLink
   * @param {import('../../../infrastructure/presentation/SupplyFoodTraceability.js').SupplyFoodTraceability} traceability
   */
  constructor(
    supplyBuildingRepository,
    marketBuysFromAssignedWindmill,
    distributeFoodFromMarketToHouses,
    updateMarketWindmillLink,
    traceability
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.marketBuysFromAssignedWindmill = marketBuysFromAssignedWindmill;
    this.distributeFoodFromMarketToHouses = distributeFoodFromMarketToHouses;
    this.updateMarketWindmillLink = updateMarketWindmillLink;
    this.traceability = traceability;
  }

  /**
   * @param {object} params
   * @param {string | null} params.season
   * @param {string | null} [params.month]
   * @param {object} params.timeInfo
   * @param {number} params.maxDistance
   * @returns {Promise<{ marketsProcessed: number }>}
   */
  async execute({ season, month = null, timeInfo, maxDistance = 5 }) {
    const markets = await this.supplyBuildingRepository.findMarkets();
    const allBuildings = await this.supplyBuildingRepository.listAllBuildingRows();
    let marketsProcessed = 0;

    for (const market of markets) {
      const processed = await this.#processMarket({
        market,
        allBuildings,
        season,
        month,
        timeInfo,
        maxDistance,
      });
      if (processed) marketsProcessed += 1;
    }

    return { marketsProcessed };
  }

  async #processMarket({ market, allBuildings, season, month, timeInfo, maxDistance }) {
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

    await this.updateMarketWindmillLink.execute({
      marketId: market.id,
      hasWindmillLink: Boolean(market.supplyWindmillId),
    });

    const buyOutcome = await this.marketBuysFromAssignedWindmill.execute({
      marketId: market.id,
      month,
    });

    if (buyOutcome.bought) {
      await this.traceability.recordWindmillToMarketTransfers(
        timeInfo,
        market.id,
        buyOutcome.transfers
      );
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
