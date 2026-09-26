/**
 * Employment ops used by composition orchestration (not a presentation façade).
 */

import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import {
  getDefaultEmployees,
} from '../contexts/employment/domain/policies/BuildingEmploymentDefaults.js';
import {
  isHouseType,
  isRoadType,
} from '../contexts/employment/domain/policies/BuildingRolePolicy.js';
import { getBuildingEmploymentSector } from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';

/**
 * @param {string | null | undefined} buildingType
 * @returns {boolean}
 */
export function isEmploymentWorkplaceType(buildingType) {
  if (!buildingType || isHouseType(buildingType) || isRoadType(buildingType)) {
    return false;
  }
  const employees = getDefaultEmployees(buildingType);
  return (employees.worker_need || 0) > 0;
}

/** Monthly redistribution after house pop / workplace changes. */
export async function redistributeCityEmployment() {
  const employment = getOrCreateEmploymentContext();
  await employment.distributeCityWorkers({
    skillPriorities: employment.getAllSkillPriorities(),
  });
}

/** @param {string} buildingType */
export function getBuildingSector(buildingType) {
  return getBuildingEmploymentSector(buildingType);
}

export function getPriorityTabs() {
  return getOrCreateEmploymentContext().getPriorityTabs();
}

/** @param {string} skillId */
export function getSkillPriority(skillId) {
  return getOrCreateEmploymentContext().getSkillPriority(skillId);
}

/** @param {string} tabId */
export function getMergedTabPriorities(tabId) {
  return getOrCreateEmploymentContext().getMergedTabPriorities(tabId);
}

export function getAllSkillPriorities() {
  return getOrCreateEmploymentContext().getAllSkillPriorities();
}

export function updateSkillPrioritySync(skillId, newPriority) {
  getOrCreateEmploymentContext().updateSkillPrioritySync(skillId, newPriority);
}

/** @param {number} sector */
export function getSectorName(sector) {
  return getOrCreateEmploymentContext().getSectorName(sector);
}

export async function getCityEmploymentSummary() {
  return getOrCreateEmploymentContext().getCityEmploymentSummary();
}

/**
 * @param {string} instanceId
 * @param {string} buildingType
 */
export async function ensureBuildingEmployeesSchema(instanceId, buildingType) {
  return getOrCreateConstructionContext().ensureBuildingEmployeesSchema(instanceId, buildingType);
}

export {
  getDefaultEmployees,
  calculateSalary,
  updateEmployeeSalary,
} from '../contexts/employment/domain/policies/BuildingEmploymentDefaults.js';

export {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
  getBuildingEmploymentSector,
} from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';

export {
  createEmploymentContext,
  getOrCreateEmploymentContext,
  resetEmploymentContextForTests,
} from './createEmploymentContext.js';
