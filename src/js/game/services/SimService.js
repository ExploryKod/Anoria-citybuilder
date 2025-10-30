/**
 * SimService - Base class for city-wide simulation services
 * Inspired by simcity-threejs-clone's service architecture
 * 
 * Services process city-wide logic that affects multiple buildings
 * Unlike modules (which belong to individual buildingsかれ),
 * services operate at the city level before individual building simulation
 * 
 * Services work with IndexedDB (housesStore) as the source of truth
 */

/**
 * @typedef {Object} HousesStore
 * @property {Function} listAllHouses
 * @property {Function} getHouse
 * @property {Function} updateHouseFields
 */

/**
 * @typedef {Object} City
 * @property {number} size
 * @property {Array<Array>} tiles
 */

export class SimService {
    /**
     * Called each simulation step to process city-wide logic
     * Override in subclasses
     * 
     * @param {City} city - The city object (for tile access if needed)
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        // Implement in subclass
    }

    /**
     * Called once during service initialization
     * Override if needed for setup
     * 
     * @param {City} city - The city object
     * @param {HousesStore} housesStore - Database store
     */
    initialize(city, housesStore) {
        // Optional: implement in subclass
    }

    /**
     * Called when service should clean up resources
     * Override if needed for cleanup
     */
    dispose() {
        // Optional: implement in subclass
    }
}

