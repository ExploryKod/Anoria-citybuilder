import { SimModule } from './SimModule.js';
import config from '../config.js';

/**
 * RoadAccessModule - Manages road access for buildings
 * Extracts road access logic into a reusable module
 */
export class RoadAccessModule extends SimModule {
    /**
     * Whether the building has road access
     * @type {boolean}
     */
    value = false;

    /**
     * Number of adjacent roads
     * @type {number}
     */
    roadCount = 0;

    /**
     * Neighbors array (will be populated from building data)
     * @type {Array}
     */
    neighbors = [];

    /**
     * Checks if the building has road access based on neighbors
     * @param {Array} neighbors - Array of neighbor objects
     * @returns {boolean}
     */
    checkRoadAccess(neighbors) {
        if (!neighbors || !Array.isArray(neighbors)) {
            return false;
        }

        // Count roads in neighbors using isRoad property (more reliable than name checking)
        this.roadCount = neighbors.filter(neighbor => 
            neighbor.isRoad || neighbor.userData?.isRoad || 
            neighbor.name === 'roads' || neighbor.name === 'Road' || neighbor.buildingId === 'roads'
        ).length;

        this.value = this.roadCount > 0;
        this.neighbors = neighbors;
        return this.value;
    }

    /**
     * Updates road access from database neighbors data
     * @param {Array} neighbors - Neighbors from database/housesStore
     */
    updateFromNeighbors(neighbors) {
        this.checkRoadAccess(neighbors);
    }

    /**
     * Gets road count (useful for display)
     * @returns {number}
     */
    getRoadCount() {
        return this.roadCount;
    }

    /**
     * Returns HTML representation for info panels
     * @returns {string}
     */
    toHTML() {
        return `
            <span class="info-label">Road Access </span>
            <span class="info-value">${this.value ? 'Yes' : 'No'} (${this.roadCount} road${this.roadCount !== 1 ? 's' : ''})</span>
            <br>
        `;
    }

    /**
     * Disposes the module (cleanup if needed)
     */
    dispose() {
        this.neighbors = [];
        super.dispose();
    }
}

