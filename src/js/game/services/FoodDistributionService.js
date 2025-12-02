import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { makeDbItemId } from '../../utils/utils.js';
import { TimeManager } from '../utils/TimeManager.js';
import config from '../config.js';
import FoodTraceabilityService from '../../stores/FoodTraceabilityService.js';

/**
 * FoodDistributionService - Manages city-wide food distribution
 * 
 * Farm > Market > House logic:
 * 1. Farms produce their specific crop (Farms-Wheat → wheat, Farms-Carrot → carrot, Farms-Cabbage → cabbage)
 * 2. Markets collect food from nearby farms (adds to market stocks in IndexedDB)
 * 3. Markets distribute food to houses within distance (decreases market stocks, increases house stocks)
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
     * Maximum distance (in tiles) a market can distribute food to houses
     * Uses Manhattan distance (sum of x and y differences)
     * Configurable via config.simulation.foodDistributionDistance
     */
    get foodDistributionDistance() {
        return config?.simulation?.foodDistributionDistance || 5;
    }

    /**
     * Calculate Manhattan distance between two points
     * @param {number} x1 - X coordinate of first point
     * @param {number} y1 - Y coordinate of first point
     * @param {number} x2 - X coordinate of second point
     * @param {number} y2 - Y coordinate of second point
     * @returns {number} Manhattan distance
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    /**
     * Processes food distribution city-wide
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        // Check if it's winter (Janvier-Février-Mars) - farms don't produce during winter
        const timeInfo = TimeManager.getTimeInfo(time);
        const isWinter = timeInfo.monthIndex >= 0 && timeInfo.monthIndex <= 2;
        
        if (isWinter) {
            console.log('[FoodDistributionService] Winter season - farms do not produce food');
            // Still process markets to distribute existing stocks, but skip farm collection
            // We'll handle this in processMarket by checking isWinter
        }
        try {
            // Get all buildings from IndexedDB (source of truth)
            const houses = await housesStore.listAllHouses();
            
            // Find all markets
            const markets = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Market') || type.includes('market');
            });

            // Update isBuying flag for all markets based on season
            const timeInfo = TimeManager.getTimeInfo(time);
            const isAutumn = timeInfo.season === 'Automne';
            
            for (const market of markets) {
                const marketId = market.id || market.name;
                // Set isBuying flag: true during autumn, false otherwise
                await housesStore.updateHouseFields(marketId, { isBuying: isAutumn }).catch(err => {
                    console.warn('[FoodDistributionService] Failed to update market isBuying flag:', {
                        marketId,
                        error: err?.message || err
                    });
                });
            }

            // Process each market: Farm → Market → House
            for (const market of markets) {
                await this.processMarket(market, housesStore, houses, time);
            }

            // After processing all markets, update houses that are too far from any market
            await this.updateHousesMarketDistanceStatus(markets, houses, housesStore);
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
     * @param {Array} allHouses - All houses from database (for distance-based distribution)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async processMarket(market, housesStore, allHouses = [], time = 0) {
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

        // Check if market has workers (REQUIRED for operation)
        const marketEmployees = marketData.employees || { worker: 0, worker_need: 0 };
        const marketWorkers = marketEmployees.worker || 0;
        const marketWorkerNeed = marketEmployees.worker_need || 0;
        const hasNoWorkers = marketWorkers === 0 && marketWorkerNeed > 0;
        
        if (hasNoWorkers) {
            // Market has no workers - CANNOT receive food from farms OR distribute to houses
            console.log('[FoodDistributionService] Market has no workers, skipping:', {
                marketId,
                workers: marketWorkers,
                workerNeed: marketWorkerNeed
            });
            return;
        }

        // Separate neighbors into farms and houses
        // Neighbors can have either 'name' or 'buildingId' field (check both)
        // Also check the type field if available
        const farmsNearby = neighbors.filter(neighbor => {
            const name = neighbor.name || neighbor.buildingId || neighbor.type || '';
            const type = neighbor.type || '';
            // Check multiple ways to identify farms
            return name.includes('Farm') || name.includes('farm') || 
                   type.includes('Farm') || type.includes('farm') ||
                   name.includes('Wheat') || name.includes('Carrot') || name.includes('Cabbage');
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
        // Skip collection during winter (Janvier-Février-Mars) - farms don't produce
        // Also update noFarmsNearby status for UI display
        const hasFarmsNearby = farmsNearby.length > 0;
        await housesStore.updateHouseFields(marketId, { noFarmsNearby: !hasFarmsNearby }).catch(err => {
            console.warn('[FoodDistributionService] Failed to update market noFarmsNearby status:', {
                marketId,
                error: err?.message || err
            });
        });
        
        if (hasFarmsNearby) {
            await this.collectFoodFromFarms(marketId, farmsNearby, housesStore, time);
        } else {
            console.log('[FoodDistributionService] No farms nearby for market:', marketId);
        }

        // Step 2: Distribute food from market to houses within distance (Market → House)
        // Use distance-based distribution instead of just neighbors
        // IMPORTANT: Pass time parameter so houses don't buy in autumn
        const housesInRange = this.findHousesInRange(marketData, allHouses);
        
        if (housesInRange.length > 0) {
            await this.distributeFoodToHouses(marketId, housesInRange, housesStore, time);
        } else {
            console.log('[FoodDistributionService] No houses within range for market:', marketId);
        }
    }

    /**
     * Finds all houses within food distribution distance of a market
     * Uses Manhattan distance (configurable via config.simulation.foodDistributionDistance)
     * 
     * @param {Object} market - Market building from database (must have x, y coordinates)
     * @param {Array} allHouses - All houses from database
     * @returns {Array} Array of house objects within range
     */
    findHousesInRange(market, allHouses) {
        if (!market || market.x === undefined || market.y === undefined) {
            console.warn('[FoodDistributionService] Market missing coordinates:', market);
            return [];
        }

        const marketX = market.x;
        const marketY = market.y;
        const maxDistance = this.foodDistributionDistance;

        // Filter houses that are within range and have road access
        const housesInRange = allHouses.filter(house => {
            // Only process houses (not markets, farms, etc.)
            const houseType = house.type || '';
            if (!houseType.includes('House') && !houseType.includes('house')) {
                return false;
            }

            // Check if house has coordinates
            if (house.x === undefined || house.y === undefined) {
                return false;
            }

            // Calculate distance
            const distance = this.calculateDistance(marketX, marketY, house.x, house.y);
            
            // Check if house is within range
            if (distance > maxDistance) {
                return false;
            }

            // Check if house has road access (required for food distribution)
            const neighbors = house.neighbors || [];
            const { hasAccess: hasRoadAccess } = checkRoadAccess(neighbors);
            
            return hasRoadAccess;
        });

        console.log('[FoodDistributionService] Houses in range of market:', {
            marketId: market.id || market.name,
            marketPosition: { x: marketX, y: marketY },
            maxDistance,
            housesInRange: housesInRange.length,
            houseIds: housesInRange.map(h => h.id || h.name)
        });

        return housesInRange;
    }

    /**
     * Updates houses' market distance status in IndexedDB
     * Marks houses that are too far from any market with road access
     * 
     * @param {Array} markets - All markets from database
     * @param {Array} allHouses - All houses from database
     * @param {HousesStore} housesStore - Database store
     * @returns {Promise<void>}
     */
    async updateHousesMarketDistanceStatus(markets, allHouses, housesStore) {
        // Find all markets with road access
        const marketsWithRoadAccess = [];
        for (const market of markets) {
            const marketData = await housesStore.getHouse(market.id || market.name);
            if (marketData) {
                const neighbors = marketData.neighbors || [];
                const { hasAccess: hasRoadAccess } = checkRoadAccess(neighbors);
                if (hasRoadAccess && marketData.x !== undefined && marketData.y !== undefined) {
                    marketsWithRoadAccess.push(marketData);
                }
            }
        }

        // Process each house
        for (const house of allHouses) {
            const houseType = house.type || '';
            if (!houseType.includes('House') && !houseType.includes('house')) {
                continue; // Skip non-houses
            }

            if (house.x === undefined || house.y === undefined) {
                continue; // Skip houses without coordinates
            }

            // Check if house is within range of any market with road access
            let isWithinRange = false;
            for (const market of marketsWithRoadAccess) {
                const distance = this.calculateDistance(house.x, house.y, market.x, market.y);
                if (distance <= this.foodDistributionDistance) {
                    isWithinRange = true;
                    break;
                }
            }

            // Update house status in IndexedDB
            const houseId = house.id || house.name;
            if (houseId) {
                await housesStore.updateHouseFields(houseId, {
                    marketTooFar: !isWithinRange
                }).catch(err => {
                    console.warn('[FoodDistributionService] Failed to update house market distance status:', {
                        houseId,
                        error: err?.message || err
                    });
                });
            }
        }
    }

    /**
     * Collects food from nearby farms into market stocks
     * 
     * IMPORTANT: This method is only called for markets WITH road access.
     * Markets without road access cannot receive food from farms.
     * 
     * Conditions for buying from farms:
     * 1. Must be in autumn season (after summer harvest) - buying period only
     * 2. Farm must have stocks available
     * 3. Can only buy up to available farm stocks (cannot buy more than available)
     * 
     * Each farm type produces only its specific crop:
     * - Farms-Wheat → produces 78 wheat units (enough to feed 6 citizens for 1 year + buffer)
     * - Farms-Carrot → produces 78 carrot units (enough to feed 6 citizens for 1 year + buffer)
     * - Farms-Cabbage → produces 78 cabbage units (enough to feed 6 citizens for 1 year + buffer)
     * 
     * NOTE: Farms produce once per year during autumn (Automne)
     * Each farm produces 78 paniers = (6 citizens × 12 paniers/year) + 6 paniers buffer = enough to feed 1 house (6 citizens) for 1 year
     * 1 citizen consumes 1 panier/month = 12 paniers/year
     * Calculation: (1×12×6) + (1×6) = 72 + 6 = 78 paniers/year
     * 
     * @param {string} marketId - Market ID (must have road access)
     * @param {Array} farms - Array of farm neighbor objects
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async collectFoodFromFarms(marketId, farms, housesStore, time = 0) {
        // Condition 1: Check current season - can only buy during autumn (after summer harvest)
        const timeInfo = TimeManager.getTimeInfo(time);
        const isAutumn = timeInfo.season === 'Automne';
        
        // Markets can only buy from farms during autumn (buying period)
        if (!isAutumn) {
            console.log('[FoodDistributionService] Not autumn season - markets can only buy from farms in autumn:', {
                marketId,
                month: timeInfo.month,
                season: timeInfo.season,
                monthIndex: timeInfo.monthIndex
            });
            return; // Cannot buy outside of buying period
        }
        
        let wheatCount = 0;
        let carrotCount = 0;
        let cabbageCount = 0;

        // Buy stocks from each farm (get fresh data from IndexedDB)
        for (const farmNeighbor of farms) {
            // Neighbors can have id, name, or buildingId - try all
            // If only name/type is present, construct full ID from coordinates
            let farmId = farmNeighbor.id || farmNeighbor.buildingId;
            if (!farmId) {
                // Try to construct ID from name (type) and coordinates
                const farmType = farmNeighbor.name || farmNeighbor.type || '';
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
                    console.warn('[FoodDistributionService] Farm not found in database:', {
                        farmId,
                        neighborData: farmNeighbor
                    });
                    continue;
                }

                // Check if farm has road access (required for production)
                const farmNeighbors = farmData.neighbors || [];
                const { hasAccess: farmHasRoadAccess } = checkRoadAccess(farmNeighbors);
                
                if (!farmHasRoadAccess) {
                    console.log('[FoodDistributionService] Farm has no road access, skipping:', {
                        farmId,
                        farmType: farmData.type
                    });
                    continue;
                }

                const farmType = farmData.type || '';
                const farmStocks = farmData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                console.log('[FoodDistributionService] Processing farm:', {
                    farmId,
                    farmType,
                    hasRoadAccess: farmHasRoadAccess,
                    stocks: farmStocks,
                    neighborData: farmNeighbor
                });
                
                // Buy stocks from farms (only in autumn - condition 1 already checked)
                // Each farm type has stocks of its specific crop
                if (farmType.includes('Farm-Wheat') || farmType.includes('Farms-Wheat') || farmType.includes('Wheat')) {
                    // Condition 2: Farm must have stocks available
                    // Condition 3: Can only buy up to available stocks (cannot buy more than available)
                    const wheatToBuy = farmStocks.wheat || 0;
                    if (wheatToBuy > 0) {
                        wheatCount += wheatToBuy;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            wheat: 0,
                            food: Math.max(0, (farmStocks.food || 0) - wheatToBuy)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[FoodDistributionService] Bought wheat from farm:', {
                            farmId,
                            wheatBought: wheatToBuy,
                            remainingStocks: newFarmStocks
                        });
                        
                        // Enregistrer la transaction ferme → marché
                        if (window.foodTraceabilityService) {
                            const timeInfo = TimeManager.getTimeInfo(time);
                            const marketData = await housesStore.getHouse(marketId);
                            if (farmData && marketData) {
                                await window.foodTraceabilityService.recordFarmToMarket(
                                    timeInfo.turn || 0,
                                    timeInfo.monthIndex || 0,
                                    timeInfo.year || 0,
                                    { id: farmId, x: farmData.x, y: farmData.y, type: farmType },
                                    { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                    'wheat',
                                    wheatToBuy,
                                    1 // Prix par panier
                                );
                            }
                        }
                    }
                } else if (farmType.includes('Farm-Carrot') || farmType.includes('Farms-Carrot') || farmType.includes('Carrot')) {
                    // Condition 2: Farm must have stocks available
                    // Condition 3: Can only buy up to available stocks (cannot buy more than available)
                    const carrotToBuy = farmStocks.carrot || 0;
                    if (carrotToBuy > 0) {
                        carrotCount += carrotToBuy;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            carrot: 0,
                            food: Math.max(0, (farmStocks.food || 0) - carrotToBuy)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[FoodDistributionService] Bought carrot from farm:', {
                            farmId,
                            carrotBought: carrotToBuy,
                            remainingStocks: newFarmStocks
                        });
                        
                        // Enregistrer la transaction ferme → marché
                        if (window.foodTraceabilityService) {
                            const timeInfo = TimeManager.getTimeInfo(time);
                            const marketData = await housesStore.getHouse(marketId);
                            if (farmData && marketData) {
                                await window.foodTraceabilityService.recordFarmToMarket(
                                    timeInfo.turn || 0,
                                    timeInfo.monthIndex || 0,
                                    timeInfo.year || 0,
                                    { id: farmId, x: farmData.x, y: farmData.y, type: farmType },
                                    { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                    'carrot',
                                    carrotToBuy,
                                    1 // Prix par panier
                                );
                            }
                        }
                    }
                } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Farms-Cabbage') || farmType.includes('Cabbage')) {
                    // Condition 2: Farm must have stocks available
                    // Condition 3: Can only buy up to available stocks (cannot buy more than available)
                    const cabbageToBuy = farmStocks.cabbage || 0;
                    if (cabbageToBuy > 0) {
                        cabbageCount += cabbageToBuy;
                        // Reduce farm stocks to 0
                        const newFarmStocks = {
                            ...farmStocks,
                            cabbage: 0,
                            food: Math.max(0, (farmStocks.food || 0) - cabbageToBuy)
                        };
                        await housesStore.updateHouseFields(farmId, { stocks: newFarmStocks });
                        console.log('[FoodDistributionService] Bought cabbage from farm:', {
                            farmId,
                            cabbageBought: cabbageToBuy,
                            remainingStocks: newFarmStocks
                        });
                        
                        // Enregistrer la transaction ferme → marché
                        if (window.foodTraceabilityService) {
                            const timeInfo = TimeManager.getTimeInfo(time);
                            const marketData = await housesStore.getHouse(marketId);
                            if (farmData && marketData) {
                                await window.foodTraceabilityService.recordFarmToMarket(
                                    timeInfo.turn || 0,
                                    timeInfo.monthIndex || 0,
                                    timeInfo.year || 0,
                                    { id: farmId, x: farmData.x, y: farmData.y, type: farmType },
                                    { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                    'cabbage',
                                    cabbageToBuy,
                                    1 // Prix par panier
                                );
                            }
                        }
                    }
                } else {
                    console.warn('[FoodDistributionService] Unknown farm type:', {
                        farmId,
                        farmType,
                        neighborName: farmNeighbor.name,
                        neighborType: farmNeighbor.type
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
     * Distributes food from market to houses within range
     * 
     * Houses can buy as much as they want as long as the market has stocks
     * Multiple houses buy simultaneously, so the market can run out of stock
     * Market stocks are decreased accordingly (farm > market > house logic)
     * Only distributes if market has stocks
     * 
     * IMPORTANT: Houses do NOT buy in autumn - they live on their existing stocks
     * Houses only buy during winter, spring, and summer
     * 
     * @param {string} marketId - Market ID
     * @param {Array} houses - Array of house objects (within range)
     * @param {HousesStore} housesStore - Database store
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async distributeFoodToHouses(marketId, houses, housesStore, time = 0) {
        // Check current season - houses do NOT buy in autumn
        const timeInfo = TimeManager.getTimeInfo(time);
        const isAutumn = timeInfo.season === 'Automne';
        
        if (isAutumn) {
            console.log('[FoodDistributionService] Autumn season - houses do not buy from markets, they live on existing stocks:', {
                marketId,
                month: timeInfo.month,
                season: timeInfo.season,
                monthIndex: timeInfo.monthIndex
            });
            return; // Houses do not buy in autumn
        }
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
        
        // Check if market has ANY food to distribute
        if (totalFoodAvailable === 0) {
            console.log('[FoodDistributionService] Market has no food to distribute:', {
                marketId,
                marketStocks
            });
            return;
        }

        console.log('[FoodDistributionService] Distributing to all houses (they can buy as much as available):', {
            marketId,
            totalHouses: houses.length,
            wheatAvailable,
            carrotAvailable,
            cabbageAvailable,
            totalFoodAvailable
        });

        // Track remaining stocks as we distribute (prevents over-distribution)
        // Multiple houses buy simultaneously, so stocks can run out
        let remainingWheat = wheatAvailable;
        let remainingCarrot = carrotAvailable;
        let remainingCabbage = cabbageAvailable;

        // Count total food distributed
        let totalWheatDistributed = 0;
        let totalCarrotDistributed = 0;
        let totalCabbageDistributed = 0;

        // Distribute food to each house (get fresh data from IndexedDB)
        // Each house buys 1 panier at a time, all houses buy simultaneously until market runs out
        // Houses can buy as much as they want as long as market has stocks
        // IMPORTANT: Wait for each update to complete before next iteration to avoid race conditions
        
        // Store all update promises for final wait
        const allUpdatePromises = [];
        
        // Continue distributing until market runs out of stock
        // Each iteration, all houses try to buy 1 panier of each available type
        let iteration = 0;
        const maxIterations = Math.max(wheatAvailable, carrotAvailable, cabbageAvailable); // Safety limit
        
        while ((remainingWheat > 0 || remainingCarrot > 0 || remainingCabbage > 0) && iteration < maxIterations) {
            iteration++;
            let stocksBoughtThisIteration = false;
            
            // Store updates for this iteration (we'll wait for them before next iteration)
            const iterationUpdates = [];
            
            // All houses try to buy 1 panier each in this iteration
            for (const house of houses) {
                // Check if market still has stocks
                if (remainingWheat === 0 && remainingCarrot === 0 && remainingCabbage === 0) {
                    break; // Market is out of stock
                }

                // Houses from findHousesInRange already have id or name
                let houseId = house.id || house.name || house.buildingId;
                if (!houseId && house.x !== undefined && house.y !== undefined) {
                    // Try to construct ID from type and coordinates
                    const houseType = house.type || house.name;
                    if (houseType) {
                        houseId = makeDbItemId(houseType, house.x, house.y);
                    }
                }
                if (!houseId) {
                    continue;
                }

                try {
                    // Get fresh house data from IndexedDB (wait for previous updates to complete)
                    const houseData = await housesStore.getHouse(houseId);
                    if (!houseData) {
                        continue;
                    }

                    // Get current house stocks (to add to them, not replace)
                    const currentHouseStocks = houseData.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };

                    // House buys 1 panier of each available type (if available)
                    let wheatToBuy = 0;
                    let carrotToBuy = 0;
                    let cabbageToBuy = 0;
                    
                    // Buy 1 panier of each type if available
                    if (remainingWheat > 0) {
                        wheatToBuy = 1;
                        remainingWheat--;
                        stocksBoughtThisIteration = true;
                    }
                    if (remainingCarrot > 0) {
                        carrotToBuy = 1;
                        remainingCarrot--;
                        stocksBoughtThisIteration = true;
                    }
                    if (remainingCabbage > 0) {
                        cabbageToBuy = 1;
                        remainingCabbage--;
                        stocksBoughtThisIteration = true;
                    }
                    
                    // If no stocks were bought, skip this house
                    if (wheatToBuy === 0 && carrotToBuy === 0 && cabbageToBuy === 0) {
                        continue;
                    }
                    
                    // Update house stocks: add purchased stocks to existing stocks
                    const newHouseStocks = {
                        wheat: (currentHouseStocks.wheat || 0) + wheatToBuy,
                        carrot: (currentHouseStocks.carrot || 0) + carrotToBuy,
                        cabbage: (currentHouseStocks.cabbage || 0) + cabbageToBuy,
                    };
                    // Calculate total food as sum of all types
                    newHouseStocks.food = newHouseStocks.wheat + newHouseStocks.carrot + newHouseStocks.cabbage;

                    console.log('[FoodDistributionService] House buying stocks:', {
                        houseId,
                        iteration,
                        wheatBought: wheatToBuy,
                        carrotBought: carrotToBuy,
                        cabbageBought: cabbageToBuy,
                        totalBought: wheatToBuy + carrotToBuy + cabbageToBuy,
                        currentStocks: currentHouseStocks,
                        newHouseStocks: newHouseStocks,
                        remainingMarketStocks: {
                            wheat: remainingWheat,
                            carrot: remainingCarrot,
                            cabbage: remainingCabbage
                        }
                    });

                    // Wait for this update to complete before continuing (prevents race conditions)
                    const updatePromise = housesStore.updateHouseFields(houseId, { stocks: newHouseStocks }).then(async () => {
                        console.log('[FoodDistributionService] Successfully updated house stocks:', {
                            houseId,
                            stocks: newHouseStocks
                        });
                        
                        // Enregistrer les transactions marché → maison
                        if (window.foodTraceabilityService) {
                            const timeInfo = TimeManager.getTimeInfo(time);
                            const marketData = await housesStore.getHouse(marketId);
                            const houseData = await housesStore.getHouse(houseId);
                            
                            if (marketData && houseData) {
                                if (wheatToBuy > 0) {
                                    await window.foodTraceabilityService.recordMarketToHouse(
                                        timeInfo.turn || 0,
                                        timeInfo.monthIndex || 0,
                                        timeInfo.year || 0,
                                        { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                        { id: houseId, x: houseData.x, y: houseData.y, type: houseData.type },
                                        'wheat',
                                        wheatToBuy,
                                        1 // Prix par panier
                                    );
                                }
                                if (carrotToBuy > 0) {
                                    await window.foodTraceabilityService.recordMarketToHouse(
                                        timeInfo.turn || 0,
                                        timeInfo.monthIndex || 0,
                                        timeInfo.year || 0,
                                        { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                        { id: houseId, x: houseData.x, y: houseData.y, type: houseData.type },
                                        'carrot',
                                        carrotToBuy,
                                        1 // Prix par panier
                                    );
                                }
                                if (cabbageToBuy > 0) {
                                    await window.foodTraceabilityService.recordMarketToHouse(
                                        timeInfo.turn || 0,
                                        timeInfo.monthIndex || 0,
                                        timeInfo.year || 0,
                                        { id: marketId, x: marketData.x, y: marketData.y, type: marketData.type },
                                        { id: houseId, x: houseData.x, y: houseData.y, type: houseData.type },
                                        'cabbage',
                                        cabbageToBuy,
                                        1 // Prix par panier
                                    );
                                }
                            }
                        }
                    }).catch(err => {
                        console.warn('[FoodDistributionService] Failed to update house stocks:', {
                            houseId,
                            error: err?.message || err
                        });
                    });
                    
                    iterationUpdates.push(updatePromise);
                    allUpdatePromises.push(updatePromise);

                    // Count what was actually distributed
                    totalWheatDistributed += wheatToBuy;
                    totalCarrotDistributed += carrotToBuy;
                    totalCabbageDistributed += cabbageToBuy;
                } catch (err) {
                    console.warn('[FoodDistributionService] Failed to get house data:', {
                        houseId,
                        error: err?.message || err
                    });
                }
            }
            
            // Wait for all updates in this iteration to complete before next iteration
            // This ensures we read fresh data in the next iteration
            await Promise.allSettled(iterationUpdates);
            
            // If no stocks were bought this iteration, stop
            if (!stocksBoughtThisIteration) {
                break;
            }
        }
        
        console.log('[FoodDistributionService] Distribution iterations completed:', {
            marketId,
            iterations: iteration,
            housesProcessed: houses.length,
            totalWheatDistributed,
            totalCarrotDistributed,
            totalCabbageDistributed
        });

        // Wait for all house updates to complete
        await Promise.allSettled(allUpdatePromises);

        console.log('[FoodDistributionService] Distribution complete:', {
            marketId,
            totalWheatDistributed,
            totalCarrotDistributed,
            totalCabbageDistributed,
            housesUpdated: allUpdatePromises.length
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
