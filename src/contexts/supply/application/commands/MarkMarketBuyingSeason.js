import { canMarketBuyFromFarms } from '../../domain/policies/BuyingSeasonPolicy.js';

/**
 * Command: set market `isBuying` from English season (UI flag).
 */
export class MarkMarketBuyingSeason {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} season
   * @returns {Promise<{ markets: number, isBuying: boolean }>}
   */
  async execute(season) {
    const isBuying = canMarketBuyFromFarms(season);
    const markets = await this.supplyBuildingRepository.findMarkets();

    for (const market of markets) {
      await this.supplyBuildingRepository.saveMarketFlags(market.id, { isBuying });
    }

    return { markets: markets.length, isBuying };
  }
}
