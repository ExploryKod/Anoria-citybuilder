import { computeHubAllocations } from '../../../domain/policies/HubLinkPolicy.js';

/**
 * Command: split a hub's stock across its linked distributors. Generic —
 * replaces the old windmill/market-only RebalanceWindmillMarketAllocations;
 * works for any hub (windmill, warehouse, granary, ...) given its
 * category list.
 */
export class RebalanceHubAllocations {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {string[]} params.categories
   * @returns {Promise<{ rebalanced: boolean, reason?: string, linkedMarkets?: object[] }>}
   */
  async execute({ hubId, categories }) {
    if (!hubId) {
      return { rebalanced: false, reason: 'hub_id_required' };
    }

    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { rebalanced: false, reason: 'hub_not_found' };
    }

    const linkedMarkets = hub.linkedMarkets ?? [];
    if (linkedMarkets.length === 0) {
      return { rebalanced: false, reason: 'no_linked_distributors', linkedMarkets: [] };
    }

    const nextLinks = computeHubAllocations(hub.stocks, linkedMarkets, categories);
    await this.supplyBuildingRepository.saveLinkedMarkets(hubId, nextLinks);

    return { rebalanced: true, linkedMarkets: nextLinks };
  }
}
