/**
 * Bulldoze all markets linked to a windmill before the windmill itself is removed.
 */
export class CascadeDestroyWindmillMarkets {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./DetachMarketFromWindmill.js').DetachMarketFromWindmill} detachMarketFromWindmill
   */
  constructor(supplyBuildingRepository, detachMarketFromWindmill) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.detachMarketFromWindmill = detachMarketFromWindmill;
  }

  /**
   * @param {object} params
   * @param {string} params.windmillId
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {(args: { city: object, x: number, y: number }) => Promise<unknown>} params.bulldozeBuildingAtTile
   * @returns {Promise<{ destroyed: Array<{ marketId: string, x: number, y: number }> }>}
   */
  async execute({ windmillId, city, bulldozeBuildingAtTile }) {
    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    const linkedMarkets = windmill?.linkedMarkets ?? [];
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

    await this.supplyBuildingRepository.saveLinkedMarkets(windmillId, []);

    return { destroyed };
  }
}
