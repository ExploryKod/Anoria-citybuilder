/**
 * EmployeeHelper - Manages employee data for buildings
 * 
 * Each building has an employees object with:
 * - priority: number (1 to max sectors, determines hiring priority, unique per sector)
 * - worker_need: number (number of regular workers needed - set by admin in config)
 * - elite_need: number (number of elite workers needed - set by admin in config)
 * - worker: number (number of regular workers currently assigned)
 * - elite: number (number of elite workers currently assigned)
 * - sector: number (building sector from config.employment.sectors)
 * - salary: number (total salary cost per month)
 */

import config from '../config.js';

/**
 * Get building sector based on building type using config
 * @param {string} buildingType - Building type ID
 * @returns {number} Sector number from config, or 0 if not found
 */
export function getBuildingSector(buildingType) {
    if (!buildingType) return 0;
    
    // Check config mapping first
    const sectorMap = config.employment?.buildingSectorMap || {};
    if (sectorMap[buildingType]) {
        return sectorMap[buildingType];
    }
    
    // Fallback: check if it's a house (residential - no sector, but we'll use 0)
    const type = buildingType.toLowerCase();
    if (type.includes('house')) {
        return 0; // Residential buildings don't need employment sector
    }
    
    // Default to 0 if not found
    return 0;
}

/**
 * Get default employee configuration for a building type
 * @param {string} buildingType - Building type ID
 * @returns {Object} Default employees object
 */
export function getDefaultEmployees(buildingType) {
    const sector = getBuildingSector(buildingType);
    const defaultPriorities = config.employment?.defaultPriorities || {};
    const buildingNeeds = config.employment?.buildingNeeds || {};
    
    // Get default priority for this sector
    const defaultPriority = defaultPriorities[sector] || 1;
    
    // Get worker_need and elite_need from config
    const needs = buildingNeeds[buildingType] || { worker_need: 0, elite_need: 0 };
    
    // Calculate salary based on needs (assuming 10 per worker/elite)
    const salary = (needs.worker_need || 0) * 10 + (needs.elite_need || 0) * 10;
    
    const type = buildingType ? buildingType.toLowerCase() : '';
    
    // Residential buildings - no employees needed
    if (sector === 0 || type.includes('house')) {
        return {
            priority: 0,
            worker_need: 0,
            elite_need: 0,
            worker: 0,
            elite: 0,
            sector: 0,
            salary: 0
        };
    }
    
    // Return structure with needs from config
    return {
        priority: defaultPriority,
        worker_need: needs.worker_need || 0,
        elite_need: needs.elite_need || 0,
        worker: 0, // Initially no workers assigned
        elite: 0,  // Initially no elites assigned
        sector: sector,
        salary: salary
    };
}

/**
 * Calculate total salary for employees based on assigned workers
 * @param {Object} employees - Employees object
 * @param {number} workerSalary - Salary per worker (default: 10)
 * @param {number} eliteSalary - Salary per elite (default: 10)
 * @returns {number} Total salary
 */
export function calculateSalary(employees, workerSalary = 10, eliteSalary = 10) {
    if (!employees) return 0;
    
    // Calculate based on assigned workers (not needs)
    const workerCost = (employees.worker || 0) * workerSalary;
    const eliteCost = (employees.elite || 0) * eliteSalary;
    
    return workerCost + eliteCost;
}

/**
 * Update employee salary based on assigned worker and elite counts
 * @param {Object} employees - Employees object to update
 * @param {number} workerSalary - Salary per worker (default: 10)
 * @param {number} eliteSalary - Salary per elite (default: 10)
 * @returns {Object} Updated employees object
 */
export function updateEmployeeSalary(employees, workerSalary = 10, eliteSalary = 10) {
    if (!employees) return null;
    
    return {
        ...employees,
        salary: calculateSalary(employees, workerSalary, eliteSalary)
    };
}

