/**
 * ACL Employment — only entry from legacy `src/js/` into the Employment BC.
 *
 * Do not import `contexts/employment/domain/**` from UI or SimServices.
 */

import {
  createEmploymentContext,
  getOrCreateEmploymentContext,
} from '../../composition/createEmploymentContext.js';
import {
  getDefaultEmployees,
  calculateSalary,
  updateEmployeeSalary,
} from '../../contexts/employment/domain/policies/BuildingEmploymentDefaults.js';
import { getBuildingEmploymentSector } from '../../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
} from '../../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import { synchronizeFactoryWorkerDistribution } from '../../contexts/employment/infrastructure/runtime/synchronizeFactoryWorkerDistribution.js';
import {
  getBuildingById,
  updateBuildingFields,
} from './construction.js';
import {
  isHouseType,
  isRoadType,
} from '../../contexts/employment/domain/policies/BuildingRolePolicy.js';

export { createEmploymentContext, getOrCreateEmploymentContext };

export {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
  getBuildingEmploymentSector,
};

export {
  getDefaultEmployees,
  calculateSalary,
  updateEmployeeSalary,
};

/** @param {string} buildingType */
export function getBuildingSector(buildingType) {
  return getBuildingEmploymentSector(buildingType);
}

/** Ensure localStorage has default sector priorities on first run. */
export function ensureSectorPrioritiesInitialized() {
  getOrCreateEmploymentContext().ensureSectorPrioritiesInitialized();
}

/** @param {number} sector */
export function getSectorPriority(sector) {
  return getOrCreateEmploymentContext().getSectorPriority(sector);
}

/** Raw map for worker redistribution (localStorage or defaults). */
export function getAllSectorPriorities() {
  return getOrCreateEmploymentContext().getAllSectorPriorities();
}

/** Merged map for UI display (every sector). */
export function getMergedSectorPriorities() {
  return getOrCreateEmploymentContext().getMergedSectorPriorities();
}

/** Caesar 3-style priority swap (localStorage only). */
export function updateSectorPrioritySync(sector, newPriority) {
  getOrCreateEmploymentContext().updateSectorPrioritySync(sector, newPriority);
}

/** @param {number} sector */
export function getSectorName(sector) {
  return getOrCreateEmploymentContext().getSectorName(sector);
}

/** Single employment read model for UI (status bar, work-section, commerce checks). */
export async function getCityEmploymentSummary() {
  const employment = getOrCreateEmploymentContext();
  return employment.getCityEmploymentSummary();
}

/** Monthly redistribution: after house pop evolution, assign workers then sync factory distribution. */
export async function redistributeCityEmployment() {
  const employment = getOrCreateEmploymentContext();
  await employment.distributeCityWorkers({
    sectorPriorities: getAllSectorPriorities(),
  });
  await synchronizeFactoryWorkerDistribution();
}

/**
 * Whether a building type is an employment workplace (non-house, non-road, worker_need > 0).
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

/**
 * After placement/demolition: redistribute if workplace changed, then refresh UI.
 * @param {{ refreshEmploymentPresentation: (city: object) => Promise<void> }} scene
 * @param {object} city
 * @param {string | null | undefined} buildingType
 */
export async function syncEmploymentAfterBuildingChange(scene, city, buildingType) {
  if (isEmploymentWorkplaceType(buildingType)) {
    await redistributeCityEmployment();
  }
  await scene.refreshEmploymentPresentation(city);
}

/**
 * Idempotent legacy schema migration for `employees` on existing rows.
 * @param {string} instanceId
 * @param {string} buildingType
 */
export async function ensureBuildingEmployeesSchema(instanceId, buildingType) {
  const buildingData = await getBuildingById(instanceId);
  if (!buildingData) return;

  if (!buildingData.employees) {
    await updateBuildingFields(instanceId, {
      employees: getDefaultEmployees(buildingType),
    });
    return;
  }

  const employees = buildingData.employees;
  const needsUpdate =
    employees.category !== undefined ||
    employees.worker_need === undefined ||
    employees.elite_need === undefined;

  if (!needsUpdate) return;

  const defaultEmployees = getDefaultEmployees(buildingType);
  await updateBuildingFields(instanceId, {
    employees: {
      priority:
        employees.priority !== undefined ? employees.priority : defaultEmployees.priority,
      worker_need: defaultEmployees.worker_need,
      elite_need: defaultEmployees.elite_need,
      worker: employees.worker || 0,
      elite: employees.elite || 0,
      sector:
        employees.category !== undefined
          ? employees.category
          : employees.sector || defaultEmployees.sector,
      salary: employees.salary || 0,
    },
  });
}
