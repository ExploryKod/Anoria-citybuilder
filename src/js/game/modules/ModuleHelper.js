/**
 * ModuleHelper - Helper utilities for using modules with existing Anoria code
 * Non-invasive: can be used alongside existing logic without refactoring everything
 */

import { FoodModule } from './FoodModule.js';

/**
 * Creates a food module for a building
 * @param {Object} building - Building object or userData
 * @returns {FoodModule}
 */
export function createFoodModule(building) {
    return new FoodModule(building);
}
