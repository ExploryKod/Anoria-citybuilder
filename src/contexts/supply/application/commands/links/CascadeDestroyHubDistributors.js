import { getPlacementRequirements, getCategoriesForRole, listRoleEntries } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Before a hub is removed: bulldoze the distributors that could not have been placed without it (their
 * `placementRequires` names a hub of its goods), and only unlink the ones that merely drew on it as an
 * option (a `hubLink` with no placement requirement) — they go on, without that supply.
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
      const dependsOnHub = getPlacementRequirements(distributor?.type).some(
        (requirement) =>
          requirement.role === 'hub' && requirement.categories.some((category) => hubCategories.includes(category))
      );
      if (dependsOnHub) dependents.push({ distributorId: link.distributorId, type: distributor.type, x: link.x, y: link.y });
    }
    return dependents;
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

      // An optional supply: forget this hub, keep the building.
      const distributor = await this.supplyBuildingRepository.findById(link.distributorId);
      for (const entry of listRoleEntries(distributor?.type, 'distributor')) {
        const field = entry.hubLink?.sourceLinkField;
        if (field && distributor[field] === hubId) {
          await this.supplyBuildingRepository.saveDistributorHubId(link.distributorId, null, field);
        }
      }
    }

    await this.supplyBuildingRepository.saveHubLinkedDistributors(hubId, []);

    return { destroyed };
  }
}
