import {
  hasRoadAccess,
  isLaborSource,
  isWorkplace,
} from '../../domain/policies/BuildingRolePolicy.js';
import { workerPopFromHouse } from '../../domain/policies/LaborPoolPolicy.js';
import {
  allocateWorkers,
  orderWorkplacesByPriority,
} from '../../domain/policies/WorkerAllocationPolicy.js';

/**
 * Command: monthly city-wide worker redistribution.
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
    const availableWorkers = laborSources
      .filter((b) => isLaborSource(b) && hasRoadAccess(b))
      .reduce((sum, b) => sum + workerPopFromHouse(b.type, b.pop), 0);

    if (availableWorkers <= 0) {
      return { availableWorkers: 0, assignments: [] };
    }

    const workplaces = (await this.employmentBuildingRepository.listWorkplaces()).filter(
      (b) => isWorkplace(b) && hasRoadAccess(b)
    );

    // After reset, workers are 0 — re-read via listWorkplaces which should reflect reset.
    // Defensive: treat worker as 0 for deficit calculation after reset.
    const workplacesAfterReset = workplaces.map((w) => ({ ...w, worker: 0 }));

    const ordered = orderWorkplacesByPriority(workplacesAfterReset, sectorPriorities);
    const { assignments } = allocateWorkers(availableWorkers, ordered);

    for (const { buildingId, workers } of assignments) {
      await this.employmentBuildingRepository.saveWorkers(buildingId, workers);
    }

    return { availableWorkers, assignments };
  }
}
