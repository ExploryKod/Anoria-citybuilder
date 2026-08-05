import { removeMarketLink } from '../../../domain/policies/WindmillMarketLinkPolicy.js';
import { RebalanceWindmillMarketAllocations } from './RebalanceWindmillMarketAllocations.js';

/**
 * Command: unlink a demolished market from its windmill and rebalance leftovers.
 */
export class DetachMarketFromWindmill {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {RebalanceWindmillMarketAllocations} rebalanceWindmillMarketAllocations
   */
  constructor(supplyBuildingRepository, rebalanceWindmillMarketAllocations) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.rebalanceWindmillMarketAllocations = rebalanceWindmillMarketAllocations;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @returns {Promise<{ detached: boolean, reason?: string, windmillId?: string | null }>}
   */
  async execute({ marketId }) {
    if (!marketId) {
      return { detached: false, reason: 'market_id_required' };
    }

    const market = await this.supplyBuildingRepository.findById(marketId);
    const windmillId = market?.supplyWindmillId ?? null;
    if (!windmillId) {
      return { detached: false, reason: 'no_windmill_link', windmillId: null };
    }

    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (windmill) {
      const nextLinks = removeMarketLink(windmill.linkedMarkets ?? [], marketId);
      await this.supplyBuildingRepository.saveLinkedMarkets(windmillId, nextLinks);
      await this.rebalanceWindmillMarketAllocations.execute({ windmillId });
    }

    return { detached: true, windmillId };
  }
}
