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
import { residentialGroupForType } from '../../domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import {
  allWorkplaceEmploymentSkills,
  getRequiredSkillForBuilding,
  residentialGroupForSkill,
} from '../../domain/policies/WorkplaceSkillRequirementPolicy.js';

/**
 * Command: monthly city-wide worker redistribution.
 *
 * Skill-based recruitment: each pass staffs workplaces that require a given
 * skill using citizens from the matching social group (via injected Housing port).
 */
export class DistributeCityWorkers {
  /**
   * @param {import('../ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} employmentBuildingRepository
   * @param {object} [deps]
   * @param {(house: { type?: string, level?: number }, skillKey: string) => boolean} [deps.citizenProvidesSkill]
   */
  constructor(employmentBuildingRepository, deps = {}) {
    this.employmentBuildingRepository = employmentBuildingRepository;
    this.citizenProvidesSkill = deps.citizenProvidesSkill ?? (() => false);
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
      (b) => isEligibleWorkplace(b),
    );

    const workerCountById = new Map(workplaces.map((w) => [w.id, 0]));
    const allAssignments = [];
    let totalAvailableWorkers = 0;

    for (const skillKey of allWorkplaceEmploymentSkills()) {
      const group = residentialGroupForSkill(skillKey);
      if (!group) continue;

      const skillWorkers = laborSources
        .filter((building) => {
          if (!isLaborSource(building) || !hasRoadAccess(building)) return false;
          if (residentialGroupForType(building.type) !== group) return false;
          return this.citizenProvidesSkill(building, skillKey);
        })
        .reduce((sum, building) => sum + workerPopFromHouse(building.type, building.pop, building.level), 0);

      totalAvailableWorkers += skillWorkers;
      if (skillWorkers <= 0) continue;

      const skillWorkplaces = workplaces
        .filter((workplace) => getRequiredSkillForBuilding(workplace.type) === skillKey)
        .map((workplace) => ({ ...workplace, worker: workerCountById.get(workplace.id) ?? 0 }));

      if (skillWorkplaces.length === 0) continue;

      const ordered = orderWorkplacesByPriority(skillWorkplaces, sectorPriorities);
      const { assignments } = allocateWorkers(skillWorkers, ordered);

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
