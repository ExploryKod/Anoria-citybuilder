import { computeMarketAllocations } from '../../../domain/policies/WindmillMarketLinkPolicy.js';

/**
 * Command: split windmill crop stocks across its linked markets.
 */
export class RebalanceWindmillMarketAllocations {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.windmillId
   * @returns {Promise<{ rebalanced: boolean, reason?: string, linkedMarkets?: object[] }>}
   */
  async execute({ windmillId }) {
    if (!windmillId) {
      return { rebalanced: false, reason: 'windmill_id_required' };
    }

    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (!windmill) {
      return { rebalanced: false, reason: 'windmill_not_found' };
    }

    const linkedMarkets = windmill.linkedMarkets ?? [];
    if (linkedMarkets.length === 0) {
      return { rebalanced: false, reason: 'no_linked_markets', linkedMarkets: [] };
    }

    const nextLinks = computeMarketAllocations(windmill.stocks, linkedMarkets);
    await this.supplyBuildingRepository.saveLinkedMarkets(windmillId, nextLinks);

    return { rebalanced: true, linkedMarkets: nextLinks };
  }
}
