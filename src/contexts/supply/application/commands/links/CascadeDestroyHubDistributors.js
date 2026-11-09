import { getPlacementRequirements, getCategoriesForRole, listRoleEntries } from '../../../domain/policies/ResourceRolePolicy.js';
import { rankRequirementCandidates } from '../../../domain/policies/PlacementRequirementPolicy.js';
import { addHubLink } from '../../../domain/policies/HubLinkPolicy.js';

/**
 * Before a hub is removed: bulldoze the distributors that could not have been placed without it (their
 * `placementRequires` names a hub of its goods), and only unlink the ones that merely drew on it as an
 * option (a `hubLink` with no placement requirement) — they go on, without that supply.
 *
 * A distributor whose requirement is capacity-free (`maxPerHub`: a market among its granaries) does not depend on this one hub, but on there being a hub in its reach: while another
 * stands there, it stays and remembers that one instead. The number of markets that may stand falls with the granaries, but none is bulldozed for it (no new one can be placed).
 */
export class CascadeDestroyHubDistributors {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * What demolishing the hub would take down with it, without touching anything: the distributors linked to
   * it that could not have been placed without it.
   * @param {object} params
   * @param {string} params.hubId
   * @returns {Promise<Array<{ distributorId: string, type: string, x: number, y: number }>>}
   */
  async findDependents({ hubId }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    const hubCategories = hub ? getCategoriesForRole(hub.type, 'hub') : [];
    const dependents = [];
    for (const link of hub?.linkedDistributors ?? []) {
      if (!link?.distributorId) continue;
      const distributor = await this.supplyBuildingRepository.findById(link.distributorId);
      const requirement = getPlacementRequirements(distributor?.type).find(
        (candidate) => candidate.role === 'hub' && candidate.categories.some((category) => hubCategories.includes(category))
      );
      const dependsOnHub = requirement !== undefined && !(await this.#anotherHubServes(distributor, requirement, hubId));
      if (dependsOnHub) dependents.push({ distributorId: link.distributorId, type: distributor.type, x: link.x, y: link.y });
    }
    return dependents;
  }

  /** The hub a distributor remembers once `hubId` is gone: the first in its reach by priority (nothing: it has none left). */
  async #nextHubOf(distributor, entry, hubId) {
    const others = (await this.supplyBuildingRepository.findByResourceRole('hub')).filter((hub) => hub.id !== hubId && (!entry.hubLink.hubTypes || entry.hubLink.hubTypes.includes(hub.type)));
    const requirement = { role: 'hub', categories: entry.categories, range: entry.hubLink.range, directionOrder: entry.hubLink.directionOrder };
    return rankRequirementCandidates(distributor, others, requirement)[0] ?? null;
  }

  /** Whether, with `hubId` gone, a hub of the requirement still stands in reach of the distributor (only a capacity-free requirement can be served by another). */
  async #anotherHubServes(distributor, requirement, hubId) {
    if (requirement.maxPerHub == null) return false;
    const others = (await this.supplyBuildingRepository.findByResourceRole('hub')).filter((hub) => hub.id !== hubId);
    return rankRequirementCandidates(distributor, others, requirement).length > 0;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {{ size: number, tiles: object[][] }} params.city
   * @param {(args: { city: object, x: number, y: number }) => Promise<unknown>} params.bulldozeBuildingAtTile
   * @returns {Promise<{ destroyed: Array<{ distributorId: string, x: number, y: number }> }>}
   */
  async execute({ hubId, city, bulldozeBuildingAtTile }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    const dependentIds = new Set((await this.findDependents({ hubId })).map((d) => d.distributorId));
    const destroyed = [];

    for (const link of hub?.linkedDistributors ?? []) {
      if (!link?.distributorId) continue;

      if (dependentIds.has(link.distributorId)) {
        await bulldozeBuildingAtTile({ city, x: link.x, y: link.y });
        destroyed.push({ distributorId: link.distributorId, x: link.x, y: link.y });
        continue;
      }

      // Not dependent: forget this hub, keep the building, and remember the next hub in its reach when its link selects the nearest.
      const distributor = await this.supplyBuildingRepository.findById(link.distributorId);
      for (const entry of listRoleEntries(distributor?.type, 'distributor')) {
        const field = entry.hubLink?.sourceLinkField;
        if (field && distributor[field] === hubId) {
          const next = entry.hubLink.selection === 'nearest' ? await this.#nextHubOf(distributor, entry, hubId) : null;
          await this.supplyBuildingRepository.saveDistributorHubId(link.distributorId, next?.id ?? null, field);
          if (next) {
            const row = await this.supplyBuildingRepository.findById(next.id);
            await this.supplyBuildingRepository.saveHubLinkedDistributors(next.id, addHubLink(row.linkedDistributors ?? [], distributor.id, distributor.x, distributor.y, getCategoriesForRole(row.type, 'hub')));
          }
        }
      }
    }

    await this.supplyBuildingRepository.saveHubLinkedDistributors(hubId, []);

    return { destroyed };
  }
}
