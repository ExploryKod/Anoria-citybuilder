import { DexieEmploymentBuildingRepository } from '../contexts/employment/infrastructure/dexie/DexieEmploymentBuildingRepository.js';
import { DistributeCityWorkers } from '../contexts/employment/application/commands/DistributeCityWorkers.js';
import { GetCityEmploymentSummary } from '../contexts/employment/application/queries/GetCityEmploymentSummary.js';
import { DexieHamletSkillPriorityRepository } from '../contexts/employment/infrastructure/dexie/DexieHamletSkillPriorityRepository.js';
import {
  mergeTabPriorities,
  resolveSkillPriorityValue,
  swapSkillPriority,
} from '../contexts/employment/domain/policies/SkillPriorityPolicy.js';
import { getEmploymentSectorName } from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import {
  allPriorityTabs,
  allSocialGroups,
  groupsProvidingSkill,
  skillsForTab,
  tabForSkill,
  SHARED_SKILL_TAB_ID,
} from '../contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';
import {
  getRequiredSkillForBuilding,
  getRequiredSkillLevelForBuilding,
} from '../contexts/employment/domain/policies/WorkplaceSkillRequirementPolicy.js';

/**
 * Composition root — Employment bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/employment/application/ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} [deps.employmentBuildingRepository]
 * @param {(house: { type?: string, level?: number }, skillKey: string, requiredLevel: number) => boolean} [deps.citizenProvidesSkillAtLevel]
 * @param {{ preload: (hamletId: string) => Promise<void>, loadUserPriorities: () => Record<string, number>, saveUserPriorities: (priorities: Record<string, number>) => void }} [deps.skillPriorityRepository]
 */
export function createEmploymentContext({ employmentBuildingRepository, citizenProvidesSkillAtLevel, skillPriorityRepository: injectedSkillPriorityRepository } = {}) {
  const employmentBuildingRepositoryImpl =
    employmentBuildingRepository ?? new DexieEmploymentBuildingRepository();
  const skillPriorityRepository = injectedSkillPriorityRepository ?? new DexieHamletSkillPriorityRepository();
  const distributeCityWorkersCommand = new DistributeCityWorkers(
    employmentBuildingRepositoryImpl,
    { citizenProvidesSkillAtLevel },
  );
  const getCityEmploymentSummaryQuery = new GetCityEmploymentSummary(
    employmentBuildingRepositoryImpl
  );
  /** The reading of the last worker distribution, kept for the wage settlement and the wages panel (a reading, not a store: the next pass replaces it). */
  let lastLabourMarket = null;

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

    /**
     * The skill priorities of a hamlet, read into memory: the player sets them hamlet by hamlet, so this runs when a hamlet becomes the active one
     * (boot, travel) before anything asks for them.
     * @param {string} hamletId
     */
    async loadSkillPriorities(hamletId) {
      await skillPriorityRepository.preload(hamletId);
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
     * The social groups that can staff a workplace, and from which house tier, read from the catalog: the
     * building's required skill (and level) against what each group's tiers grant. `groups` is empty for a
     * building that needs no skill; `openToAll` says every social group can staff it. Labels are presentation's job.
     * @param {string} buildingType
     * @returns {{ groups: Array<{ group: string, tier: number }>, openToAll: boolean }}
     */
    getStaffingGroups(buildingType) {
      const skillId = getRequiredSkillForBuilding(buildingType);
      const groups = skillId ? [...groupsProvidingSkill(skillId, getRequiredSkillLevelForBuilding(buildingType))] : [];
      return { groups, openToAll: groups.length > 0 && groups.length === allSocialGroups().length };
    },

    /**
     * @param {{ skillPriorities?: Record<string, number> }} [params]
     */
    async distributeCityWorkers(params = {}) {
      const result = await distributeCityWorkersCommand.execute(params);
      lastLabourMarket = { rows: result.labourMarket };
      if (import.meta.env?.DEV) {
        const { readMs, computeMs, writeMs, laborSources, workplaces, savedWorkplaces } = result.timings;
        console.info(
          `[tick-perf] employment.distribute read=${readMs.toFixed(1)}ms compute=${computeMs.toFixed(1)}ms write=${writeMs.toFixed(1)}ms`
            + ` houses=${laborSources} workplaces=${workplaces} saved=${savedWorkplaces}`,
        );
      }
      return result;
    },

    /**
     * The labour market the last worker distribution left: for each (skill, level) the workplaces ask for, the jobs, the ones filled, the
     * vacancies and the qualified citizens still idle. Null until a distribution has run (nothing is guessed before).
     * @returns {{ rows: Array<{ skill: string, level: number, jobs: number, filled: number, vacancies: number, idle: number }> } | null}
     */
    getLabourMarket() {
      return lastLabourMarket;
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
