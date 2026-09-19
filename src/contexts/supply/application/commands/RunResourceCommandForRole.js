/**
 * Generic orchestration: run one command once for every building holding a
 * given resourceRoles role, collecting the successful outcomes.
 *
 * Replaces HarvestAllFarmCrops / ConsumeAllHouseFood / ProduceAllHouseSubsistenceFood
 * — those were three copies of the identical shape ("find buildings by role,
 * loop, delegate to a per-building command, collect successes"), one per
 * resource. "Harvest" was never a distinct mechanism; it was this loop
 * running ProduceResource on producer-role buildings. One class, configured
 * per use rather than duplicated per resource.
 */
export class RunResourceCommandForRole {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {{ execute: (params: object) => Promise<object> }} command
   */
  constructor(supplyBuildingRepository, command) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.command = command;
  }

  /**
   * @param {object} params
   * @param {import('../../domain/policies/ResourceRolePolicy.js').ResourceRoleKind} params.role
   * @param {string | string[]} [params.categories]
   * @param {(building: object) => object} params.buildParams Per-building params for `command.execute`.
   * @param {string} params.successKey Outcome field that's truthy on success (e.g. 'produced', 'consumed').
   * @returns {Promise<{ count: number, results: object[] }>}
   */
  async execute({ role, categories, buildParams, successKey }) {
    const buildings = await this.supplyBuildingRepository.findByResourceRole(role, categories);
    const results = [];

    for (const building of buildings) {
      const outcome = await this.command.execute(buildParams(building));
      if (outcome[successKey]) {
        results.push(outcome);
      }
    }

    return { count: results.length, results };
  }
}
