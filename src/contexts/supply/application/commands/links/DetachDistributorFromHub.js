import { removeHubLink } from '../../../domain/policies/HubLinkPolicy.js';

/**
 * Command: unlink a demolished distributor from its hub and rebalance
 * leftovers. Generic — replaces the old windmill/market-only
 * DetachMarketFromWindmill.
 */
export class DetachDistributorFromHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./RebalanceHubAllocations.js').RebalanceHubAllocations} rebalanceHubAllocations
   */
  constructor(supplyBuildingRepository, rebalanceHubAllocations) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.rebalanceHubAllocations = rebalanceHubAllocations;
  }

  /**
   * @param {object} params
   * @param {string} params.distributorId
   * @param {string[]} params.categories
   * @param {string} [params.hubLinkField] Field on the distributor row holding its hub id.
   * @returns {Promise<{ detached: boolean, reason?: string, hubId?: string | null }>}
   */
  async execute({ distributorId, categories, hubLinkField = 'supplyWindmillId' }) {
    if (!distributorId) {
      return { detached: false, reason: 'distributor_id_required' };
    }

    const distributor = await this.supplyBuildingRepository.findById(distributorId);
    const hubId = distributor?.[hubLinkField] ?? null;
    if (!hubId) {
      return { detached: false, reason: 'no_hub_link', hubId: null };
    }

    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (hub) {
      const nextLinks = removeHubLink(hub.linkedMarkets ?? [], distributorId);
      await this.supplyBuildingRepository.saveLinkedMarkets(hubId, nextLinks);
      await this.rebalanceHubAllocations.execute({ hubId, categories });
    }

    return { detached: true, hubId };
  }
}
