import { SimService } from './SimService.js';
import { hasRoadAccessFromCount } from '../../acl/parcels.js';
import { createSupplyContext, toSupplyMonth } from '../../acl/supply.js';
import { TimeManager } from '../utils/TimeManager.js';

/**
 * WindmillService - Manages windmill food collection from farms
 *
 * Windmill logic:
 * 1. Every December (Décembre), windmills collect available food from ALL farms in the game
 * 2. Collects AFTER markets have finished collecting in autumn (Sept-Oct-Nov)
 * 3. No distance condition - windmills collect from every farm regardless of location
 * 4. Collects whatever food type is available from each farm (wheat, carrot, or cabbage)
 *
 * Stock transfers go through Supply BC; UI flags / sales tracking stay here.
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

        // Set isCollecting to true (windmill has road access, workers, and it's December)
        await housesStore.updateHouseFields(windmillId, { isCollecting: true }).catch(err => {
            console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                windmillId,
                error: err?.message || err
            });
        });

        // Collect food from ALL farms (no distance condition) via Supply BC
        await this.collectFoodFromFarms(windmillId, allFarms, housesStore, time);
    }

    /**
     * Collects food from all farms into windmill stocks via Supply BC.
     *
     * Side effects kept here: salesToWindmill, soldToWindmill, lastCollection.
     *
     * @param {string} windmillId
     * @param {Array} farms
     * @param {HousesStore} housesStore
     * @param {number} time
     * @returns {Promise<void>}
     */
    async collectFoodFromFarms(windmillId, farms, housesStore, time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const month = toSupplyMonth(timeInfo.month);
        const supply = createSupplyContext({ housesStore });

        const outcome = await supply.collectFromAllFarms(
            windmillId,
            farms ?? [],
            month
        );

        if (!outcome.collected) {
            if (outcome.reason === 'windmill_not_operational') {
                await housesStore.updateHouseFields(windmillId, { isCollecting: false }).catch(err => {
                    console.warn('[WindmillService] Failed to update windmill isCollecting flag:', {
                        windmillId,
                        error: err?.message || err
                    });
                });
            }

            await housesStore.updateHouseFields(windmillId, {
                lastCollection: { wheat: 0, carrot: 0, cabbage: 0, total: 0 },
            }).catch(err => {
                console.warn('[WindmillService] Failed to update windmill lastCollection:', {
                    windmillId,
                    error: err?.message || err
                });
            });

            if (outcome.reason && outcome.reason !== 'nothing_to_collect') {
                console.info('[WindmillService] Collection skipped:', {
                    windmillId,
                    reason: outcome.reason,
                    month: timeInfo.month,
                });
            }
            return;
        }

        const lastCollection = {
            wheat: 0,
            carrot: 0,
            cabbage: 0,
            total: outcome.totalBaskets,
        };

        for (const transfer of outcome.transfers) {
            if (transfer.crop === 'wheat' || transfer.crop === 'cabbage') {
                await housesStore.updateHouseFields(transfer.farmId, {
                    soldToWindmill: true,
                }).catch(err => {
                    console.warn('[WindmillService] Failed to set soldToWindmill:', {
                        farmId: transfer.farmId,
                        error: err?.message || err
                    });
                });
            }

            if (lastCollection[transfer.crop] != null) {
                lastCollection[transfer.crop] += transfer.amount;
            }

            const farmData = await housesStore.getHouse(transfer.farmId);
            if (farmData) {
                await this.trackFarmSaleToWindmill(
                    transfer.farmId,
                    farmData,
                    housesStore,
                    timeInfo,
                    transfer.crop,
                    transfer.amount,
                    windmillId
                );
            }
        }

        await housesStore.updateHouseFields(windmillId, { lastCollection }).catch(err => {
            console.warn('[WindmillService] Failed to update windmill lastCollection:', {
                windmillId,
                error: err?.message || err
            });
        });

        console.info('[WindmillService] Collection via Supply BC:', {
            windmillId,
            totalBaskets: outcome.totalBaskets,
            transfers: outcome.transfers.length,
        });
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

