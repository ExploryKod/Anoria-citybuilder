/**
 * Bulldoze all distributors linked to a hub before the hub itself is
 * removed.
 */
export class CascadeDestroyHubDistributors {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
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
    const linkedDistributors = hub?.linkedDistributors ?? [];
    const destroyed = [];

    for (const link of linkedDistributors) {
      if (!link?.distributorId) continue;

      await bulldozeBuildingAtTile({
        city,
        x: link.x,
        y: link.y,
      });

      destroyed.push({
        distributorId: link.distributorId,
        x: link.x,
        y: link.y,
      });
    }

    await this.supplyBuildingRepository.saveHubLinkedDistributors(hubId, []);

    return { destroyed };
  }
}
