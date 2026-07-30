/**
 * ACL Employment — only entry from legacy `src/js/` into the Employment BC.
 *
 * Do not import `contexts/employment/domain/**` from UI or SimServices.
 */

import {
  createEmploymentContext,
  getOrCreateEmploymentContext,
} from '../../composition/createEmploymentContext.js';
import { getAllSectorPriorities, getDefaultEmployees } from '../game/modules/EmployeeHelper.js';
import { synchronizeFactoryWorkerDistribution } from '../../contexts/employment/infrastructure/runtime/synchronizeFactoryWorkerDistribution.js';
import {
  isHouseType,
  isRoadType,
} from '../../contexts/employment/domain/policies/BuildingRolePolicy.js';

export { createEmploymentContext, getOrCreateEmploymentContext };

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
