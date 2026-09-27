import {
  BUILDING_EMPLOYEE_NEEDS,
  getBuildingEmploymentSector,
} from '../catalogs/EmploymentSectorCatalog.js';

/**
 * @param {string} buildingType
 * @returns {object}
 */
export function getDefaultEmployees(buildingType) {
  const sector = getBuildingEmploymentSector(buildingType);
  const needs = BUILDING_EMPLOYEE_NEEDS[buildingType] || { worker_need: 0 };
  const salary = (needs.worker_need || 0) * 10;
  const type = buildingType ? buildingType.toLowerCase() : '';

  if (sector === 0 || type.includes('house')) {
    return {
      worker_need: 0,
      worker: 0,
      sector: 0,
      salary: 0,
    };
  }

  return {
    worker_need: needs.worker_need || 0,
    worker: 0,
    sector,
    salary,
  };
}

/**
 * @param {object | null | undefined} employees
 * @param {number} [workerSalary=10]
 * @returns {number}
 */
export function calculateSalary(employees, workerSalary = 10) {
  if (!employees) return 0;
  return (employees.worker || 0) * workerSalary;
}

/**
 * @param {object | null | undefined} employees
 * @param {number} [workerSalary=10]
 * @returns {object | null}
 */
export function updateEmployeeSalary(employees, workerSalary = 10) {
  if (!employees) return null;
  return {
    ...employees,
    salary: calculateSalary(employees, workerSalary),
  };
}
