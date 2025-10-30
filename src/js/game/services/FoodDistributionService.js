import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { makeDbItemId } from '../../utils/utils.js';

/**
 * FoodDistributionService - Manages city-wide food distribution
 * 
 * Farm > Market > House logic:
 * 1. Farms produce their specific crop (Farms-Wheat → wheat, Farms-Carrot → carrot, Farms-Cabbage → cabbage)
 * 2. Markets collect food from nearby farms (adds to market stocks in IndexedDB)
 * 3. Markets distribute food to nearby houses (decreases market stocks, increases house stocks)
 * 
 * Works with IndexedDB as source of truth - all reads/writes go through housesStore
 */
export class FoodDistributionService extends SimService {
    /**
     * Food amounts distributed per house
     */
    foodPerHouse = {
        wheat: 1,
        carrot: 1,
        cabbage: 1,
        food: 3 // Total food = wheat + carrot + cabbage
    };

    /**
     * Processes food distribution city-wide
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        try {
            // Get all buildings from IndexedDB (source of truth)
            const houses = await housesStore.listAllHouses();
            
            // Find all markets
            const markets = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Market') || type.includes('market');
            });

            // Process each market: Farm → Market → House
            for (const market of markets) {
                await this.processMarket(market, housesStore);
            }
        } catch (error) {
            console.error('[FoodDistributionService] Error processing food distribution:', {
                error: error?.message || error,
                time,
                stack: error?.stack
            });
        }
    }

    /**
     * Processes a single market's food distribution (Farm > Market > House)
     * 
     * IMPORTANT: Markets WITHOUT road access cannot:
     * - Receive food from farms
     * - Distribute food to houses
     * 
     * @param {Object} market - Market building from database
     * @param {HousesStore} housesStore - Database store
     * @returns {Promise<void>}
     */
    async processMarket(market, housesStore) {
        // Get fresh data from IndexedDB (source of truth)
        const marketId = market.id || market.name;
        console.log('[FoodDistributionService] Processing market:', {
            marketId,
            marketType: market.type
        });
        
        const marketData = await housesStore.getHouse(marketId);
        if (!marketData) {
            console.warn('[FoodDistributionService] Market not found in database:', marketId);
            return;
        }

        // Check if market has road access (REQUIRED for both receiving and distributing food)
        const neighbors = marketData.neighbors || [];
        const { hasAccess: hasRoadAccess, roadCount } = checkRoadAccess(neighbors);
        
        console.log('[FoodDistributionService] Market road access check:', {
            marketId,
            hasRoadAccess,
            roadCount,
            totalNeighbors: neighbors.length
        });
        
        if (!hasRoadAccess) {
            // Market has no road access - CANNOT receive food from farms OR distribute to houses
            console.log('[FoodDistributionService] Market has no road access, skipping:', marketId);
            return;
        }

        // Separate neighbors into farms and houses
        // Neighbors can have either 'name' or 'buildingId' field (check both)
        const farmsNearby = neighbors.filter(neighbor => {
            const name = neighbor.name || neighbor.buildingId || '';
            return name.includes('Farm') || name.includes('farm');
        });

        const marketHouses = neighbors.filter(neighbor => {
            const name = neighbor.name || neighbor.buildingId || '';
            return name.includes('House') || name.includes('house');
        });

        console.log('[FoodDistributionService] Market neighbors:', {
            marketId,
            farmsNearby: farmsNearby.length,
            marketHouses: marketHouses.length,
            farmNeighbors: farmsNearby.map(f => ({
                id: f.id,
                name: f.name,
                buildingId: f.buildingId,
                x: f.x,
                y: f.y,
                constructedId: (f.x !== undefined && f.y !== undefined && f.name) ? makeDbItemId(f.name, f.x, f.y) : null
            })),
            houseNeighbors: marketHouses.map(h => ({
                id: h.id,
                name: h.name,
                buildingId: h.buildingId,
                x: h.x,
                y: h.y,
                constructedId: (h.x !== undefined && h.y !== undefined && h.name) ? makeDbItemId(h.name, h.x, h.y) : null
            })),
            allNeighborsSample: neighbors.length > 0 ? neighbors[0] : null,
            totalNeighbors: neighbors.length
        });

        // Step 1: Collect food from farms into market (Farm → Market)
        if (farmsNearby.length > 0) {
            await this.collectFoodFromFarms(marketId, farmsNearby, housesStore);
        } else {
            console.log('[FoodDistributionService] No farms nearby for market:', marketId);
        }

        // Step 2: Distribute food from market to houses (Market → House)
        if (marketHouses.length > 0) {
            await this.distributeFoodToHouses(marketId, marketHouses, housesStore);
        } else {
            console.log('[FoodDistributionService] No houses nearby for market:', marketId);
        }
    }

    /**
     * Collects food from nearby farms into market stocks
     * 
     * IMPORTANT: This method is only called for markets WITH road access.
     * Markets without road access cannot receive food from farms.
     * 
     * Each farm type produces only its specific crop:
     * - Farms-Wheat → produces 1 wheat unit
     * - Farms-Carrot → produces 1 carrot unit
     * - Farms-Cabbage → produces 1 cabbage unit
     * 
     * @param {string} marketId - Market ID (must have road access)
     * @param {Array} farms - Array of farm neighbor objects
     * @param {HousesStore} housesStore - Database store
     * @returns {Promise<void>}
     */
    async collectFoodFromFarms(marketId, farms, housesStore) {
        let wheatCount = 0;
        let carrotCount = 0;
        let cabbageCount = 0;

        // Count food from each farm (get fresh data from IndexedDB)
        for (const farmNeighbor of farms) {
            // Neighbors can have id, name, or buildingId - try all
            // If only name/type is present, construct full ID from coordinates
            let farmId = farmNeighbor.id || farmNeighbor.buildingId;
            if (!farmId) {
                // Try to construct ID from name (type) and coordinates
                const farmType = farmNeighbor.name;
                if (farmType && farmNeighbor.x !== undefined && farmNeighbor.y !== undefined) {
                    farmId = makeDbItemId(farmType, farmNeighbor.x, farmNeighbor.y);
                    if (!farmId) {
                        console.warn('[FoodDistributionService] Failed to construct farm ID from neighbor:', {
                            type: farmType,
                            x: farmNeighbor.x,
                            y: farmNeighbor.y,
                            neighbor: farmNeighbor
                        });
                    }
                }
            }
            if (!farmId) {
                console.warn('[FoodDistributionService] Farm neighbor missing ID:', farmNeighbor);
                continue;
            }

            try {
                // Get fresh farm data from IndexedDB (source of truth)
                const farmData = await housesStore.getHouse(farmId);
                if (!farmData) {
                    console.warn('[FoodDistributionService] Farm not found in database:', farmId);
                    continue;
                }

                const farmType = farmData.type || '';
                
                console.log('[FoodDistributionService] Processing farm:', {
                    farmId,
                    farmType,
                    neighborData: farmNeighbor
                });
                
                // Each farm type produces only its specific crop
                if (farmType.includes('Farm-Wheat') || farmType.includes('Farms-Wheat')) {
                    wheatCount++; // Farms-Wheat produces 1 wheat
                    console.log('[FoodDistributionService] Found wheat farm:', farmId);
                } else if (farmType.includes('Farm-Carrot') || farmType.includes('Farms-Carrot')) {
                    carrotCount++; // Farms-Carrot produces 1 carrot
                    console.log('[FoodDistributionService] Found carrot farm:', farmId);
                } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Farms-Cabbage')) {
                    cabbageCount++; // Farms-Cabbage produces 1 cabbage
                    console.log('[FoodDistributionService] Found cabbage farm:', farmId);
                } else {
                    console.warn('[FoodDistributionService] Unknown farm type:', {
                        farmId,
                        farmType
                    });
                }
            } catch (err) {
                console.warn('[FoodDistributionService] Failed to get farm data:', {
                    farmId,
                    error: err?.message || err
                });
            }
        }

        console.log('[FoodDistributionService] Farm collection results:', {
            marketId,
            wheatCount,
            carrotCount,
            cabbageCount,
            totalFarms: wheatCount + carrotCount + cabbageCount
        });

        // Update market stocks in IndexedDB (get fresh data first)
        if (wheatCount > 0 || carrotCount > 0 || cabbageCount > 0) {
            // Get fresh market data from IndexedDB
            const marketData = await housesStore.getHouse(marketId);
            if (!marketData) {
                console.warn('[FoodDistributionService] Market not found when updating stocks:', marketId);
                return;
            }

            const currentStocks = marketData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
            
            console.log('[FoodDistributionService] Market stocks before farm collection:', {
                marketId,
                currentStocks
            });
            
            // Add food collected from farms to market stocks
            const newStocks = {
                wheat: (currentStocks.wheat || 0) + wheatCount,
                carrot: (currentStocks.carrot || 0) + carrotCount,
                cabbage: (currentStocks.cabbage || 0) + cabbageCount,
                food: (currentStocks.food || 0) + (wheatCount + carrotCount + cabbageCount) // Total food units added
            };

            console.log('[FoodDistributionService] Market stocks after farm collection:', {
                marketId,
                newStocks
            });

            await housesStore.updateHouseFields(marketId, { stocks: newStocks }).catch(err => {
                console.warn('[FoodDistributionService] Failed to update market stocks from farms:', {
                    marketId,
                    error: err?.message || err
                });
            });
        } else {
            console.log('[FoodDistributionService] No food collected from farms (no valid farms found):', marketId);
        }
    }

    /**
     * Distributes food from market to nearby houses
     * 
     * Markets distribute 1 wheat + 1 carrot + 1 cabbage to each house
     * Market stocks are decreased accordingly (farm > market > house logic)
     * Only distributes if market has enough food of each type
     * 
     * @param {string} marketId - Market ID
     * @param {Array} houses - Array of house neighbor objects
     * @param {HousesStore} housesStore - Database store
     * @returns {Promise<void>}
     */
    async distributeFoodToHouses(marketId, houses, housesStore) {
        // Get fresh market data from IndexedDB (source of truth)
        const marketData = await housesStore.getHouse(marketId);
        if (!marketData) {
            console.warn('[FoodDistributionService] Market not found when distributing:', marketId);
            return;
        }

        const marketStocks = marketData.stocks || { wheat: 0, carrot: 0, cabbage: 0, food: 0 };
        
        console.log('[FoodDistributionService] Distribution check:', {
            marketId,
            marketStocks,
            housesCount: houses.length,
            housesIds: houses.map(h => h.id || h.name)
        });
        
        // Calculate available food quantities
        const wheatAvailable = marketStocks.wheat || 0;
        const carrotAvailable = marketStocks.carrot || 0;
        const cabbageAvailable = marketStocks.cabbage || 0;
        const totalFoodAvailable = wheatAvailable + carrotAvailable + cabbageAvailable;
        
        // Check if market has ANY food to distribute (changed: allow partial distribution)
        if (totalFoodAvailable === 0) {
            console.log('[FoodDistributionService] Market has no food to distribute:', {
                marketId,
                marketStocks
            });
            return;
        }
        
        // Calculate how many houses we can feed with available stocks
        // Changed: Allow distribution as long as we have at least one type of food per house
        // We can distribute to all houses if we have at least some food (not requiring all 3 types)
        const housesToDistribute = houses.slice(0, Math.min(
            houses.length,
            Math.floor(totalFoodAvailable / 1) // At least 1 unit of any food type per house
        ));

        console.log('[FoodDistributionService] Distribution calculation:', {
            marketId,
            housesToDistribute: housesToDistribute.length,
            totalHouses: houses.length,
            wheatAvailable,
            carrotAvailable,
            cabbageAvailable,
            totalFoodAvailable
        });

        console.log('[FoodDistributionService] Distributing to houses:', {
            marketId,
            housesToDistribute: housesToDistribute.map(h => h.id || h.name || h.buildingId)
        });

        // Track remaining stocks as we distribute (prevents over-distribution)
        let remainingWheat = wheatAvailable;
        let remainingCarrot = carrotAvailable;
        let remainingCabbage = cabbageAvailable;

        // Count total food distributed
        let totalWheatDistributed = 0;
        let totalCarrotDistributed = 0;
        let totalCabbageDistributed = 0;

        // Distribute food to each house (get fresh data from IndexedDB)
        const updatePromises = [];
        for (const houseNeighbor of housesToDistribute) {
            // Neighbors can have id, name, or buildingId - try all
            // If only name/type is present, construct full ID from coordinates
            let houseId = houseNeighbor.id || houseNeighbor.buildingId;
            if (!houseId) {
                // Try to construct ID from name (type) and coordinates
                const houseType = houseNeighbor.name;
                if (houseType && houseNeighbor.x !== undefined && houseNeighbor.y !== undefined) {
                    houseId = makeDbItemId(houseType, houseNeighbor.x, houseNeighbor.y);
                    if (!houseId) {
                        console.warn('[FoodDistributionService] Failed to construct house ID from neighbor:', {
                            type: houseType,
                            x: houseNeighbor.x,
                            y: houseNeighbor.y,
                            neighbor: houseNeighbor
                        });
                    } else {
                        console.log('[FoodDistributionService] Constructed house ID from neighbor:', {
                            constructedId: houseId,
                            originalNeighbor: houseNeighbor
                        });
                    }
                }
            }
            if (!houseId) {
                console.warn('[FoodDistributionService] House neighbor missing ID:', houseNeighbor);
                continue;
            }

            try {
                console.log('[FoodDistributionService] Processing house for distribution:', {
                    houseId,
                    neighborData: houseNeighbor
                });
                
                // Get fresh house data from IndexedDB
                const houseData = await housesStore.getHouse(houseId);
                if (!houseData) {
                    console.warn('[FoodDistributionService] House not found in database:', {
                        houseId,
                        neighborData: houseNeighbor
                    });
                    continue;
                }

                console.log('[FoodDistributionService] House found, current stocks:', {
                    houseId,
                    currentStocks: houseData.stocks || {},
                    houseType: houseData.type
                });

                // Update house stocks in IndexedDB - distribute whatever is available
                // Distribute 1 unit of each available type, not requiring all 3 types
                // Use remaining stocks to avoid over-distribution
                const newHouseStocks = {
                    wheat: remainingWheat >= this.foodPerHouse.wheat ? this.foodPerHouse.wheat : 0,
                    carrot: remainingCarrot >= this.foodPerHouse.carrot ? this.foodPerHouse.carrot : 0,
                    cabbage: remainingCabbage >= this.foodPerHouse.cabbage ? this.foodPerHouse.cabbage : 0,
                };
                // Calculate total food as sum of all types
                newHouseStocks.food = newHouseStocks.wheat + newHouseStocks.carrot + newHouseStocks.cabbage;
                
                // Update remaining stocks
                remainingWheat -= newHouseStocks.wheat;
                remainingCarrot -= newHouseStocks.carrot;
                remainingCabbage -= newHouseStocks.cabbage;

                console.log('[FoodDistributionService] Updating house stocks:', {
                    houseId,
                    newStocks: newHouseStocks,
                    foodCount: newHouseStocks.food,
                    wheat: newHouseStocks.wheat,
                    carrot: newHouseStocks.carrot,
                    cabbage: newHouseStocks.cabbage,
                    note: 'Will save to IndexedDB as source of truth'
                });

                updatePromises.push(
                    housesStore.updateHouseFields(houseId, { stocks: newHouseStocks }).then(() => {
                        console.log('[FoodDistributionService] Successfully updated house stocks:', {
                            houseId,
                            stocks: newHouseStocks
                        });
                    }).catch(err => {
                        console.warn('[FoodDistributionService] Failed to update house stocks:', {
                            houseId,
                            error: err?.message || err
                        });
                    })
                );

                // Only count what was actually distributed
                totalWheatDistributed += newHouseStocks.wheat;
                totalCarrotDistributed += newHouseStocks.carrot;
                totalCabbageDistributed += newHouseStocks.cabbage;
            } catch (err) {
                console.warn('[FoodDistributionService] Failed to get house data:', {
                    houseId,
                    error: err?.message || err
                });
            }
        }

        // Wait for all house updates to complete
        await Promise.allSettled(updatePromises);

        console.log('[FoodDistributionService] Distribution complete:', {
            marketId,
            totalWheatDistributed,
            totalCarrotDistributed,
            totalCabbageDistributed,
            housesUpdated: updatePromises.length
        });

        // Decrease market stocks in IndexedDB (food distributed)
        const newMarketStocks = {
            wheat: Math.max(0, (marketStocks.wheat || 0) - totalWheatDistributed),
            carrot: Math.max(0, (marketStocks.carrot || 0) - totalCarrotDistributed),
            cabbage: Math.max(0, (marketStocks.cabbage || 0) - totalCabbageDistributed),
            food: Math.max(0, (marketStocks.food || 0) - (totalWheatDistributed + totalCarrotDistributed + totalCabbageDistributed))
        };

        console.log('[FoodDistributionService] Market stocks after distribution:', {
            marketId,
            before: marketStocks,
            after: newMarketStocks
        });

        await housesStore.updateHouseFields(marketId, { stocks: newMarketStocks }).catch(err => {
            console.warn('[FoodDistributionService] Failed to update market stocks after distribution:', {
                marketId,
                error: err?.message || err
            });
        });
    }
}
