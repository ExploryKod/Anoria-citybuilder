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
import { synchronizeFactoryWorkerDistribution } from '../contexts/employment/infrastructure/runtime/synchronizeFactoryWorkerDistribution.js';
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
  if (buildingType.startsWith('StonePath-')) {
    return false;
  }
  const employees = getDefaultEmployees(buildingType);
  return (employees.worker_need || 0) > 0;
}

/** Monthly redistribution after house pop / workplace changes. */
export async function redistributeCityEmployment() {
  const employment = getOrCreateEmploymentContext();
  await employment.distributeCityWorkers({
    sectorPriorities: employment.getAllSectorPriorities(),
  });
  await synchronizeFactoryWorkerDistribution();
}

/** @param {string} buildingType */
export function getBuildingSector(buildingType) {
  return getBuildingEmploymentSector(buildingType);
}

export function ensureSectorPrioritiesInitialized() {
  getOrCreateEmploymentContext().ensureSectorPrioritiesInitialized();
}

/** @param {number} sector */
export function getSectorPriority(sector) {
  return getOrCreateEmploymentContext().getSectorPriority(sector);
}

export function getAllSectorPriorities() {
  return getOrCreateEmploymentContext().getAllSectorPriorities();
}

export function getMergedSectorPriorities() {
  return getOrCreateEmploymentContext().getMergedSectorPriorities();
}

export function updateSectorPrioritySync(sector, newPriority) {
  getOrCreateEmploymentContext().updateSectorPrioritySync(sector, newPriority);
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
