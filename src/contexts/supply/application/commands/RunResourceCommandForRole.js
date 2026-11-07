import { tickPerfEnabled } from '../../../../core/diagnostics/tickPerf.js';

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
    const startedAt = performance.now();
    const buildings = await this.supplyBuildingRepository.findByResourceRole(role, categories);
    const results = [];
    // Measurement only (performance.plan.md): the time each building's command took, so a slow pass names the buildings that make it slow.
    const spent = [];

    for (const building of buildings) {
      const buildingStartedAt = performance.now();
      // One building's command must never take the rest of the city down with it: an uncaught
      // throw here used to abort this loop entirely, silently skipping every building queued
      // after the failing one — and, since this same call is one step of RunMonthlyResourceCycle,
      // every step after it too (the hub collection that would have moved this tick's output
      // into a warehouse, in particular). Loud (console.error), but isolated per building.
      let outcome;
      try {
        outcome = await this.command.execute(buildParams(building));
      } catch (error) {
        console.error(`[RunResourceCommandForRole] "${role}" command failed for building ${building.id} (${building.type}):`, error);
        continue;
      }
      if (outcome[successKey]) {
        results.push(outcome);
      }
      spent.push({ type: building.type, ms: performance.now() - buildingStartedAt });
    }

    if (tickPerfEnabled()) {
      const slowest = [...spent].sort((a, b) => b.ms - a.ms).slice(0, 3).map(({ type, ms }) => `${type}=${ms.toFixed(1)}`).join(' ');
      console.info(`[tick-perf] role=${role}${categories ? ` (${[].concat(categories).join(',')})` : ''} buildings=${buildings.length} total=${(performance.now() - startedAt).toFixed(1)}ms slowest: ${slowest}`);
    }

    return { count: results.length, results };
  }
}
