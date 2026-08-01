/**
 * EmployeeHelper - legacy facade for building employee defaults and sector priorities.
 *
 * New code should use acl/employment.js for priorities and employmentBuildingDefaults.js for schema.
 */
export {
  getBuildingSector,
  getDefaultEmployees,
  calculateSalary,
  updateEmployeeSalary,
} from './employmentBuildingDefaults.js';

export {
  getSectorPriority,
  getAllSectorPriorities,
  getSectorName,
} from '../../acl/employment.js';

/** @deprecated kept for test compatibility — key lives in Employment BC repository */
export const PRIORITIES_STORAGE_KEY = 'employment_priorities';
