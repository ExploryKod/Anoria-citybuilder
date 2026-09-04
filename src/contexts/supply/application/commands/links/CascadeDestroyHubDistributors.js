/**
 * Bulldoze all distributors linked to a hub before the hub itself is
 * removed. Generic — replaces the old windmill/market-only
 * CascadeDestroyWindmillMarkets (which also took an unused
 * DetachMarketFromWindmill dependency — dropped, it never called it).
 */
export class CascadeDestroyHubDistributors {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {(args: { city: object, x: number, y: number }) => Promise<unknown>} params.bulldozeBuildingAtTile
   * @returns {Promise<{ destroyed: Array<{ marketId: string, x: number, y: number }> }>}
   */
  async execute({ hubId, city, bulldozeBuildingAtTile }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    const linkedMarkets = hub?.linkedMarkets ?? [];
    const destroyed = [];

    for (const link of linkedMarkets) {
      if (!link?.marketId) continue;

      await bulldozeBuildingAtTile({
        city,
        x: link.x,
        y: link.y,
      });

      destroyed.push({
        marketId: link.marketId,
        x: link.x,
        y: link.y,
      });
    }

    await this.supplyBuildingRepository.saveLinkedMarkets(hubId, []);

    return { destroyed };
  }
}
