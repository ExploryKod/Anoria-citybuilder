/**
 * Default employee schema per building type (legacy config bridge).
 * Priority is managed separately via Employment BC / acl/employment.js.
 */
import config from '../config.js';

/**
 * @param {string} buildingType
 * @returns {number}
 */
export function getBuildingSector(buildingType) {
  if (!buildingType) return 0;

  const sectorMap = config.employment?.buildingSectorMap || {};
  if (sectorMap[buildingType]) {
    return sectorMap[buildingType];
  }

  const type = buildingType.toLowerCase();
  if (type.includes('house')) {
    return 0;
  }

  return 0;
}

/**
 * @param {string} buildingType
 * @returns {object}
 */
export function getDefaultEmployees(buildingType) {
  const sector = getBuildingSector(buildingType);
  const buildingNeeds = config.employment?.buildingNeeds || {};

  let needs = buildingNeeds[buildingType] || { worker_need: 0, elite_need: 0 };

  if (buildingType === 'Winery-001') {
    const rawMaterials = ['wood', 'rock', 'clay', 'iron', 'gold'];
    const finishedProducts = ['furniture', 'weapons', 'pottery', 'jewelry'];
    const totalItems = rawMaterials.length + finishedProducts.length;
    const calculatedWorkerNeed = totalItems * 2;

    needs = {
      worker_need: calculatedWorkerNeed,
      elite_need: needs.elite_need || 0,
    };
  }

  const salary = (needs.worker_need || 0) * 10 + (needs.elite_need || 0) * 10;
  const type = buildingType ? buildingType.toLowerCase() : '';

  if (sector === 0 || type.includes('house')) {
    return {
      worker_need: 0,
      elite_need: 0,
      worker: 0,
      elite: 0,
      sector: 0,
      salary: 0,
    };
  }

  return {
    worker_need: needs.worker_need || 0,
    elite_need: needs.elite_need || 0,
    worker: 0,
    elite: 0,
    sector,
    salary,
  };
}

export function calculateSalary(employees, workerSalary = 10, eliteSalary = 10) {
  if (!employees) return 0;
  const workerCost = (employees.worker || 0) * workerSalary;
  const eliteCost = (employees.elite || 0) * eliteSalary;
  return workerCost + eliteCost;
}

export function updateEmployeeSalary(employees, workerSalary = 10, eliteSalary = 10) {
  if (!employees) return null;
  return {
    ...employees,
    salary: calculateSalary(employees, workerSalary, eliteSalary),
  };
}
