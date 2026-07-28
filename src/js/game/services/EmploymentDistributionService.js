import { SimService } from './SimService.js';
import { hasRoadAccessFromCount } from '../../acl/urban.js';
import { TimeManager } from '../utils/TimeManager.js';
import { getSectorPriority, getAllSectorPriorities } from '../modules/EmployeeHelper.js';
import config from '../config.js';

/**
 * EmploymentDistributionService - Manages city-wide employment distribution
 * 
 * House → Building logic:
 * 1. Houses provide available workers (population)
 * 2. Buildings receive workers based on priority and needs
 * 3. Distribution happens each simulation tick (monthly redistribution)
 * 
 * Priority System:
 * - Building sector is stored in IndexedDB (static, set at creation)
 * - Priority per sector is stored in localStorage (dynamic, changed by admin)
 * - At distribution time, we look up priority from localStorage based on sector
 * - Lower priority number = higher importance (1 = first to get workers)
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
            
            // Step 1: Reset all building workers (fresh distribution each tick)
            await this.resetAllWorkers(housesStore);

            // Step 2: Calculate total available workers from houses
            const availableWorkers = await this.calculateAvailableWorkers(housesStore);
            
            if (availableWorkers === 0) {
                return;
            }

            // Step 3: Get buildings that need workers (sorted by priority)
            const buildingsNeedingWorkers = await this.getBuildingsNeedingWorkers(housesStore);
            
            if (buildingsNeedingWorkers.length === 0) {
                return;
            }

            // Step 4: Distribute workers to buildings
            await this.distributeWorkers(
                availableWorkers,
                buildingsNeedingWorkers,
                housesStore,
                time
            );

            // Step 5: Synchronize productWorkerDistribution for all factories
            // This ensures productWorkerDistribution doesn't exceed employees.worker
            // even for factories that didn't receive new workers this tick
            await this.synchronizeFactoryWorkerDistribution(housesStore);

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
            const buildingType = building.type || '';
            const currentEmployees = building.employees || {};
            
            // Only reset if building has worker_need defined
            if (currentEmployees.worker_need > 0) {
                // For factories (Winery-001), we need to preserve productWorkerDistribution
                // but reset employees.worker to 0 so it can be redistributed
                // The productWorkerDistribution will be capped to employees.worker after redistribution
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
            
            if (!hasRoadAccessFromCount(building.roads)) {
                continue;
            }
            
            // Add population as available workers
            const population = building.pop || 0;
            totalWorkers += population;
        }
        
        return totalWorkers;
    }

    /**
     * Gets all buildings that need workers, sorted by priority
     * Priority is looked up from localStorage based on building's sector
     * Lower priority number = higher importance (priority 1 is highest)
     * 
     * @param {HousesStore} housesStore
     * @returns {Promise<Array>} Buildings needing workers, sorted by priority (1 first, 6 last)
     */
    async getBuildingsNeedingWorkers(housesStore) {
        const allBuildings = await housesStore.listAllHouses();
        const buildingsNeedingWorkers = [];
        
        // Get current priority mapping from localStorage (read once for all buildings)
        const currentPriorities = getAllSectorPriorities();
        
        for (const building of allBuildings) {
            // Skip houses and roads
            if (this.isHouse(building) || this.isRoad(building)) continue;
            
            if (!hasRoadAccessFromCount(building.roads)) {
                continue;
            }
            
            // Check if building needs workers
            const employees = building.employees || { worker: 0, worker_need: 0 };
            const workerNeed = employees.worker_need || 0;
            const currentWorkers = employees.worker || 0;
            const deficit = workerNeed - currentWorkers;
            
            // Get sector from IndexedDB (static, set at building creation)
            const buildingSector = employees.sector || 0;
            
            // Look up priority from localStorage based on sector (dynamic, set by admin)
            // This allows instant priority changes without updating IndexedDB
            const buildingPriority = getSectorPriority(buildingSector);
            
            if (deficit > 0) {
                buildingsNeedingWorkers.push({
                    id: building.id || building.name,
                    type: building.type,
                    x: building.x,
                    y: building.y,
                    workerDeficit: deficit,
                    workerNeed: workerNeed,
                    priority: buildingPriority, // From localStorage via sector lookup
                    sector: buildingSector,     // From IndexedDB
                    employees: employees
                });
            }
        }
        
        // Sort by priority (lower priority number = higher importance = first in line)
        // Example: Priority 1 gets workers before Priority 6
        // This matches user-set priorities where 1 is most important
        buildingsNeedingWorkers.sort((a, b) => a.priority - b.priority);
        
        return buildingsNeedingWorkers;
    }

    /**
     * Distributes available workers to buildings based on priority
     * Lower priority number = higher importance (priority 1 gets workers first)
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

        for (const building of buildings) {
            // Stop if no workers left
            if (remainingWorkers <= 0) {
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
                
                // Update employees object for all buildings (including factories)
                const currentEmployees = freshData.employees || { worker: 0, worker_need: 0 };
                const newEmployees = {
                    ...currentEmployees,
                    worker: (currentEmployees.worker || 0) + workersToAssign
                };
                
                // For factories (Winery-001), synchronize productWorkerDistribution with employees.worker
                // This ensures productWorkerDistribution doesn't exceed employees.worker
                const buildingType = freshData.type || '';
                const isFactory = buildingType.includes('Winery-001');
                const updates = { employees: newEmployees };
                
                if (isFactory) {
                    const productWorkerDistribution = freshData.productWorkerDistribution || {};
                    const totalDistributedWorkers = Object.values(productWorkerDistribution).reduce(
                        (sum, count) => sum + (count || 0), 0
                    );
                    const newTotalWorkers = newEmployees.worker || 0;
                    
                    // Always synchronize: if productWorkerDistribution exceeds new employees.worker, cap it
                    // This ensures consistency even if workers were reset but productWorkerDistribution wasn't
                    if (totalDistributedWorkers > newTotalWorkers) {
                        if (newTotalWorkers === 0) {
                            // If no workers assigned, clear all productWorkerDistribution
                            updates.productWorkerDistribution = {};
                        } else {
                            // Scale down productWorkerDistribution proportionally
                            const scaleFactor = newTotalWorkers / totalDistributedWorkers;
                            const adjustedDistribution = {};
                            for (const [key, value] of Object.entries(productWorkerDistribution)) {
                                adjustedDistribution[key] = Math.floor((value || 0) * scaleFactor);
                            }
                            updates.productWorkerDistribution = adjustedDistribution;
                        }
                    }
                }
                
                // Save to IndexedDB
                await housesStore.updateHouseFields(building.id, updates).catch(err => {
                    console.warn('[EmploymentDistributionService] Failed to assign workers:', {
                        buildingId: building.id,
                        error: err?.message || err
                    });
                });
                
                remainingWorkers -= workersToAssign;
                totalDistributed += workersToAssign;
            }
        }
    }


    /**
     * Synchronizes productWorkerDistribution with employees.worker for all factories
     * This ensures consistency: productWorkerDistribution total <= employees.worker
     * Called after worker distribution to fix any inconsistencies
     * 
     * @param {HousesStore} housesStore
     * @returns {Promise<void>}
     */
    async synchronizeFactoryWorkerDistribution(housesStore) {
        const allBuildings = await housesStore.listAllHouses();
        
        for (const building of allBuildings) {
            const buildingType = building.type || '';
            if (!buildingType.includes('Winery-001')) continue;
            
            const buildingId = building.id || building.name;
            const freshData = await housesStore.getHouse(buildingId);
            if (!freshData) continue;
            
            const employees = freshData.employees || { worker: 0, worker_need: 0 };
            const productWorkerDistribution = freshData.productWorkerDistribution || {};
            const totalWorkers = employees.worker || 0;
            const totalDistributedWorkers = Object.values(productWorkerDistribution).reduce(
                (sum, count) => sum + (count || 0), 0
            );
            
            // If productWorkerDistribution exceeds employees.worker, cap it
            if (totalDistributedWorkers > totalWorkers) {
                if (totalWorkers === 0) {
                    // If no workers assigned, clear all productWorkerDistribution
                    await housesStore.updateHouseFields(buildingId, {
                        productWorkerDistribution: {}
                    });
                } else {
                    // Scale down productWorkerDistribution proportionally
                    const scaleFactor = totalWorkers / totalDistributedWorkers;
                    const adjustedDistribution = {};
                    for (const [key, value] of Object.entries(productWorkerDistribution)) {
                        adjustedDistribution[key] = Math.floor((value || 0) * scaleFactor);
                    }
                    await housesStore.updateHouseFields(buildingId, {
                        productWorkerDistribution: adjustedDistribution
                    });
                }
            }
        }
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

