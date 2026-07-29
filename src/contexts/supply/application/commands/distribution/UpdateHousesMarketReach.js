import { isWithinMarketRange } from '../../../domain/policies/MarketRangePolicy.js';

/**
 * Command: mark each house `marketTooFar` if it is outside range of every
 * operational (road-connected) market.
 *
 * Matches legacy FoodDistributionService.updateHousesMarketDistanceStatus:
 * markets need road access + coords; houses need coords; house road not required for the flag.
 */
export class UpdateHousesMarketReach {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} [params]
   * @param {number} [params.maxDistance=5] - Manhattan tile range
   * @returns {Promise<{
   *   houses: number,
   *   marketsWithRoad: number,
   *   tooFar: number,
   *   inRange: number,
   * }>}
   */
  async execute({ maxDistance = 5 } = {}) {
    const markets = await this.supplyBuildingRepository.findMarkets();
    const houses = await this.supplyBuildingRepository.findHouses();

    const marketsWithRoad = markets.filter(
      (m) =>
        m.roadCount > 0 &&
        m.x != null &&
        m.y != null &&
        Number.isFinite(m.x) &&
        Number.isFinite(m.y)
    );

    let tooFar = 0;
    let inRange = 0;

    for (const house of houses) {
      if (house.x == null || house.y == null) continue;
      if (!Number.isFinite(house.x) || !Number.isFinite(house.y)) continue;

      const within = marketsWithRoad.some((market) =>
        isWithinMarketRange(
          { x: house.x, y: house.y },
          { x: market.x, y: market.y },
          maxDistance
        )
      );

      const marketTooFar = !within;
      await this.supplyBuildingRepository.saveMarketFlags(house.id, {
        marketTooFar,
      });

      if (marketTooFar) tooFar += 1;
      else inRange += 1;
    }

    return {
      houses: tooFar + inRange,
      marketsWithRoad: marketsWithRoad.length,
      tooFar,
      inRange,
    };
  }
}
