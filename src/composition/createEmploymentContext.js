import { DexieEmploymentBuildingRepository } from '../contexts/employment/infrastructure/dexie/DexieEmploymentBuildingRepository.js';
import { DistributeCityWorkers } from '../contexts/employment/application/commands/DistributeCityWorkers.js';
import { GetCityEmploymentSummary } from '../contexts/employment/application/queries/GetCityEmploymentSummary.js';
import { LocalStorageSkillPriorityRepository } from '../contexts/employment/infrastructure/browser/LocalStorageSkillPriorityRepository.js';
import {
  mergeTabPriorities,
  resolveSkillPriorityValue,
  swapSkillPriority,
} from '../contexts/employment/domain/policies/SkillPriorityPolicy.js';
import { getEmploymentSectorName } from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import {
  allPriorityTabs,
  skillsForTab,
  tabForSkill,
  SHARED_SKILL_TAB_ID,
} from '../contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';

/**
 * Composition root — Employment bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/employment/application/ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} [deps.employmentBuildingRepository]
 * @param {(house: { type?: string, level?: number }, skillKey: string, requiredLevel: number) => boolean} [deps.citizenProvidesSkillAtLevel]
 */
export function createEmploymentContext({ employmentBuildingRepository, citizenProvidesSkillAtLevel } = {}) {
  const employmentBuildingRepositoryImpl =
    employmentBuildingRepository ?? new DexieEmploymentBuildingRepository();
  const skillPriorityRepository = new LocalStorageSkillPriorityRepository();
  const distributeCityWorkersCommand = new DistributeCityWorkers(
    employmentBuildingRepositoryImpl,
    { citizenProvidesSkillAtLevel },
  );
  const getCityEmploymentSummaryQuery = new GetCityEmploymentSummary(
    employmentBuildingRepositoryImpl
  );

  return {
    employmentBuildingRepository: employmentBuildingRepositoryImpl,
    skillPriorityRepository,
    distributeCityWorkersCommand,
    getCityEmploymentSummaryQuery,

    /**
     * Priority-tab structure: one per social group (`allSocialGroups()`,
     * catalog-driven) plus the shared-skill tab — see
     * HouseGroupSectorEligibilityPolicy.js. `kind` ('group' | 'shared') lets
     * presentation branch without importing this context's domain catalog
     * directly (it may only cross into `shared/`, not into another BC's
     * domain layer — see sessionApi.js's own boundary note). No labels here
     * (presentation's job — skill labels come from
     * shared/population/skillCatalog.js, group labels from presentation's
     * own CitizenStatusPresentation.js) and no need/have numbers (that's
     * getCityEmploymentSummary().bySkill).
     * @returns {Array<{ id: string, kind: 'group' | 'shared', skillIds: string[] }>}
     */
    getPriorityTabs() {
      return allPriorityTabs().map((tabId) => ({
        id: tabId,
        kind: tabId === SHARED_SKILL_TAB_ID ? 'shared' : 'group',
        skillIds: [...skillsForTab(tabId)],
      }));
    },

    /** @param {string} skillId */
    getSkillPriority(skillId) {
      const tabSkillIds = skillsForTab(tabForSkill(skillId));
      const userPriorities = skillPriorityRepository.loadUserPriorities();
      return resolveSkillPriorityValue(skillId, userPriorities, tabSkillIds);
    },

    /** @param {string} tabId */
    getMergedTabPriorities(tabId) {
      const userPriorities = skillPriorityRepository.loadUserPriorities();
      return mergeTabPriorities(userPriorities, skillsForTab(tabId));
    },

    /**
     * @param {string} skillId
     * @param {number} newPriority
     */
    updateSkillPrioritySync(skillId, newPriority) {
      const tabSkillIds = skillsForTab(tabForSkill(skillId));
      const userPriorities = skillPriorityRepository.loadUserPriorities();
      const updated = swapSkillPriority(skillId, newPriority, userPriorities, tabSkillIds);
      skillPriorityRepository.saveUserPriorities(updated);
    },

    /**
     * Flat merged map across every tab (skill ids are globally unique, no
     * collision) — what the monthly redistribution actually reads.
     * @returns {Record<string, number>}
     */
    getAllSkillPriorities() {
      const userPriorities = skillPriorityRepository.loadUserPriorities();
      const merged = {};
      for (const tabId of allPriorityTabs()) {
        Object.assign(merged, mergeTabPriorities(userPriorities, skillsForTab(tabId)));
      }
      return merged;
    },

    getSectorName(sector) {
      return getEmploymentSectorName(sector);
    },

    /**
     * @param {{ skillPriorities?: Record<string, number> }} [params]
     */
    async distributeCityWorkers(params = {}) {
      return distributeCityWorkersCommand.execute(params);
    },

    /** @returns {Promise<import('../contexts/employment/domain/computeCityEmploymentSummary.js').ReturnType<typeof import('../contexts/employment/domain/computeCityEmploymentSummary.js').computeCityEmploymentSummary>>} */
    async getCityEmploymentSummary() {
      return getCityEmploymentSummaryQuery.execute();
    },
  };
}

/** @type {ReturnType<typeof createEmploymentContext> | null} */
let sharedEmployment = null;

/**
 * @param {object} [deps]
 * @param {(house: { type?: string, level?: number }, skillKey: string, requiredLevel: number) => boolean} [deps.citizenProvidesSkillAtLevel]
 */
export function getOrCreateEmploymentContext(deps = {}) {
  if (!sharedEmployment) {
    sharedEmployment = createEmploymentContext(deps);
  }
  return sharedEmployment;
}

/** @internal Tests only */
export function resetEmploymentContextForTests() {
  sharedEmployment = null;
}
