import { canPlaceBuildingAt } from '../../../domain/policies/PlacementRequirementPolicy.js';
import { addHubLink } from '../../../domain/policies/HubLinkPolicy.js';
import { getLinkCapacityForRole } from '../../../domain/policies/ResourceRolePolicy.js';
import { RebalanceHubAllocations } from './RebalanceHubAllocations.js';

/**
 * Command: link a newly placed distributor (market, ...) to its owning hub
 * (windmill, ...), event-driven. Generic — replaces the old
 * windmill/market-only AssignMarketToWindmill: which hub role/category to
 * search for comes from the distributor's own `placementRequires` catalog
 * fact (see PlacementRequirementPolicy.js), not hardcoded windmill logic.
 */
export class AssignDistributorToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {RebalanceHubAllocations} rebalanceHubAllocations
   * @param {string[]} categories
   */
  constructor(supplyBuildingRepository, rebalanceHubAllocations, categories) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.rebalanceHubAllocations = rebalanceHubAllocations;
    this.categories = categories;
  }

  /**
   * @param {object} params
   * @param {string} params.distributorId
   * @param {string} params.distributorType Catalog id — used to read this
   *   type's `placementRequires` when `ownerHubId` isn't already resolved.
   * @param {number} params.x
   * @param {number} params.y
   * @param {string} [params.ownerHubId] - skip discovery when placement already resolved owner
   * @returns {Promise<{ assigned: boolean, reason?: string, hubId?: string }>}
   */
  async execute({ distributorId, distributorType, x, y, ownerHubId = null }) {
    if (!distributorId) {
      return { assigned: false, reason: 'distributor_id_required' };
    }

    let hubId = ownerHubId;
    if (!hubId) {
      const hubRows = await this.supplyBuildingRepository.findByResourceRole('hub', this.categories);
      const placement = canPlaceBuildingAt({ x, y, buildingType: distributorType, candidates: hubRows });
      if (!placement.ok || !placement.ownerId) {
        return { assigned: false, reason: placement.reason || 'no_owner_hub' };
      }
      hubId = placement.ownerId;
    }

    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { assigned: false, reason: 'hub_not_found' };
    }

    const linkedMarkets = hub.linkedMarkets ?? [];
    const alreadyLinked = linkedMarkets.some((m) => m.marketId === distributorId);
    const capacity = getLinkCapacityForRole(hub.type, 'hub');
    if (capacity != null && linkedMarkets.length >= capacity && !alreadyLinked) {
      return { assigned: false, reason: 'hub_full' };
    }

    const nextLinks = addHubLink(linkedMarkets, distributorId, x, y, this.categories);
    await this.supplyBuildingRepository.saveLinkedMarkets(hubId, nextLinks);
    await this.supplyBuildingRepository.saveSupplyWindmillId(distributorId, hubId);
    await this.rebalanceHubAllocations.execute({ hubId, categories: this.categories });

    return { assigned: true, hubId };
  }
}
