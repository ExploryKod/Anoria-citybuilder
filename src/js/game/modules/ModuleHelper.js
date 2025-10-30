/**
 * ModuleHelper - Helper utilities for using modules with existing Anoria code
 * Non-invasive: can be used alongside existing logic without refactoring everything
 */

import { RoadAccessModule } from './RoadAccessModule.js';
import { FoodModule } from './FoodModule.js';

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
 * @returns {Object} { hasFood: boolean, totalFood: number, netFood: number }
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

