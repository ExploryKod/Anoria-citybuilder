/**
 * Pure read-model helpers for building worker counts (Dexie `employees` row).
 *
 * @typedef {object} BuildingEmployeesSnapshot
 * @property {number} [worker]
 * @property {number} [worker_need]
 */

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {BuildingEmployeesSnapshot}
 */
export function normalizeBuildingEmployees(employees) {
  return employees || { worker: 0, worker_need: 0 };
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {number}
 */
export function getWorkerDeficit(employees) {
  const snapshot = normalizeBuildingEmployees(employees);
  const need = snapshot.worker_need || 0;
  const have = snapshot.worker || 0;
  return Math.max(0, need - have);
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {boolean}
 */
export function needsWorkers(employees) {
  return getWorkerDeficit(employees) > 0;
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {boolean}
 */
export function isFullyStaffed(employees) {
  return getWorkerDeficit(employees) === 0;
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {number}
 */
export function getEmploymentRate(employees) {
  const snapshot = normalizeBuildingEmployees(employees);
  const need = snapshot.worker_need || 0;
  if (need === 0) return 100;
  const have = snapshot.worker || 0;
  return Math.min(100, Math.round((have / need) * 100));
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {boolean}
 */
export function hasWorkers(employees) {
  const snapshot = normalizeBuildingEmployees(employees);
  return (snapshot.worker || 0) > 0;
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {number}
 */
export function getWorkerCount(employees) {
  const snapshot = normalizeBuildingEmployees(employees);
  return snapshot.worker || 0;
}

/**
 * @param {BuildingEmployeesSnapshot | null | undefined} employees
 * @returns {number}
 */
export function getWorkerNeed(employees) {
  const snapshot = normalizeBuildingEmployees(employees);
  return snapshot.worker_need || 0;
}
