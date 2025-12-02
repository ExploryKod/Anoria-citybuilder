import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { makeDbItemId } from '../../utils/utils.js';
import { TimeManager } from '../utils/TimeManager.js';
import config from '../config.js';

/**
 * WindmillService - Manages windmill food collection from farms
 * 
 * Windmill logic:
 * 1. Every October (Octobre), windmills collect available food from ALL farms in the game
 * 2. No distance condition - windmills collect from every farm regardless of location
 * 3. Collects whatever food type is available from each farm (wheat, carrot, or cabbage)
 * 
 * Works with IndexedDB as source of truth - all reads/writes go through housesStore
 */
export class WindmillService extends SimService {
    /**
     * Processes windmill food collection city-wide
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        // Check if it's October (Octobre) - month index 9 (0-based: Jan=0, Oct=9)
        const timeInfo = TimeManager.getTimeInfo(time);
        const isOctober = timeInfo.monthIndex === 9;
        
        try {
            // Get all buildings from IndexedDB (source of truth)
            const houses = await housesStore.listAllHouses();
            
            // Find all windmills
            const windmills = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });

            if (!isOctober) {
                // Not October - set isCollecting to false for all windmills
                for (const windmill of windmills) {
                    const windmillId = windmill.id || windmill.name;
                    await housesStore.updateHouseFields(windmillId, { isCollecting: false }).catch(err => {
                        console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                            windmillId,
                            error: err?.message || err
                        });
                    });
                }
                return;
            }

            console.log('[WindmillService] October detected - windmills collecting from farms');

            // Find all farms
            const farms = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Farm') || type.includes('farm');
            });

            console.log('[WindmillService] Found buildings:', {
                windmills: windmills.length,
                farms: farms.length
            });

            // Process each windmill: collect from all farms
            for (const windmill of windmills) {
                await this.processWindmill(windmill, farms, housesStore, time);
            }
        } catch (error) {
            console.error('[WindmillService] Error processing windmill collection:', {
                error: error?.message || error,
                time,
                stack: error?.stack
            });
        }
    }

    /**
     * Processes a single windmill's food collection from all farms
     * 
     * IMPORTANT: Windmills WITH road access collect from ALL farms in the game.
     * Windmills WITHOUT road access cannot collect food.
     * 
     * @param {Object} windmill - Windmill building from database
     * @param {Array} allFarms - All farms from database
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async processWindmill(windmill, allFarms, housesStore, time = 0) {
        const windmillId = windmill.id || windmill.name;
        console.log('[WindmillService] Processing windmill:', {
            windmillId,
            windmillType: windmill.type,
            totalFarms: allFarms.length
        });
        
        // Get fresh data from IndexedDB (source of truth)
        const windmillData = await housesStore.getHouse(windmillId);
        if (!windmillData) {
            console.warn('[WindmillService] Windmill not found in database:', windmillId);
            return;
        }

        // Check if windmill has road access (REQUIRED for collecting food)
        const neighbors = windmillData.neighbors || [];
        const { hasAccess: hasRoadAccess, roadCount } = checkRoadAccess(neighbors);
        
        console.log('[WindmillService] Windmill road access check:', {
            windmillId,
            hasRoadAccess,
            roadCount,
            totalNeighbors: neighbors.length
        });
        
        if (!hasRoadAccess) {
            // Windmill has no road access - CANNOT collect food from farms
            console.log('[WindmillService] Windmill has no road access, skipping:', windmillId);
            // Set isCollecting to false (no road access = cannot collect)
            await housesStore.updateHouseFields(windmillId, { isCollecting: false }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                    windmillId,
                    error: err?.message || err
                });
            });
            return;
        }

        // Check if windmill has workers (REQUIRED for operation)
        const windmillEmployees = windmillData.employees || { worker: 0, worker_need: 0 };
        const windmillWorkers = windmillEmployees.worker || 0;
        const windmillWorkerNeed = windmillEmployees.worker_need || 0;
        const hasNoWorkers = windmillWorkers === 0 && windmillWorkerNeed > 0;
        
        if (hasNoWorkers) {
            // Windmill has no workers - CANNOT collect food from farms
            console.log('[WindmillService] Windmill has no workers, skipping:', {
                windmillId,
                workers: windmillWorkers,
                workerNeed: windmillWorkerNeed
            });
            // Set isCollecting to false (no workers = cannot collect)
            await housesStore.updateHouseFields(windmillId, { isCollecting: false }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                    windmillId,
                    error: err?.message || err
                });
            });
            return;
        }

        // Set isCollecting to true (windmill has road access, workers, and it's October)
        await housesStore.updateHouseFields(windmillId, { isCollecting: true }).catch(err => {
            console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                windmillId,
                error: err?.message || err
            });
        });

        // Collect food from ALL farms (no distance condition)
        await this.collectFoodFromFarms(windmillId, allFarms, housesStore, time);
    }

    /**
     * Collects food from all farms into windmill stocks
     * 
     * IMPORTANT: This method is only called for windmills WITH road access.
     * Windmills without road access cannot collect food from farms.
     * 
     * Collection rules:
     * 1. Collects from ALL farms in the game (no distance condition)
     * 2. Only collects from farms with road access
     * 3. Collects whatever food type is available (wheat, carrot, or cabbage)
     * 4. Takes all available stocks from each farm
     * 
     * @param {string} windmillId - Windmill ID (must have road access)
     * @param {Array} farms - Array of all farm objects in the game
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async collectFoodFromFarms(windmillId, farms, housesStore, time = 0) {
        let wheatCount = 0;
        let carrotCount = 0;
        let cabbageCount = 0;
        let farmsProcessed = 0;

        console.log('[WindmillService] Starting farm collection for windmill:', {
            windmillId,
            totalFarms: farms.length
        });

        // Collect from each farm
        for (const farm of farms) {
            const farmId = farm.id || farm.name;
            if (!farmId) {
                console.warn('[WindmillService] Farm missing ID:', farm);
                continue;
            }

            try {
                // Get fresh farm data from IndexedDB (source of truth)
                const farmData = await housesStore.getHouse(farmId);
                if (!farmData) {
                    console.warn('[WindmillService] Farm not found in database:', {
                        farmId,
                        farmData: farm
                    });
                    continue;
                }

                // Check if farm has road access (required for production)
                const farmNeighbors = farmData.neighbors || [];
                const { hasAccess: farmHasRoadAccess } = checkRoadAccess(farmNeighbors);
                
                if (!farmHasRoadAccess) {
                    console.log('[WindmillService] Farm has no road access, skipping:', {
                        farmId,
                        farmType: farmData.type
                    });
                    continue;
                }

                const farmType = farmData.type || '';
                const farmStocks = farmData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                console.log('[WindmillService] Processing farm:', {
                    farmId,
                    farmType,
                    hasRoadAccess: farmHasRoadAccess,
                    stocks: farmStocks
                });
                
                // Collect stocks from farms based on their type
                if (farmType.includes('Farm-Wheat') || farmType.includes('Farms-Wheat') || farmType.includes('Wheat')) {
                    const wheatToCollect = farmStocks.wheat || 0;
                    if (wheatToCollect > 0) {
                        wheatCount += wheatToCollect;
                        farmsProcessed++;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            wheat: 0,
                            food: Math.max(0, (farmStocks.food || 0) - wheatToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[WindmillService] Collected wheat from farm:', {
                            farmId,
                            wheatCollected: wheatToCollect,
                            remainingStocks: newFarmStocks
                        });
                    }
                } else if (farmType.includes('Farm-Carrot') || farmType.includes('Farms-Carrot') || farmType.includes('Carrot')) {
                    const carrotToCollect = farmStocks.carrot || 0;
                    if (carrotToCollect > 0) {
                        carrotCount += carrotToCollect;
                        farmsProcessed++;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            carrot: 0,
                            food: Math.max(0, (farmStocks.food || 0) - carrotToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[WindmillService] Collected carrot from farm:', {
                            farmId,
                            carrotCollected: carrotToCollect,
                            remainingStocks: newFarmStocks
                        });
                    }
                } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Farms-Cabbage') || farmType.includes('Cabbage')) {
                    const cabbageToCollect = farmStocks.cabbage || 0;
                    if (cabbageToCollect > 0) {
                        cabbageCount += cabbageToCollect;
                        farmsProcessed++;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            cabbage: 0,
                            food: Math.max(0, (farmStocks.food || 0) - cabbageToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[WindmillService] Collected cabbage from farm:', {
                            farmId,
                            cabbageCollected: cabbageToCollect,
                            remainingStocks: newFarmStocks
                        });
                    }
                } else {
                    console.warn('[WindmillService] Unknown farm type:', {
                        farmId,
                        farmType
                    });
                }
            } catch (err) {
                console.warn('[WindmillService] Failed to get farm data:', {
                    farmId,
                    error: err?.message || err
                });
            }
        }

        console.log('[WindmillService] Farm collection results:', {
            windmillId,
            wheatCount,
            carrotCount,
            cabbageCount,
            totalFood: wheatCount + carrotCount + cabbageCount,
            farmsProcessed
        });

        // Update windmill stocks in IndexedDB (get fresh data first)
        if (wheatCount > 0 || carrotCount > 0 || cabbageCount > 0) {
            // Get fresh windmill data from IndexedDB
            const windmillData = await housesStore.getHouse(windmillId);
            if (!windmillData) {
                console.warn('[WindmillService] Windmill not found when updating stocks:', windmillId);
                return;
            }

            const currentStocks = windmillData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
            
            console.log('[WindmillService] Windmill stocks before farm collection:', {
                windmillId,
                currentStocks
            });
            
            // Add food collected from farms to windmill stocks
            const newStocks = {
                wheat: (currentStocks.wheat || 0) + wheatCount,
                carrot: (currentStocks.carrot || 0) + carrotCount,
                cabbage: (currentStocks.cabbage || 0) + cabbageCount,
                food: (currentStocks.food || 0) + (wheatCount + carrotCount + cabbageCount) // Total food units added
            };

            console.log('[WindmillService] Windmill stocks after farm collection:', {
                windmillId,
                newStocks
            });

            // Track last collection amounts for display in info panel
            const lastCollection = {
                wheat: wheatCount,
                carrot: carrotCount,
                cabbage: cabbageCount,
                total: wheatCount + carrotCount + cabbageCount
            };

            await housesStore.updateHouseFields(windmillId, { 
                stocks: newStocks,
                lastCollection: lastCollection
            }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill stocks from farms:', {
                    windmillId,
                    error: err?.message || err
                });
            });
        } else {
            console.log('[WindmillService] No food collected from farms (no valid farms found):', windmillId);
            
            // Still update lastCollection to show 0 for this collection cycle
            const lastCollection = {
                wheat: 0,
                carrot: 0,
                cabbage: 0,
                total: 0
            };
            
            await housesStore.updateHouseFields(windmillId, { 
                lastCollection: lastCollection
            }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill lastCollection:', {
                    windmillId,
                    error: err?.message || err
                });
            });
        }
    }
}

