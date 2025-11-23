/**
 * ModuleHelper - Helper utilities for using modules with existing Anoria code
 * Non-invasive: can be used alongside existing logic without refactoring everything
 */

import { RoadAccessModule } from './RoadAccessModule.js';
import { FoodModule } from './FoodModule.js';
import { TimeManager } from '../utils/TimeManager.js';

/**
 * Creates a road access module for a building
 * Can be attached to building userData or used standalone
 * @param {Object} building - Building object or userData
 * @returns {RoadAccessModule}
 */
export function createRoadAccessModule(building) {
    return new RoadAccessModule(building);
}

/**
 * Gets or creates a road access module for a building
 * Useful for gradually migrating existing code to use modules
 * @param {Object} building - Building object or userData
 * @param {Array} neighbors - Current neighbors array
 * @returns {RoadAccessModule}
 */
export function getOrCreateRoadAccessModule(building, neighbors = []) {
    // If module already exists, return it
    if (building.roadAccess && building.roadAccess instanceof RoadAccessModule) {
        return building.roadAccess;
    }

    // Create new module
    const module = createRoadAccessModule(building);
    
    // Update from neighbors if provided
    if (neighbors && neighbors.length > 0) {
        module.updateFromNeighbors(neighbors);
    }

    // Optionally attach to building for reuse
    if (building.userData) {
        building.userData.roadAccess = module;
    } else {
        building.roadAccess = module;
    }

    return module;
}

/**
 * Helper to check road access using module (standalone function)
 * Non-invasive: can replace inline logic gradually
 * @param {Array} neighbors - Neighbors array
 * @returns {Object} { hasAccess: boolean, roadCount: number }
 */
export function checkRoadAccess(neighbors) {
    const tempBuilding = {};
    const module = createRoadAccessModule(tempBuilding);
    module.checkRoadAccess(neighbors);
    
    return {
        hasAccess: module.value,
        roadCount: module.roadCount
    };
}

/**
 * Creates a food module for a building
 * @param {Object} building - Building object or userData
 * @returns {FoodModule}
 */
export function createFoodModule(building) {
    return new FoodModule(building);
}

/**
 * Helper to check food availability using module (standalone function)
 * Non-invasive: works with IndexedDB stocks as source of truth
 * @param {Object} stocks - Stocks object from IndexedDB (food, wheat, carrot, cabbage)
 * @param {number} population - Current population count
 * @returns {Object} { hasFood: boolean, totalFood: number, netFood: number, meetsFoodGoal: boolean, isInsufficient: boolean }
 */
export function checkFoodAvailability(stocks, population = 0) {
    const tempBuilding = {};
    const module = new FoodModule(tempBuilding);
    module.updateFromStocks(stocks, population);
    
    return {
        hasFood: module.hasFood(),
        totalFood: module.getTotalFood(),
        netFood: module.getNetFood(),
        meetsFoodGoal: module.meetsFoodGoal(),
        isInsufficient: module.isInsufficient()
    };
}

/**
 * Check if a house can evolve to purple (House-Purple)
 * House-Red can evolve to House-Purple when:
 * - All House-Red conditions are met (population > 0, road access)
 * - No one is suffering from hunger (food stocks = population)
 * @param {Object} params - Parameters object
 * @param {Object} params.stocks - Food stocks from IndexedDB
 * @param {number} params.population - Current population
 * @param {string} params.buildingType - Current building type (must be 'House-Red')
 * @param {boolean} params.hasRoadAccess - Whether house has road access
 * @returns {Object} { canEvolve: boolean, reason?: string }
 */
export function canHouseEvolveToPurple({ 
    stocks, 
    population, 
    buildingType, 
    hasRoadAccess 
}) {
    // Check if building type is House-Red
    if (buildingType !== 'House-Red') {
        return { canEvolve: false, reason: 'not_house_red' };
    }
    
    // House-Red condition: must be inhabited (population > 0)
    if (population <= 0) {
        return { canEvolve: false, reason: 'not_inhabited' };
    }
    
    // House-Red condition: must have road access
    if (!hasRoadAccess) {
        return { canEvolve: false, reason: 'no_road_access' };
    }
    
    // Purple evolution condition: no one suffering from hunger (food stocks >= population)
    const { totalFood } = checkFoodAvailability(stocks, population);
    if (totalFood < population) {
        return { canEvolve: false, reason: 'hunger_present' };
    }
    
    return { canEvolve: true };
}

/**
 * Check if a house can evolve to palace (House-2Story)
 * Uses unified time system and food module
 * @param {Object} params - Parameters object
 * @param {Object} params.stocks - Food stocks from IndexedDB
 * @param {number} params.population - Current population
 * @param {string} params.buildingType - Current building type
 * @param {Array<string>} params.firstHouses - Array of basic house types that can evolve
 * @returns {Object} { canEvolve: boolean, reason?: string }
 */
export function canHouseEvolveToPalace({ 
    stocks, 
    population, 
    buildingType, 
    firstHouses
}) {
    // Check if building type is eligible
    if (!firstHouses.includes(buildingType)) {
        return { canEvolve: false, reason: 'not_eligible_house_type' };
    }
    
    // Check food goal using food module
    const { meetsFoodGoal } = checkFoodAvailability(stocks, population);
    if (!meetsFoodGoal) {
        return { canEvolve: false, reason: 'food_goal_not_met' };
    }
    
    return { canEvolve: true };
}

