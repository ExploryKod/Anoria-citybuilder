/**
 * SimModule - Base class for building modules
 * Inspired by simcity-threejs-clone's modular building architecture
 * 
 * Modules provide composable functionality for buildings (power, road access, food, etc.)
 * Each module manages its own state and lifecycle
 */

/**
 * @typedef {Object} City
 * @property {number} size
 * @property {Array<Array>} tiles
 */

export class SimModule {
    /**
     * @type {Object} - Reference to the building/object this module belongs to
     */
    building = null;

    /**
     * @param {Object} building - The building/object this module belongs to
     */
    constructor(building) {
        this.building = building;
    }

    /**
     * Simulates one simulation step for this module
     * Override in subclasses
     * @param {City} city - The city object
     */
    simulate(city) {
        // Implement in subclass
    }

    /**
     * Cleans up this module, disposing of any assets and unlinking any references
     * Override in subclasses
     */
    dispose() {
        // Implement in subclass if needed
        this.building = null;
    }

    /**
     * Returns an HTML representation of this module's state
     * Override in subclasses
     * @returns {string}
     */
    toHTML() {
        return '';
    }
}

