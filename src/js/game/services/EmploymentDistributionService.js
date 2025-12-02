import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { TimeManager } from '../utils/TimeManager.js';
import config from '../config.js';

/**
 * EmploymentDistributionService - Manages city-wide employment distribution
 * 
 * House → Building logic:
 * 1. Houses provide available workers (population)
 * 2. Buildings receive workers based on priority and needs
 * 3. Distribution happens each simulation tick (monthly redistribution)
 * 
 * Simple first version: workers only, priority-based distribution
 * Future: elites, distance-based, traceability
 * 
 * Works with IndexedDB as source of truth - all reads/writes go through housesStore
 */
export class EmploymentDistributionService extends SimService {
    
    /**
     * Processes employment distribution city-wide
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        try {
            const timeInfo = TimeManager.getTimeInfo(time);
            
            console.log('[EmploymentDistributionService] Starting employment distribution:', {
                time,
                month: timeInfo.month,
                year: timeInfo.year
            });

            // Step 1: Reset all building workers (fresh distribution each tick)
            await this.resetAllWorkers(housesStore);

            // Step 2: Calculate total available workers from houses
            const availableWorkers = await this.calculateAvailableWorkers(housesStore);
            
            if (availableWorkers === 0) {
                console.log('[EmploymentDistributionService] No workers available');
                return;
            }

            // Step 3: Get buildings that need workers (sorted by priority)
            const buildingsNeedingWorkers = await this.getBuildingsNeedingWorkers(housesStore);
            
            if (buildingsNeedingWorkers.length === 0) {
                console.log('[EmploymentDistributionService] No buildings need workers');
                return;
            }

            // Step 4: Distribute workers to buildings
            await this.distributeWorkers(
                availableWorkers,
                buildingsNeedingWorkers,
                housesStore,
                time
            );

        } catch (error) {
            console.error('[EmploymentDistributionService] Error processing employment distribution:', {
                error: error?.message || error,
                time,
                stack: error?.stack
            });
        }
    }

    /**
     * Resets all building workers to 0 before redistribution
     * This ensures fresh allocation each tick based on current population
     * 
     * @param {HousesStore} housesStore
     * @returns {Promise<void>}
     */
    async resetAllWorkers(housesStore) {
        const allBuildings = await housesStore.listAllHouses();
        
        for (const building of allBuildings) {
            // Skip houses and roads - they don't employ workers
            if (this.isHouse(building) || this.isRoad(building)) continue;
            
            const buildingId = building.id || building.name;
            const currentEmployees = building.employees || {};
            
            // Only reset if building has worker_need defined
            if (currentEmployees.worker_need > 0) {
                const resetEmployees = {
                    ...currentEmployees,
                    worker: 0
                };
                
                await housesStore.updateHouseFields(buildingId, { 
                    employees: resetEmployees 
                }).catch(err => {
                    console.warn('[EmploymentDistributionService] Failed to reset workers:', {
                        buildingId,
                        error: err?.message || err
                    });
                });
            }
        }
    }

    /**
     * Calculates total available workers from all houses
     * Workers = population from houses with road access
     * 
     * Simple version: all population are potential workers
     * Future: filter by age (16-65), subtract elites, etc.
     * 
     * @param {HousesStore} housesStore
     * @returns {Promise<number>} Total available workers
     */
    async calculateAvailableWorkers(housesStore) {
        const allBuildings = await housesStore.listAllHouses();
        let totalWorkers = 0;
        
        for (const building of allBuildings) {
            // Only houses provide workers
            if (!this.isHouse(building)) continue;
            
            // Check road access (required to send workers)
            const neighbors = building.neighbors || [];
            const { hasAccess } = checkRoadAccess(neighbors);
            
            if (!hasAccess) {
                console.log('[EmploymentDistributionService] House has no road access, skipping:', {
                    houseId: building.id || building.name
                });
                continue;
            }
            
            // Add population as available workers
            const population = building.pop || 0;
            totalWorkers += population;
        }
        
        console.log('[EmploymentDistributionService] Total available workers:', totalWorkers);
        return totalWorkers;
    }

    /**
     * Gets all buildings that need workers, sorted by priority
     * 
     * @param {HousesStore} housesStore
     * @returns {Promise<Array>} Buildings needing workers, sorted by priority (highest first)
     */
    async getBuildingsNeedingWorkers(housesStore) {
        const allBuildings = await housesStore.listAllHouses();
        const buildingsNeedingWorkers = [];
        
        for (const building of allBuildings) {
            // Skip houses and roads
            if (this.isHouse(building) || this.isRoad(building)) continue;
            
            // Check road access (required to receive workers)
            const neighbors = building.neighbors || [];
            const { hasAccess } = checkRoadAccess(neighbors);
            
            if (!hasAccess) {
                console.log('[EmploymentDistributionService] Building has no road access, skipping:', {
                    buildingId: building.id || building.name,
                    buildingType: building.type
                });
                continue;
            }
            
            // Check if building needs workers
            const employees = building.employees || { worker: 0, worker_need: 0 };
            const workerNeed = employees.worker_need || 0;
            const currentWorkers = employees.worker || 0;
            const deficit = workerNeed - currentWorkers;
            
            if (deficit > 0) {
                buildingsNeedingWorkers.push({
                    id: building.id || building.name,
                    type: building.type,
                    x: building.x,
                    y: building.y,
                    workerDeficit: deficit,
                    workerNeed: workerNeed,
                    priority: this.getBuildingPriority(building.type),
                    employees: employees
                });
            }
        }
        
        // Sort by priority (higher priority number = higher priority = first in line)
        buildingsNeedingWorkers.sort((a, b) => b.priority - a.priority);
        
        console.log('[EmploymentDistributionService] Buildings needing workers:', {
            count: buildingsNeedingWorkers.length,
            buildings: buildingsNeedingWorkers.map(b => ({
                id: b.id,
                type: b.type,
                deficit: b.workerDeficit,
                priority: b.priority
            }))
        });
        
        return buildingsNeedingWorkers;
    }

    /**
     * Distributes available workers to buildings based on priority
     * Higher priority buildings get workers first
     * 
     * @param {number} availableWorkers - Total workers available
     * @param {Array} buildings - Buildings needing workers (sorted by priority)
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time
     * @returns {Promise<void>}
     */
    async distributeWorkers(availableWorkers, buildings, housesStore, time) {
        let remainingWorkers = availableWorkers;
        let totalDistributed = 0;
        
        console.log('[EmploymentDistributionService] Starting worker distribution:', {
            availableWorkers,
            buildingsToFill: buildings.length
        });

        for (const building of buildings) {
            // Stop if no workers left
            if (remainingWorkers <= 0) {
                console.log('[EmploymentDistributionService] No more workers available');
                break;
            }
            
            // Calculate how many workers to assign (up to the deficit)
            const workersToAssign = Math.min(remainingWorkers, building.workerDeficit);
            
            if (workersToAssign > 0) {
                // Get fresh building data from IndexedDB
                const freshData = await housesStore.getHouse(building.id);
                if (!freshData) {
                    console.warn('[EmploymentDistributionService] Building not found:', building.id);
                    continue;
                }
                
                // Update employees object
                const currentEmployees = freshData.employees || { worker: 0, worker_need: 0 };
                const newEmployees = {
                    ...currentEmployees,
                    worker: (currentEmployees.worker || 0) + workersToAssign
                };
                
                // Save to IndexedDB
                await housesStore.updateHouseFields(building.id, { 
                    employees: newEmployees 
                }).catch(err => {
                    console.warn('[EmploymentDistributionService] Failed to assign workers:', {
                        buildingId: building.id,
                        error: err?.message || err
                    });
                });
                
                remainingWorkers -= workersToAssign;
                totalDistributed += workersToAssign;
                
                console.log('[EmploymentDistributionService] Assigned workers to building:', {
                    buildingId: building.id,
                    buildingType: building.type,
                    priority: building.priority,
                    workersAssigned: workersToAssign,
                    newWorkerCount: newEmployees.worker,
                    workerNeed: newEmployees.worker_need,
                    remainingWorkers
                });
            }
        }
        
        console.log('[EmploymentDistributionService] Distribution complete:', {
            totalDistributed,
            unemployedWorkers: remainingWorkers,
            buildingsFullyStaffed: buildings.filter(b => b.workerDeficit <= totalDistributed).length
        });
    }

    /**
     * Gets building priority from config
     * Higher number = higher priority = gets workers first
     * 
     * @param {string} buildingType - Building type (e.g., 'Farm-Wheat', 'Market-Stall')
     * @returns {number} Priority value (1-6, higher is better)
     */
    getBuildingPriority(buildingType) {
        const sectorMap = config?.employment?.buildingSectorMap || {};
        const priorities = config?.employment?.defaultPriorities || {};
        
        // Get sector for this building type
        const sector = sectorMap[buildingType];
        
        if (!sector) {
            console.log('[EmploymentDistributionService] Unknown building type, using default priority:', {
                buildingType,
                defaultPriority: 1
            });
            return 1;
        }
        
        // Get priority for this sector
        const priority = priorities[sector] || 1;
        return priority;
    }

    /**
     * Helper: Check if building is a house (provides workers)
     * @param {Object} building
     * @returns {boolean}
     */
    isHouse(building) {
        const type = building.type || '';
        return type.includes('House') || type.includes('house');
    }

    /**
     * Helper: Check if building is a road (no employment)
     * @param {Object} building
     * @returns {boolean}
     */
    isRoad(building) {
        const type = building.type || '';
        return type === 'roads' || type.includes('Road');
    }
}

