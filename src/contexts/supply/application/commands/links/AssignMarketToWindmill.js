import {
  addMarketLink,
  canPlaceMarketAt,
  MAX_MARKETS_PER_WINDMILL,
} from '../../../domain/policies/WindmillMarketLinkPolicy.js';
import { RebalanceWindmillMarketAllocations } from './RebalanceWindmillMarketAllocations.js';

/**
 * Command: link a newly placed market to its owning windmill (event-driven).
 */
export class AssignMarketToWindmill {
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
   * @param {number} params.x
   * @param {number} params.y
   * @param {string} [params.ownerWindmillId] - skip discovery when placement already resolved owner
   * @returns {Promise<{ assigned: boolean, reason?: string, windmillId?: string }>}
   */
  async execute({ marketId, x, y, ownerWindmillId = null }) {
    if (!marketId) {
      return { assigned: false, reason: 'market_id_required' };
    }

    const windmillRows = await this.supplyBuildingRepository.findWindmills();
    const windmills = windmillRows.map((windmill) => ({
      id: windmill.id,
      x: windmill.x,
      y: windmill.y,
      roadCount: windmill.roadCount,
      linkedMarkets: windmill.linkedMarkets ?? [],
    }));

    let windmillId = ownerWindmillId;
    if (!windmillId) {
      const placement = canPlaceMarketAt({ x, y, windmills });
      if (!placement.ok || !placement.ownerWindmillId) {
        return { assigned: false, reason: placement.reason || 'no_owner_windmill' };
      }
      windmillId = placement.ownerWindmillId;
    }

    const windmill = await this.supplyBuildingRepository.findById(windmillId);
    if (!windmill) {
      return { assigned: false, reason: 'windmill_not_found' };
    }

    const linkedCount = windmill.linkedMarkets?.length ?? 0;
    if (linkedCount >= MAX_MARKETS_PER_WINDMILL && !windmill.linkedMarkets?.some((m) => m.marketId === marketId)) {
      return { assigned: false, reason: 'windmill_full' };
    }

    const nextLinks = addMarketLink(windmill.linkedMarkets ?? [], marketId, x, y);
    await this.supplyBuildingRepository.saveLinkedMarkets(windmillId, nextLinks);
    await this.supplyBuildingRepository.saveSupplyWindmillId(marketId, windmillId);
    await this.rebalanceWindmillMarketAllocations.execute({ windmillId });

    return { assigned: true, windmillId };
  }
}
