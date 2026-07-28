import { SimService } from './SimService.js';
import { hasRoadAccessFromCount, toBuildingIdString } from '../../acl/parcels.js';
import { createSupplyContext, toSupplySeason } from '../../acl/supply.js';
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

            // Update isBuying flag for all markets based on season (Supply BC)
            const supply = createSupplyContext({ housesStore });
            const season = toSupplySeason(timeInfo.season);
            if (season) {
                await supply.markBuyingSeason(season);
            }

            // Process each market: Farm → Market → House
            for (const market of markets) {
                await this.processMarket(market, housesStore, houses, time);
            }

            // After processing all markets, update houses that are too far from any market
            await this.updateHousesMarketDistanceStatus(housesStore);
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
        
        const marketData = await housesStore.getHouse(marketId);
        if (!marketData) {
            console.warn('[FoodDistributionService] Market not found in database:', marketId);
            return;
        }

        if (!hasRoadAccessFromCount(marketData.roads)) {
            // Market has no road access - CANNOT receive food from farms OR distribute to houses
            return;
        }

        // Check if market has workers (REQUIRED for operation)
        const marketEmployees = marketData.employees || { worker: 0, worker_need: 0 };
        const marketWorkers = marketEmployees.worker || 0;
        const marketWorkerNeed = marketEmployees.worker_need || 0;
        const hasNoWorkers = marketWorkers === 0 && marketWorkerNeed > 0;
        
        if (hasNoWorkers) {
            // Market has no workers - CANNOT receive food from farms OR distribute to houses
            return;
        }

        // Separate neighbors into farms and houses
        const neighbors = marketData.neighbors || [];
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

        console.info('[FoodDistributionService] Market neighbors:', {
            marketId,
            farmsNearby: farmsNearby.length,
            marketHouses: marketHouses.length,
            farmNeighbors: farmsNearby.map(f => ({
                id: f.id,
                name: f.name,
                buildingId: f.buildingId,
                x: f.x,
                y: f.y,
                constructedId: (f.x !== undefined && f.y !== undefined && f.name) ? toBuildingIdString(f.name, f.x, f.y) : null
            })),
            houseNeighbors: marketHouses.map(h => ({
                id: h.id,
                name: h.name,
                buildingId: h.buildingId,
                x: h.x,
                y: h.y,
                constructedId: (h.x !== undefined && h.y !== undefined && h.name) ? toBuildingIdString(h.name, h.x, h.y) : null
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
        }

        // Step 2: Distribute food from market to houses within distance (Market → House)
        // Use distance-based distribution instead of just neighbors
        // IMPORTANT: Pass time parameter so houses don't buy in autumn
        const housesInRange = this.findHousesInRange(marketData, allHouses);
        
        if (housesInRange.length > 0) {
            await this.distributeFoodToHouses(marketId, housesInRange, housesStore, time);
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

            if (!hasRoadAccessFromCount(house.roads)) {
                return false;
            }

            return true;
        });

        return housesInRange;
    }

    /**
     * Marks houses outside market Manhattan range (`marketTooFar`) via Supply BC.
     *
     * @param {HousesStore} housesStore
     * @returns {Promise<void>}
     */
    async updateHousesMarketDistanceStatus(housesStore) {
        const supply = createSupplyContext({ housesStore });
        const outcome = await supply.updateMarketReach(this.foodDistributionDistance);

        console.info('[FoodDistributionService] Market reach via Supply BC:', {
            houses: outcome.houses,
            marketsWithRoad: outcome.marketsWithRoad,
            tooFar: outcome.tooFar,
            inRange: outcome.inRange,
            maxDistance: this.foodDistributionDistance,
        });
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
        const timeInfo = TimeManager.getTimeInfo(time);
        const season = toSupplySeason(timeInfo.season);
        const supply = createSupplyContext({ housesStore });

        const outcome = await supply.buyFromNearbyFarms(marketId, farms ?? [], season);

        if (!outcome.bought) {
            if (outcome.reason === 'not_buying_season') {
                console.info('[FoodDistributionService] Not autumn — markets buy only in autumn:', {
                    marketId,
                    month: timeInfo.month,
                    season: timeInfo.season,
                });
            }
            return;
        }

        // Legacy side effects: UI sales tracking + food traceability
        for (const transfer of outcome.transfers) {
            const farmData = await housesStore.getHouse(transfer.farmId);
            if (!farmData) continue;

            await this.trackFarmSaleToMarket(
                transfer.farmId,
                farmData,
                housesStore,
                timeInfo,
                transfer.crop,
                transfer.amount,
                marketId
            );

            if (window.foodTraceabilityService) {
                const marketData = await housesStore.getHouse(marketId);
                if (marketData) {
                    await window.foodTraceabilityService.recordFarmToMarket(
                        timeInfo.turn || 0,
                        timeInfo.monthIndex || 0,
                        timeInfo.year || 0,
                        {
                            id: transfer.farmId,
                            x: farmData.x,
                            y: farmData.y,
                            type: farmData.type,
                        },
                        {
                            id: marketId,
                            x: marketData.x,
                            y: marketData.y,
                            type: marketData.type,
                        },
                        transfer.crop,
                        transfer.amount,
                        1
                    );
                }
            }
        }

        console.info('[FoodDistributionService] Farm collection via Supply BC:', {
            marketId,
            totalBaskets: outcome.totalBaskets,
            transfers: outcome.transfers.length,
        });
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
        const timeInfo = TimeManager.getTimeInfo(time);
        const season = toSupplySeason(timeInfo.season);
        const supply = createSupplyContext({ housesStore });

        const outcome = await supply.distributeToHouses(marketId, houses ?? [], season);

        if (!outcome.distributed) {
            if (outcome.reason === 'not_distribution_season') {
                console.info('[FoodDistributionService] Autumn — houses do not buy from markets:', {
                    marketId,
                    month: timeInfo.month,
                    season: timeInfo.season,
                });
            } else if (outcome.reason === 'market_empty') {
                console.warn('[FoodDistributionService] Market has no food to distribute:', {
                    marketId,
                });
            } else {
                console.warn('[FoodDistributionService] Distribution skipped:', {
                    marketId,
                    reason: outcome.reason,
                    housesPassed: houses?.length ?? 0,
                });
            }
            return;
        }

        // Legacy side effect: food traceability (grouped by house+crop)
        if (window.foodTraceabilityService) {
            const marketData = await housesStore.getHouse(marketId);
            for (const transfer of outcome.transfers) {
                const houseData = await housesStore.getHouse(transfer.houseId);
                if (!marketData || !houseData) continue;

                await window.foodTraceabilityService.recordMarketToHouse(
                    timeInfo.turn || 0,
                    timeInfo.monthIndex || 0,
                    timeInfo.year || 0,
                    {
                        id: marketId,
                        x: marketData.x,
                        y: marketData.y,
                        type: marketData.type,
                    },
                    {
                        id: transfer.houseId,
                        x: houseData.x,
                        y: houseData.y,
                        type: houseData.type,
                    },
                    transfer.crop,
                    transfer.amount,
                    1
                );
            }
        }

        console.info('[FoodDistributionService] Distribution via Supply BC:', {
            marketId,
            totalBaskets: outcome.totalBaskets,
            transfers: outcome.transfers.length,
        });
    }

    /**
     * Track farm sale to market (for display in farm info panel)
     * Records: month, turn, quantity, product type, market ID
     * @param {string} farmId - Farm ID
     * @param {Object} farmData - Farm data from IndexedDB
     * @param {HousesStore} housesStore - Database store
     * @param {Object} timeInfo - Time info object
     * @param {string} productType - Product type (wheat, carrot, cabbage)
     * @param {number} quantity - Quantity sold
     * @param {string} marketId - Market ID that bought
     */
    async trackFarmSaleToMarket(farmId, farmData, housesStore, timeInfo, productType, quantity, marketId) {
        try {
            // Initialize sales tracking if not exists
            const salesToMarket = farmData.salesToMarket || [];
            const salesToWindmill = farmData.salesToWindmill || [];
            
            // Add new sale record
            const saleRecord = {
                year: timeInfo.year || 0,
                month: timeInfo.monthIndex || 0,
                monthName: timeInfo.month || '',
                turn: timeInfo.turn || 0,
                productType: productType,
                quantity: quantity,
                marketId: marketId,
                date: new Date().toISOString()
            };
            
            salesToMarket.push(saleRecord);
            
            // Keep only current year's sales (reset annually)
            const currentYear = timeInfo.year || 0;
            const filteredSales = salesToMarket.filter(sale => sale.year === currentYear);
            
            await housesStore.updateHouseFields(farmId, {
                salesToMarket: filteredSales,
                salesToWindmill: salesToWindmill // Preserve windmill sales
            });
            
            console.info('[FoodDistributionService] Tracked farm sale to market:', {
                farmId,
                saleRecord
            });
        } catch (error) {
            console.warn('[FoodDistributionService] Error tracking farm sale to market:', {
                farmId,
                error: error?.message || error
            });
        }
    }
}
