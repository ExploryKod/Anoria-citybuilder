import { removeHubLink } from '../../../domain/policies/HubLinkPolicy.js';
import { getCategoriesForRole, listRoleEntries } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: unlink a demolished distributor from its hub and rebalance
 * leftovers.
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
   * Unlinks the distributor from EVERY hub it is linked to (one per 'distributor' entry with a `hubLink`).
   * @param {object} params
   * @param {string} params.distributorId
   * @returns {Promise<{ detached: boolean, reason?: string, hubIds: string[] }>}
   */
  async execute({ distributorId }) {
    if (!distributorId) {
      return { detached: false, reason: 'distributor_id_required', hubIds: [] };
    }

    const distributor = await this.supplyBuildingRepository.findById(distributorId);
    const hubIds = [];
    for (const entry of listRoleEntries(distributor?.type, 'distributor')) {
      const field = entry.hubLink?.sourceLinkField;
      const hubId = field ? distributor?.[field] : null;
      if (!hubId) continue;

      const hub = await this.supplyBuildingRepository.findById(hubId);
      if (hub) {
        const nextLinks = removeHubLink(hub.linkedDistributors ?? [], distributorId);
        await this.supplyBuildingRepository.saveHubLinkedDistributors(hubId, nextLinks);
        await this.rebalanceHubAllocations.execute({ hubId, categories: getCategoriesForRole(hub.type, 'hub') });
      }
      hubIds.push(hubId);
    }

    return hubIds.length > 0 ? { detached: true, hubIds } : { detached: false, reason: 'no_hub_link', hubIds };
  }
}
