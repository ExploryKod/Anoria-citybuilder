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
  allWorkplaceEmploymentSkills,
  getRequiredSkillForBuilding,
  getRequiredSkillLevelForBuilding,
} from '../../domain/policies/WorkplaceSkillRequirementPolicy.js';

/**
 * Command: monthly city-wide worker redistribution.
 *
 * Skill-based recruitment: each pass staffs workplaces that require a given
 * skill using citizens whose house actually provides that skill (via
 * injected Housing port) — no assumption that a skill belongs to exactly
 * one social group, since the housing skill catalog can grant the same
 * skill to more than one group.
 *
 * Two kinds of overlap a house's population needs to be shared across
 * (2026-09-10, once a tier could grant more than one workplace-relevant
 * skill at once — see socialCategoryCatalog.js):
 *
 * 1. LEVELS within one skill — e.g. Doctor needs `medical` 1, Hospital
 *    needs `medical` 2. A citizen with a higher level can also do a
 *    lower-level job, so the level-2 pool is a SUBSET of the level-1 pool.
 * 2. DIFFERENT skills held by the same house — e.g. an artisans tier-2
 *    house holds both `fermier` and `artisanat` at once; its population
 *    can staff a farm OR a pottery workshop, never both at the same time.
 *
 * Both reduce to the same rule: a citizen takes at most one job a month.
 * `remainingPopById` is a single shared ledger, one entry per labor
 * source, drained every time ANY allocation (any skill, any level) spends
 * from it — so by the time a later (skill, level) pass reads "how many
 * are still available", houses already tapped by an earlier pass
 * correctly show less, regardless of whether that earlier pass was a
 * higher level of the SAME skill or a wholly different skill. Levels
 * within one skill are still processed highest → lowest so a citizen who
 * qualifies for both gets reserved for the higher-level job first (the
 * ledger alone doesn't know to prefer that — nothing stops a level-1 pass
 * from spending a dual-qualified citizen first if it ran first).
 */
export class DistributeCityWorkers {
  /**
   * @param {import('../ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} employmentBuildingRepository
   * @param {object} [deps]
   * @param {(house: { type?: string, level?: number }, skillKey: string, requiredLevel: number) => boolean} [deps.citizenProvidesSkillAtLevel]
   */
  constructor(employmentBuildingRepository, deps = {}) {
    this.employmentBuildingRepository = employmentBuildingRepository;
    this.citizenProvidesSkillAtLevel = deps.citizenProvidesSkillAtLevel ?? (() => false);
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

    const laborSources = (await this.employmentBuildingRepository.listLaborSources()).filter(
      (building) => isLaborSource(building) && hasRoadAccess(building),
    );
    const workplaces = (await this.employmentBuildingRepository.listWorkplaces()).filter(
      (b) => isEligibleWorkplace(b),
    );

    const remainingPopById = new Map(
      laborSources.map((building) => [
        building.id,
        workerPopFromHouse(building.type, building.pop, building.level),
      ]),
    );

    const qualifyingSources = (skillKey, level) =>
      laborSources.filter((building) => this.citizenProvidesSkillAtLevel(building, skillKey, level));

    const headcountAtLevel = (skillKey, level) =>
      qualifyingSources(skillKey, level).reduce(
        (sum, building) => sum + (remainingPopById.get(building.id) ?? 0),
        0,
      );

    const spendFromQualifyingSources = (skillKey, level, amountNeeded) => {
      let remaining = amountNeeded;
      for (const building of qualifyingSources(skillKey, level)) {
        if (remaining <= 0) break;
        const available = remainingPopById.get(building.id) ?? 0;
        const take = Math.min(available, remaining);
        if (take <= 0) continue;
        remainingPopById.set(building.id, available - take);
        remaining -= take;
      }
    };

    // Total headcount, once, independent of the per-skill loop below: a
    // house counts once here even if it holds several workplace skills at
    // once (see class docstring) — summing per-skill pool sizes instead
    // would double-count that same house once per skill it qualifies for.
    const totalAvailableWorkers = laborSources.reduce(
      (sum, building) => sum + workerPopFromHouse(building.type, building.pop, building.level),
      0,
    );

    const workerCountById = new Map(workplaces.map((w) => [w.id, 0]));
    const allAssignments = [];

    for (const skillKey of allWorkplaceEmploymentSkills()) {
      const skillWorkplaces = workplaces.filter(
        (workplace) => getRequiredSkillForBuilding(workplace.type) === skillKey,
      );
      if (skillWorkplaces.length === 0) continue;

      const levels = [...new Set(skillWorkplaces.map((w) => getRequiredSkillLevelForBuilding(w.type)))].sort(
        (a, b) => b - a,
      );

      for (const level of levels) {
        const availableForLevel = headcountAtLevel(skillKey, level);
        if (availableForLevel <= 0) continue;

        const levelWorkplaces = skillWorkplaces
          .filter((w) => getRequiredSkillLevelForBuilding(w.type) === level)
          .map((w) => ({ ...w, worker: workerCountById.get(w.id) ?? 0 }));

        const ordered = orderWorkplacesByPriority(levelWorkplaces, sectorPriorities);
        const { assignments } = allocateWorkers(availableForLevel, ordered);

        for (const { buildingId, workers } of assignments) {
          workerCountById.set(buildingId, (workerCountById.get(buildingId) ?? 0) + workers);
        }
        allAssignments.push(...assignments);

        const totalSpent = assignments.reduce((sum, { workers }) => sum + workers, 0);
        spendFromQualifyingSources(skillKey, level, totalSpent);
      }
    }

    for (const [buildingId, workers] of workerCountById) {
      if (workers > 0) {
        await this.employmentBuildingRepository.saveWorkers(buildingId, workers);
      }
    }

    return { availableWorkers: totalAvailableWorkers, assignments: allAssignments };
  }
}
