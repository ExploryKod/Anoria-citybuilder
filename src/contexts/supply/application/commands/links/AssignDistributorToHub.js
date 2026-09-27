import { rankRequirementCandidates } from '../../../domain/policies/PlacementRequirementPolicy.js';
import { addHubLink } from '../../../domain/policies/HubLinkPolicy.js';
import { getLinkCapacityForRole, getCategoriesForRole, listRoleEntries } from '../../../domain/policies/ResourceRolePolicy.js';
import { RebalanceHubAllocations } from './RebalanceHubAllocations.js';

/**
 * Command: link a distributor to the hub(s) it draws on, event-driven — one link per 'distributor'
 * entry that declares a `hubLink`, each in its own row field. Which hub an entry may use comes from that
 * entry's own `hubLink` (`range`, and `hubTypes` when only some hubs are allowed) and the goods it
 * distributes: nothing here names a building or a good, so a catalog edit changes who serves whom.
 */
export class AssignDistributorToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {RebalanceHubAllocations} rebalanceHubAllocations
   */
  constructor(supplyBuildingRepository, rebalanceHubAllocations) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.rebalanceHubAllocations = rebalanceHubAllocations;
  }

  /**
   * @param {object} params
   * @param {string} params.distributorId
   * @param {string} params.distributorType Catalog id — read for the entries that declare a `hubLink`.
   * @param {number} params.x
   * @param {number} params.y
   * @returns {Promise<{ assigned: boolean, reason?: string, hubId?: string, hubIds?: string[] }>}
   */
  async execute({ distributorId, distributorType, x, y }) {
    if (!distributorId) {
      return { assigned: false, reason: 'distributor_id_required' };
    }

    const entries = listRoleEntries(distributorType, 'distributor').filter((entry) => entry.hubLink?.sourceLinkField);
    if (entries.length === 0) {
      return { assigned: false, reason: 'no_hub_link_declared' };
    }

    const hubRows = await this.supplyBuildingRepository.findByResourceRole('hub');
    const hubIds = [];
    let firstFailure = null;
    for (const entry of entries) {
      const outcome = await this.#linkEntry({ distributorId, x, y, entry, hubRows });
      if (outcome.assigned) hubIds.push(outcome.hubId);
      else firstFailure ??= outcome.reason;
    }

    if (hubIds.length === 0) return { assigned: false, reason: firstFailure ?? 'no_owner_hub' };
    return { assigned: true, hubId: hubIds[0], hubIds };
  }

  /**
   * Link every distributor that has an entry still without a hub to a hub just placed (or freed):
   * a hub built AFTER the market that may serve it must serve it, like one built before.
   *
   * @param {object} params
   * @param {string} params.hubId
   * @returns {Promise<{ linked: number }>}
   */
  async linkWaitingDistributors({ hubId }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) return { linked: 0 };

    const distributors = await this.supplyBuildingRepository.findByResourceRole('distributor');
    let linked = 0;
    for (const distributor of distributors) {
      if (distributor.x == null || distributor.y == null) continue;
      for (const entry of listRoleEntries(distributor.type, 'distributor')) {
        const field = entry.hubLink?.sourceLinkField;
        if (!field || distributor[field]) continue;
        const outcome = await this.#linkEntry({ distributorId: distributor.id, x: distributor.x, y: distributor.y, entry, hubRows: [hub] });
        if (outcome.assigned) linked += 1;
      }
    }
    return { linked };
  }

  /**
   * Try to link one entry that has no hub yet to the best hub the catalog lets it use (a hub built
   * after it, or a save from before the entry existed).
   *
   * @param {object} params
   * @param {string} params.distributorId
   * @param {number} params.x
   * @param {number} params.y
   * @param {object} params.entry The 'distributor' entry, with its `hubLink`.
   * @returns {Promise<{ assigned: boolean, reason?: string, hubId?: string }>}
   */
  async linkEntryToAnyHub({ distributorId, x, y, entry }) {
    return this.#linkEntry({ distributorId, x, y, entry, hubRows: await this.supplyBuildingRepository.findByResourceRole('hub') });
  }

  async #linkEntry({ distributorId, x, y, entry, hubRows }) {
    const { sourceLinkField, range, hubTypes } = entry.hubLink;
    if (range == null) {
      throw new Error(`[AssignDistributorToHub] the hubLink of "${entry.categories.join(', ')}" declares no range in buildingEconomy.js`);
    }

    const allowed = hubTypes ? hubRows.filter((hub) => hubTypes.includes(hub.type)) : hubRows;
    const requirement = { role: 'hub', categories: entry.categories, range, requiresCapacity: true };
    const owner = rankRequirementCandidates({ x, y }, allowed, requirement)[0];
    if (!owner) {
      const anyMatch = allowed.some((hub) => getCategoriesForRole(hub.type, 'hub').some((c) => entry.categories.includes(c)));
      return { assigned: false, reason: anyMatch ? 'hub_too_far_or_full' : 'hub_missing' };
    }

    const hub = await this.supplyBuildingRepository.findById(owner.id);
    if (!hub) return { assigned: false, reason: 'hub_not_found' };

    const linkedDistributors = hub.linkedDistributors ?? [];
    const alreadyLinked = linkedDistributors.some((d) => d.distributorId === distributorId);
    const capacity = getLinkCapacityForRole(hub.type, 'hub');
    if (capacity != null && linkedDistributors.length >= capacity && !alreadyLinked) {
      return { assigned: false, reason: 'hub_full' };
    }

    const hubCategories = getCategoriesForRole(hub.type, 'hub');
    await this.supplyBuildingRepository.saveHubLinkedDistributors(
      owner.id,
      addHubLink(linkedDistributors, distributorId, x, y, hubCategories)
    );
    await this.supplyBuildingRepository.saveDistributorHubId(distributorId, owner.id, sourceLinkField);
    await this.rebalanceHubAllocations.execute({ hubId: owner.id, categories: hubCategories });

    return { assigned: true, hubId: owner.id };
  }
}
