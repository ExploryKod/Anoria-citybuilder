/**
 * @deprecated Use acl/employment.js — thin re-export for legacy imports.
 */
export {
  getBuildingSector,
  getDefaultEmployees,
  calculateSalary,
  updateEmployeeSalary,
} from '../../acl/employment.js';

/** @deprecated kept for test compatibility — key lives in Employment BC repository */
export const PRIORITIES_STORAGE_KEY = 'employment_priorities';
