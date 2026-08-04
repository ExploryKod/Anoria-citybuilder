import {
  hasRoadAccess,
  isEligibleWorkplace,
  isLaborSource,
} from '../../domain/policies/BuildingRolePolicy.js';
import { workerPopFromHouse } from '../../domain/policies/LaborPoolPolicy.js';
import {
  allocateWorkers,
  orderWorkplacesByPriority,
} from '../../domain/policies/WorkerAllocationPolicy.js';
import {
  allSocialGroups,
  eligibleSectorsForGroup,
  residentialGroupForType,
} from '../../domain/catalogs/HouseGroupSectorEligibilityPolicy.js';

/**
 * Command: monthly city-wide worker redistribution.
 *
 * Each social group (artisans-ouvriers / commerçants / savants) runs its own
 * allocation pass over its own labor pool and eligible workplaces (sectors),
 * instead of one flat city-wide pool — groups never compete with each other
 * for jobs.
 *
 * Sector priorities are supplied by the caller (localStorage / config stay outside the BC).
 * Factory productWorkerDistribution sync stays in the legacy facade.
 */
export class DistributeCityWorkers {
  /**
   * @param {import('../ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} employmentBuildingRepository
   */
  constructor(employmentBuildingRepository) {
    this.employmentBuildingRepository = employmentBuildingRepository;
  }

  /**
   * @param {object} [params]
   * @param {Record<number|string, number>} [params.sectorPriorities]
   * @returns {Promise<{
   *   availableWorkers: number,
   *   assignments: Array<{ buildingId: string, workers: number }>,
   * }>}
   */
  async execute({ sectorPriorities = {} } = {}) {
    await this.employmentBuildingRepository.resetWorkplaceWorkers();

    const laborSources = await this.employmentBuildingRepository.listLaborSources();
    const workplaces = (await this.employmentBuildingRepository.listWorkplaces()).filter(
      (b) => isEligibleWorkplace(b)
    );

    // After reset, workers are 0. Tracked locally so a later group's pass
    // sees the workplaces already filled by an earlier group this tick.
    const workerCountById = new Map(workplaces.map((w) => [w.id, 0]));
    const allAssignments = [];
    let totalAvailableWorkers = 0;

    for (const group of allSocialGroups()) {
      const eligibleSectors = new Set(eligibleSectorsForGroup(group));

      const groupWorkers = laborSources
        .filter(
          (b) =>
            isLaborSource(b) && hasRoadAccess(b) && residentialGroupForType(b.type) === group
        )
        .reduce((sum, b) => sum + workerPopFromHouse(b.type, b.pop, b.level), 0);

      totalAvailableWorkers += groupWorkers;
      if (groupWorkers <= 0) continue;

      const groupWorkplaces = workplaces
        .filter((w) => eligibleSectors.has(w.sector))
        .map((w) => ({ ...w, worker: workerCountById.get(w.id) ?? 0 }));

      const ordered = orderWorkplacesByPriority(groupWorkplaces, sectorPriorities);
      const { assignments } = allocateWorkers(groupWorkers, ordered);

      for (const { buildingId, workers } of assignments) {
        workerCountById.set(buildingId, (workerCountById.get(buildingId) ?? 0) + workers);
      }
      allAssignments.push(...assignments);
    }

    for (const [buildingId, workers] of workerCountById) {
      if (workers > 0) {
        await this.employmentBuildingRepository.saveWorkers(buildingId, workers);
      }
    }

    return { availableWorkers: totalAvailableWorkers, assignments: allAssignments };
  }
}
