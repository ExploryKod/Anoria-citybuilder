/**
 * EmployeeHelper - Manages employee data for buildings
 * 
 * Each building has an employees object stored in IndexedDB with:
 * - sector: number (building sector from config.employment.sectors - STATIC, set at creation)
 * - worker_need: number (number of regular workers needed - set by admin in config)
 * - elite_need: number (number of elite workers needed - set by admin in config)
 * - worker: number (number of regular workers currently assigned)
 * - elite: number (number of elite workers currently assigned)
 * - salary: number (total salary cost per month)
 * 
 * NOTE: Priority is NOT stored in IndexedDB anymore!
 * Priority is managed in localStorage by sector and looked up at runtime.
 * This allows instant priority changes without updating all buildings in IndexedDB.
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
 * Priority is NOT stored here - it's managed in localStorage by sector
 * @param {string} buildingType - Building type ID
 * @returns {Object} Default employees object (without priority)
 */
export function getDefaultEmployees(buildingType) {
    const sector = getBuildingSector(buildingType);
    const buildingNeeds = config.employment?.buildingNeeds || {};
    
    // Get worker_need and elite_need from config
    const needs = buildingNeeds[buildingType] || { worker_need: 0, elite_need: 0 };
    
    // Calculate salary based on needs (assuming 10 per worker/elite)
    const salary = (needs.worker_need || 0) * 10 + (needs.elite_need || 0) * 10;
    
    const type = buildingType ? buildingType.toLowerCase() : '';
    
    // Residential buildings - no employees needed
    if (sector === 0 || type.includes('house')) {
        return {
            worker_need: 0,
            elite_need: 0,
            worker: 0,
            elite: 0,
            sector: 0,
            salary: 0
        };
    }
    
    // Return structure with needs from config
    // NOTE: No priority here - priority is looked up from localStorage at runtime
    return {
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

/**
 * Storage key for employment priorities in localStorage
 */
const PRIORITIES_STORAGE_KEY = 'employment_priorities';

/**
 * Get priority for a sector from localStorage
 * Priority determines hiring order: 1 = first to get workers
 * @param {number} sector - Sector number (1-6)
 * @returns {number} Priority value (1 = highest priority)
 */
export function getSectorPriority(sector) {
    if (!sector || sector === 0) return 99; // Residential/no sector = lowest priority
    
    try {
        const stored = localStorage.getItem(PRIORITIES_STORAGE_KEY);
        if (stored) {
            const priorities = JSON.parse(stored);
            return priorities[sector] !== undefined ? priorities[sector] : getDefaultPriority(sector);
        }
    } catch (err) {
        console.warn('[EmployeeHelper] Error reading priorities from localStorage:', err);
    }
    
    return getDefaultPriority(sector);
}

/**
 * Get default priority for a sector from config
 * @param {number} sector - Sector number
 * @returns {number} Default priority value
 */
function getDefaultPriority(sector) {
    const defaultPriorities = config.employment?.defaultPriorities || {};
    return defaultPriorities[sector] || sector; // Fallback to sector number if not defined
}

/**
 * Get all sector priorities from localStorage (for display/debugging)
 * @returns {Object} Map of sector -> priority
 */
export function getAllSectorPriorities() {
    try {
        const stored = localStorage.getItem(PRIORITIES_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (err) {
        console.warn('[EmployeeHelper] Error reading priorities from localStorage:', err);
    }
    
    // Return defaults from config
    return config.employment?.defaultPriorities || {};
}

/**
 * Get sector name from config
 * @param {number} sector - Sector number (1-6)
 * @returns {string} Sector name (e.g., "Production Alimentaire")
 */
export function getSectorName(sector) {
    if (!sector || sector === 0) return 'Résidentiel';
    
    const sectors = config.employment?.sectors || {};
    return sectors[sector] || `Secteur ${sector}`;
}

