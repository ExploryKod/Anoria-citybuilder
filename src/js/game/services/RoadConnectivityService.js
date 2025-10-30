import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';

/**
 * RoadConnectivityService - Validates and updates road access city-wide
 * 
 * This service runs before individual building simulation to ensure
 * all buildings have accurate road access information in the database.
 * 
 * Reads from IndexedDB (housesStore), processes connectivity,
 * and updates road counts back to database.
 */
export class RoadConnectivityService extends SimService {
    /**
     * Last update time (for throttling if needed)
     * @type {number}
     */
    lastUpdateTime = 0;

    /**
     * Whether to update road counts on every simulation step
     * Set to false to only update when buildings are placed/removed
     * @type {boolean}
     */
    updateEveryStep = true;

    /**
     * Processes city-wide road connectivity
     * Updates road counts in IndexedDB for all buildings
     * 
     * @param {City} city - City object (for tile access if needed)
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        // Optionally throttle updates (update every N steps)
        // if (!this.updateEveryStep && time % 2 !== 0) return;

        try {
            // Get all buildings from IndexedDB (source of truth)
            const houses = await housesStore.listAllHouses();
            
            // Batch updates for efficiency
            const updatePromises = [];

            for (const house of houses) {
                // Skip if building doesn't need road access (roads themselves, etc.)
                const buildingType = house.type || '';
                if (buildingType.includes('roads') || buildingType.includes('Road')) {
                    continue; // Roads don't need road access
                }

                // Get neighbors from database
                const neighbors = house.neighbors || [];
                
                // Calculate road access using module helper (centralized logic)
                const { roadCount } = checkRoadAccess(neighbors);
                
                // Only update if road count changed (efficiency optimization)
                const currentRoadCount = house.roads || 0;
                if (roadCount !== currentRoadCount) {
                    updatePromises.push(
                        housesStore.updateHouseFields(house.id || house.name, { roads: roadCount })
                            .catch(err => {
                                console.warn('[RoadConnectivityService] Failed to update road count for building', {
                                    buildingId: house.id || house.name,
                                    error: err?.message || err
                                });
                            })
                    );
                }
            }

            // Wait for all updates to complete
            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
            }

            this.lastUpdateTime = time;
        } catch (error) {
            console.error('[RoadConnectivityService] Error processing road connectivity:', {
                error: error?.message || error,
                time,
                stack: error?.stack
            });
        }
    }

    /**
     * Force update road connectivity for a specific building
     * Useful when a building is placed/removed to immediately update
     * 
     * @param {HousesStore} housesStore - Database store
     * @param {string} buildingId - Building ID to update
     * @returns {Promise<void>}
     */
    async updateBuilding(housesStore, buildingId) {
        try {
            const house = await housesStore.getHouse(buildingId);
            if (!house) return;

            const buildingType = house.type || '';
            if (buildingType.includes('roads') || buildingType.includes('Road')) {
                return; // Roads don't need road access
            }

            const neighbors = house.neighbors || [];
            const { roadCount } = checkRoadAccess(neighbors);
            
            const currentRoadCount = house.roads || 0;
            if (roadCount !== currentRoadCount) {
                await housesStore.updateHouseFields(buildingId, { roads: roadCount });
            }
        } catch (error) {
            console.error('[RoadConnectivityService] Error updating building:', {
                buildingId,
                error: error?.message || error
            });
        }
    }
}

