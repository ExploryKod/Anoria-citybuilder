import { computeHubAllocations } from '../../../domain/policies/HubLinkPolicy.js';

/**
 * Command: split a hub's stock across its linked distributors — works for
 * any hub given its category list.
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
   * @returns {Promise<{ rebalanced: boolean, reason?: string, linkedDistributors?: object[] }>}
   */
  async execute({ hubId, categories }) {
    if (!hubId) {
      return { rebalanced: false, reason: 'hub_id_required' };
    }

    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { rebalanced: false, reason: 'hub_not_found' };
    }

    const linkedDistributors = hub.linkedDistributors ?? [];
    if (linkedDistributors.length === 0) {
      return { rebalanced: false, reason: 'no_linked_distributors', linkedDistributors: [] };
    }

    const nextLinks = computeHubAllocations(hub.stocks, linkedDistributors, categories);
    await this.supplyBuildingRepository.saveHubLinkedDistributors(hubId, nextLinks);

    return { rebalanced: true, linkedDistributors: nextLinks };
  }
}
