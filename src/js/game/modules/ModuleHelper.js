/**
 * ModuleHelper - Helper utilities for using modules with existing Anoria code
 * Non-invasive: can be used alongside existing logic without refactoring everything
 */

import { FoodModule } from './FoodModule.js';
import { TimeManager } from '../utils/TimeManager.js';

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
 * - Population > 5 (almost full house with 6 max capacity)
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
    
    // Purple evolution condition: population must be > 5 (almost full house)
    if (population <= 5) {
        return { canEvolve: false, reason: 'population_too_low' };
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
 * Only House-Purple can evolve to House-2Story
 * @param {Object} params - Parameters object
 * @param {Object} params.stocks - Food stocks from IndexedDB
 * @param {number} params.population - Current population
 * @param {string} params.buildingType - Current building type (must be 'House-Purple')
 * @param {Array<string>} params.firstHouses - Array of basic house types that can evolve (not used anymore, kept for compatibility)
 * @returns {Object} { canEvolve: boolean, reason?: string }
 */
export function canHouseEvolveToPalace({ 
    stocks, 
    population, 
    buildingType, 
    firstHouses
}) {
    // Check if building type is House-Purple (only Purple can evolve to Palace)
    if (buildingType !== 'House-Purple') {
        return { canEvolve: false, reason: 'not_house_purple' };
    }
    
    // Check food goal using food module
    const { meetsFoodGoal } = checkFoodAvailability(stocks, population);
    if (!meetsFoodGoal) {
        return { canEvolve: false, reason: 'food_goal_not_met' };
    }
    
    // Check that house has at least 2 types of food available
    const foodTypes = {
        wheat: (stocks?.wheat || 0) > 0,
        carrot: (stocks?.carrot || 0) > 0,
        cabbage: (stocks?.cabbage || 0) > 0
    };
    
    const availableFoodTypesCount = Object.values(foodTypes).filter(Boolean).length;
    
    if (availableFoodTypesCount < 2) {
        return { canEvolve: false, reason: 'insufficient_food_variety' };
    }
    
    return { canEvolve: true };
}

