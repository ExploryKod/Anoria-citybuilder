/**
 * SimService - Base class for city-wide simulation services
 * Inspired by simcity-threejs-clone's service architecture
 *
 * Services process city-wide logic via BC ACLs (not HousesStore directly).
 */

/**
 * @typedef {Object} City
 * @property {number} size
 * @property {Array<Array>} tiles
 */

export class SimService {
  /**
   * @param {City} city
   * @param {number} [time=0]
   * @returns {Promise<void>}
   */
  async simulate(city, time = 0) {
    // Implement in subclass
  }

  /**
   * @param {City} city
   */
  initialize(city) {
    // Optional: implement in subclass
  }
}
