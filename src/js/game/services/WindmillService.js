import { SimService } from './SimService.js';
import { hasRoadAccessFromCount } from '../../acl/urban.js';
import { TimeManager } from '../utils/TimeManager.js';
import config from '../config.js';

/**
 * WindmillService - Manages windmill food collection from farms
 * 
 * Windmill logic:
 * 1. Every December (Décembre), windmills collect available food from ALL farms in the game
 * 2. Collects AFTER markets have finished collecting in autumn (Sept-Oct-Nov)
 * 3. No distance condition - windmills collect from every farm regardless of location
 * 4. Collects whatever food type is available from each farm (wheat, carrot, or cabbage)
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
        // Check if it's December (Décembre) - month index 11 (0-based: Jan=0, Dec=11)
        // IMPORTANT: Windmill collects in December, AFTER markets have finished collecting in autumn (Sept-Oct-Nov)
        // This ensures markets collect first, then windmill collects what remains
        const timeInfo = TimeManager.getTimeInfo(time);
        const isDecember = timeInfo.monthIndex === 11;
        
        // Only collect in December (after autumn when markets are done)
        if (!isDecember) {
            // Reset soldToWindmill flags for all farms when not in December
            // This ensures flags are cleared after December collection is complete
            try {
                const houses = await housesStore.listAllHouses();
                const farms = houses.filter(house => {
                    const type = house.type || '';
                    return type.includes('Farm') || type.includes('farm');
                });
                
                for (const farm of farms) {
                    const farmId = farm.id || farm.name;
                    const farmData = await housesStore.getHouse(farmId);
                    if (farmData && farmData.soldToWindmill === true) {
                        await housesStore.updateHouseFields(farmId, { soldToWindmill: false }).catch(err => {
                            console.warn('[WindmillService] Failed to reset soldToWindmill flag:', {
                                farmId,
                                error: err?.message || err
                            });
                        });
                    }
                }
            } catch (error) {
                console.warn('[WindmillService] Error resetting soldToWindmill flags:', error);
            }
            return;
        }
        
        try {
            // Get all buildings from IndexedDB (source of truth)
            const houses = await housesStore.listAllHouses();
            
            // Find all windmills
            const windmills = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });

            // Reset sales tracking for farms at the start of a new year (in December, before collection)
            if (timeInfo.dayInMonth === 1) {
                await this.resetFarmSalesTracking(housesStore, timeInfo.year);
            }
            
            // Reset soldToWindmill flags at the start of December (before collection)
            // This ensures the flag is only set during the actual collection process
            if (timeInfo.dayInMonth === 1) {
                const allHouses = await housesStore.listAllHouses();
                const farms = allHouses.filter(house => {
                    const type = house.type || '';
                    return type.includes('Farm') || type.includes('farm');
                });
                
                for (const farm of farms) {
                    const farmId = farm.id || farm.name;
                    await housesStore.updateHouseFields(farmId, { soldToWindmill: false }).catch(err => {
                        console.warn('[WindmillService] Failed to reset soldToWindmill flag:', {
                            farmId,
                            error: err?.message || err
                        });
                    });
                }
            }
            
            // Set isCollecting flag for all windmills
            for (const windmill of windmills) {
                const windmillId = windmill.id || windmill.name;
                await housesStore.updateHouseFields(windmillId, { isCollecting: true }).catch(err => {
                    console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                        windmillId,
                        error: err?.message || err
                    });
                });
            }

            // Find all farms
            const farms = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Farm') || type.includes('farm');
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
        
        // Get fresh data from IndexedDB (source of truth)
        const windmillData = await housesStore.getHouse(windmillId);
        if (!windmillData) {
            console.warn('[WindmillService] Windmill not found in database:', windmillId);
            return;
        }

        if (!hasRoadAccessFromCount(windmillData.roads)) {
            // Windmill has no road access - CANNOT collect food from farms
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
        // Get windmill data to check maxStock limit
        const windmillData = await housesStore.getHouse(windmillId);
        if (!windmillData) {
            console.warn('[WindmillService] Windmill not found:', windmillId);
            return;
        }
        
        const currentStocks = windmillData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0, wood: 0 };
        const maxStock = windmillData.maxStock || 1000; // Default max stock capacity for windmill
        const currentTotalStock = currentStocks.food || 0;
        let remainingCapacity = Math.max(0, maxStock - currentTotalStock);
        
        let wheatCount = 0;
        let carrotCount = 0;
        let cabbageCount = 0;
        let farmsProcessed = 0;

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

                if (!hasRoadAccessFromCount(farmData.roads)) {
                    continue;
                }

                const farmType = farmData.type || '';
                const farmStocks = farmData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                // Check if windmill has reached its capacity limit
                if (remainingCapacity <= 0) {
                    break; // Stop collecting from remaining farms
                }
                
                // Collect stocks from farms based on their type
                // Only collect what remains after markets have collected (in autumn)
                if (farmType.includes('Farm-Wheat') || farmType.includes('Farms-Wheat') || farmType.includes('Wheat')) {
                    const availableWheat = farmStocks.wheat || 0;
                    const canCollect = remainingCapacity;
                    const wheatToCollect = Math.min(availableWheat, canCollect);
                    
                    if (wheatToCollect > 0) {
                        wheatCount += wheatToCollect;
                        remainingCapacity -= wheatToCollect;
                        farmsProcessed++;
                        
                        // Reduce farm stocks (only what was collected)
                        const remainingWheat = availableWheat - wheatToCollect;
                        const newFarmStocks = {
                            ...farmStocks,
                            wheat: remainingWheat,
                            food: Math.max(0, (farmStocks.food || 0) - wheatToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { 
                            stocks: newFarmStocks,
                            soldToWindmill: true // Flag to show sprite in December
                        });
                        
                        // Track sale to windmill in farm data
                        await this.trackFarmSaleToWindmill(farmId, farmData, housesStore, timeInfo, 'wheat', wheatToCollect, windmillId);
                    }
                } else if (farmType.includes('Farm-Carrot') || farmType.includes('Farms-Carrot') || farmType.includes('Carrot')) {
                    const availableCarrot = farmStocks.carrot || 0;
                    const canCollect = remainingCapacity;
                    const carrotToCollect = Math.min(availableCarrot, canCollect);
                    
                    if (carrotToCollect > 0) {
                        carrotCount += carrotToCollect;
                        remainingCapacity -= carrotToCollect;
                        farmsProcessed++;
                        
                        // Reduce farm stocks (only what was collected)
                        const remainingCarrot = availableCarrot - carrotToCollect;
                        const newFarmStocks = {
                            ...farmStocks,
                            carrot: remainingCarrot,
                            food: Math.max(0, (farmStocks.food || 0) - carrotToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        
                        // Track sale to windmill in farm data
                        await this.trackFarmSaleToWindmill(farmId, farmData, housesStore, timeInfo, 'carrot', carrotToCollect, windmillId);
                    }
                } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Farms-Cabbage') || farmType.includes('Cabbage')) {
                    const availableCabbage = farmStocks.cabbage || 0;
                    const canCollect = remainingCapacity;
                    const cabbageToCollect = Math.min(availableCabbage, canCollect);
                    
                    if (cabbageToCollect > 0) {
                        cabbageCount += cabbageToCollect;
                        remainingCapacity -= cabbageToCollect;
                        farmsProcessed++;
                        
                        // Reduce farm stocks (only what was collected)
                        const remainingCabbage = availableCabbage - cabbageToCollect;
                        const newFarmStocks = {
                            ...farmStocks,
                            cabbage: remainingCabbage,
                            food: Math.max(0, (farmStocks.food || 0) - cabbageToCollect)
                        };
                        await housesStore.updateHouseFields(farmId, { 
                            stocks: newFarmStocks,
                            soldToWindmill: true // Flag to show sprite in December
                        });
                        
                        // Track sale to windmill in farm data
                        await this.trackFarmSaleToWindmill(farmId, farmData, housesStore, timeInfo, 'cabbage', cabbageToCollect, windmillId);
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

        // Update windmill stocks in IndexedDB (get fresh data first)
        if (wheatCount > 0 || carrotCount > 0 || cabbageCount > 0) {
            // Get fresh windmill data from IndexedDB (already fetched above, but refresh to get latest stocks)
            const freshWindmillData = await housesStore.getHouse(windmillId);
            if (!freshWindmillData) {
                console.warn('[WindmillService] Windmill not found when updating stocks:', windmillId);
                return;
            }

            const freshStocks = freshWindmillData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0, wood: 0 };
            const maxStock = freshWindmillData.maxStock || 1000; // Default max stock capacity for windmill
            
            // Add food collected from farms to windmill stocks (already respecting maxStock limit from collection loop)
            // Preserve wood stock (not part of food collection)
            const newStocks = {
                wheat: (freshStocks.wheat || 0) + wheatCount,
                carrot: (freshStocks.carrot || 0) + carrotCount,
                cabbage: (freshStocks.cabbage || 0) + cabbageCount,
                wood: freshStocks.wood || 0, // Preserve wood stock
                food: Math.min(maxStock, (freshStocks.food || 0) + (wheatCount + carrotCount + cabbageCount)) // Cap at maxStock
            };

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

    /**
     * Track farm sale to windmill (for display in farm info panel)
     * Records: year, product type, quantity, windmill ID (aggregated by year)
     * @param {string} farmId - Farm ID
     * @param {Object} farmData - Farm data from IndexedDB
     * @param {HousesStore} housesStore - Database store
     * @param {Object} timeInfo - Time info object
     * @param {string} productType - Product type (wheat, carrot, cabbage)
     * @param {number} quantity - Quantity sold
     * @param {string} windmillId - Windmill ID that collected
     */
    async trackFarmSaleToWindmill(farmId, farmData, housesStore, timeInfo, productType, quantity, windmillId) {
        try {
            // Initialize sales tracking if not exists
            const salesToMarket = farmData.salesToMarket || [];
            const salesToWindmill = farmData.salesToWindmill || [];
            
            const currentYear = timeInfo.year || 0;
            
            // Find existing windmill sale record for this year and product type
            const existingSaleIndex = salesToWindmill.findIndex(sale => 
                sale.year === currentYear && sale.productType === productType
            );
            
            if (existingSaleIndex >= 0) {
                // Update existing record
                salesToWindmill[existingSaleIndex].quantity += quantity;
                salesToWindmill[existingSaleIndex].count += 1; // Number of times sold this year
            } else {
                // Create new record
                salesToWindmill.push({
                    year: currentYear,
                    productType: productType,
                    quantity: quantity,
                    count: 1,
                    windmillId: windmillId,
                    date: new Date().toISOString()
                });
            }
            
            // Keep only current year's sales (reset annually)
            const filteredSales = salesToWindmill.filter(sale => sale.year === currentYear);
            
            await housesStore.updateHouseFields(farmId, {
                salesToMarket: salesToMarket, // Preserve market sales
                salesToWindmill: filteredSales
            });
        } catch (error) {
            console.warn('[WindmillService] Error tracking farm sale to windmill:', {
                farmId,
                error: error?.message || error
            });
        }
    }

    /**
     * Reset farm sales tracking at the start of a new year
     * Clears salesToMarket and salesToWindmill for all farms
     * @param {HousesStore} housesStore - Database store
     * @param {number} currentYear - Current year
     */
    async resetFarmSalesTracking(housesStore, currentYear) {
        try {
            const allHouses = await housesStore.listAllHouses();
            const farms = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Farm') || type.includes('farm');
            });
            
            for (const farm of farms) {
                const farmId = farm.id || farm.name;
                const farmData = await housesStore.getHouse(farmId);
                if (farmData) {
                    // Keep only current year's sales (filter out old year's data)
                    const salesToMarket = (farmData.salesToMarket || []).filter(sale => sale.year === currentYear);
                    const salesToWindmill = (farmData.salesToWindmill || []).filter(sale => sale.year === currentYear);
                    
                    await housesStore.updateHouseFields(farmId, {
                        salesToMarket: salesToMarket,
                        salesToWindmill: salesToWindmill
                    });
                }
            }
        } catch (error) {
            console.warn('[WindmillService] Error resetting farm sales tracking:', {
                error: error?.message || error
            });
        }
    }
}

