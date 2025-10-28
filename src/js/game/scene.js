import * as THREE from 'three';
import {createCamera} from './camera.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {applyHoverColor, resetHoveredObject, resetObjectColor} from '../utils/meshUtils.js';
import {  textures  } from '../meshs/data.js'
import {
    makeDbItemId,
    getBuildingsNamesInZone,
    updateBuildingNeighbors,
} from "../utils/utils.js";
import {
    bulldozeSelected,
    commerce,
    delayBox,
    displayDelayUI,
    firstHouses,
    gameWindow,
    houses,
    palaces
} from '../ui/nodes.js';
import {assetsPrices} from "../meshs/data.js";

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

export function createScene(housesStore, gameStore, assetManager) {
    // BudgetManager will be set by the game initialization

    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x79845);

    let skyLoader = new THREE.TextureLoader();
    skyLoader.load(
        // URL of the image
        SKY_URL,
        function (texture) {
            // Set the scene's background to the loaded texture
            scene.background = texture;
        }
    );

    const camera = createCamera(gameWindow);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const controls = new OrbitControls(camera.camera, renderer.domElement);
    gameWindow.appendChild(renderer.domElement);

    // Selections d'un objet
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedObject = undefined;
    // Référence une fonction appelée si un objet est sélectionné
    let onObjectSelected = undefined;

    //  Variables de items
    let terrain = [];
    let buildings = [];
    let loadingPromises = [];

    // Variables de gameplay
    let delay = 0;

    async function initialize(city) {
        scene.clear();
        terrain = [];
        buildings = [];
        loadingPromises = [];

        // Wait for all terrain to be created
        for(let x = 0; x < city.size; x++) {
            let column = [];
            for(let y = 0; y < city.size; y++) {
                // Grass
                const terrainId = city.tiles[x][y].terrainId;
                const mesh = assetManager.createAsset(terrainId, x, y);
                mesh.name = terrainId;
                scene.add(mesh);
                column.push(mesh);  
            }
            terrain.push(column);
            
            // create empty array for buildings : an array of undefined values
            buildings.push([...Array(city.size)]);
            setUpLights(city.size);
        }

        // Update population and funds display in general bar
        const displayPop = document.querySelector('.display-pop');
        const displayFunds = document.querySelector('.display-funds');
        if (displayPop) {
            displayPop.textContent = '0';
        }
        if (displayFunds) {
            displayFunds.textContent = '0';
        }
        
        // Hide the entire expenses box to avoid confusion
        const debtBox = document.querySelector('.debt-box');
        if (debtBox) {
            debtBox.style.display = 'none';
        }

        // Wait for any remaining promises to complete
        if (loadingPromises.length > 0) {
            await Promise.all(loadingPromises);
        }

        // Add a small delay to ensure all rendering is complete
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async function update(city, time=0) {

        // Time turn processing
        const gamePlayVersion = 'gameplay_' + time
        const totalPop = await housesStore.getGlobalPopulation();
        let totalImmoExpenses = 0;
        
        // Get budget data from BudgetManager (single source of truth)
        let budgetData = null;
        if (window.budgetManager) {
            budgetData = await window.budgetManager.getCurrentBudget();
        }
        
        totalImmoExpenses = await housesStore.getGlobalBuildingPrices() || 0

        const infoGameplay = {
            name: time === 0 ? 'gameplay_init' : gamePlayVersion,
            turn: time,
            population: totalPop ? totalPop : 0,
            maxPop: 5000,
            deads: 0,
            foodAvailable: 0,
            foodNeeded: 0,
            salaries: 0,
            salesTax: 0.2,
            citizenTax: 0.2,
            markets: 0,
            foodMarkets: 0,
            goodsMarkets: 0,
            goodsNeeded: 0,
            goodsAvailable: 0,
            foodSales: 0,
            goodSales: 0,
            lastImmoExpense: totalImmoExpenses || 0,
            // Remove budget fields from game table - they're now in budget table
            // debt: debts,     // ← Removed
            // funds: funds     // ← Removed
        }

            await gameStore.clearGameItems();
            await gameStore.addGameItems(infoGameplay);

        // --- BOUCLE SUR LA VILLE ----

        // Define status icons metadata for all buildings
        const statutsIconsMeta = {
            road: {
                position : {x: -1, y: 1, z: 1},
                scale : {x: 1.2, y: 1.2, z: 1}
            },
            food: {
                position : {x: -0.5, y: 1, z: 0},
                scale : {x: 1.0, y: 1.0, z: 1}
            }
        };

        for(let x = 0; x < city.size; x++) {
            for(let y = 0; y < city.size; y++) {
                // Processing city tile
              let currentBuildingId = buildings[x][y]?.userData?.type || buildings[x][y]?.userData?.id;
              const currentBuilding = buildings[x][y];
              const newBuildingId = city.tiles[x][y].buildingId;
              const buildingInfo =  city.tiles[x][y];

              // Check bounds for neighbor processing (avoid accessing out-of-bounds neighbors)
              const isInCityLimits = x >= 0 && x < city.size && y >= 0 && y < city.size;
              // Check if building is on edge (need special handling for neighbors)
              const isOnEdge = x === 0 || x === city.size - 1 || y === 0 || y === city.size - 1;

              if(currentBuildingId && isInCityLimits) {
                const currentUniqueID =  makeDbItemId(currentBuildingId, x, y)
                // Skip if makeDbItemId returned false (invalid building ID or coordinates)
                if(!currentUniqueID) {
                    continue;
                }
                await housesStore.updateHouseFields(currentUniqueID, {worldTime: time})

                /* update userData in indexDB === real userData state from three mesh */
                const currentUserData = buildings[x][y].userData
                // Building userData processing
                await housesStore.updateHouseFields(currentUniqueID, {})



                // Processing building: ${currentBuildingId}
                const buildingData = {
                    city,
                    buildings,
                    x,
                    y,
                    currentBuildingId,
                    currentUniqueID,
                    terrain
                };

                  updateBuildingNeighbors(buildingData, 1, time);
                  /** ALl buildings : create a neighbors array in indexDB **/
                  const allNeighborsWithinZone = getBuildingsNamesInZone(buildingData, time, {buildingTarget: "", zones:[1,2]})
                  const allMarketsInZone = getBuildingsNamesInZone(buildingData, time, {buildingTarget: "Market-Stall", zones:[1,2]})
                  await housesStore.updateHouseFields(currentUniqueID, {neighbors: allNeighborsWithinZone})
                  await housesStore.updateHouseFields(currentUniqueID, {markets: allMarketsInZone})

                //  Remove a building from the scene if a player remove a building
                if(!newBuildingId && currentBuildingId) {
                    if(bulldozeSelected.classList.contains('selected') && currentBuildingId) {
                        const uniqueBuildingId = makeDbItemId(currentBuildingId, x, y);
                        if(houses.includes(currentBuildingId)) {
                            await housesStore.deleteOneHouse(uniqueBuildingId)
                        } else if(currentBuildingId === 'roads') {
                            // Roads are now stored in database like other buildings
                            await housesStore.deleteOneHouse(uniqueBuildingId)
                        } else {
                            // Other building types (farms, markets, etc.)
                            await housesStore.deleteOneHouse(uniqueBuildingId)
                        }
                        scene.remove(buildings[x][y]);
                        buildings[x][y] = undefined;
                    }
                }

                // Skip all further processing if building was just removed
                if(!buildings[x][y]) {
                    // Building was removed (bulldozed), skip the rest
                    continue;
                }

                  /* utils for scene updates */
                  function calculateNetStocks(houseFood, housePop) {
                      if(houseFood > 0 && housePop > 0) {
                          const netFood = houseFood - housePop
                          return netFood > 0 ? netFood : 0;
                      }
                      return houseFood;
                  }


                /* Only for commerce buildings */
                if(commerce.includes(currentBuildingId)) {
                    const marketTime = { name: currentUniqueID, increment: 1, field: 'time' };
                    await housesStore.incrementHouseField(marketTime, false)

                    // Check road access for markets
                    const marketNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
                    if(marketNeighbors) {
                        const isRoad = marketNeighbors.filter(neighbor => neighbor.name === 'roads').length;
                        const MarketRoads = {roads : marketNeighbors.filter(neighbor => neighbor.name === 'roads').length};
                        await housesStore.updateHouseFields(currentUniqueID, MarketRoads);
                        
                        // Adjust icon scale for markets (smaller than houses)
                        const marketRoadScale = {
                            x: statutsIconsMeta.road.scale.x * 0.714, // 0.5/0.7 ratio
                            y: statutsIconsMeta.road.scale.y * 0.714,
                            z: statutsIconsMeta.road.scale.z * 0.714
                        };
                        
                        if(isRoad > 0 && buildings[x][y]) {
                            // Market has road access
                            assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                                marketRoadScale, statutsIconsMeta.road.position, false);
                        } else if(buildings[x][y]) {
                            // Market has no road access
                            assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                                marketRoadScale, statutsIconsMeta.road.position, true);
                        }
                    } else if(buildings[x][y]) {
                        // Market has no neighbors (no road access)
                        const marketRoadScale = {
                            x: statutsIconsMeta.road.scale.x * 0.714, // 0.5/0.7 ratio
                            y: statutsIconsMeta.road.scale.y * 0.714,
                            z: statutsIconsMeta.road.scale.z * 0.714
                        };
                        assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                            marketRoadScale, statutsIconsMeta.road.position, true);
                    }

                    /**
                     * Update market stocks of food in userData and in DB
                     * @param buildings
                     * @param housesStore
                     * @param datas
                     * @returns {Promise<void>}
                     */
                    async function updateMarketStocks(buildings, housesStore, datas = [{key: "", number: 0, decrease: false}]) {

                        if(!buildings) {
                            return;
                        }

                        if(!housesStore) {
                            return;
                        }

                        if(Array.isArray(datas) && datas.length <= 0) {
                            return;
                        }

                        // Initialize stocks if they don't exist - get from database first
                        if (!buildings[x][y].userData.stocks) {
                            const existingStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                            buildings[x][y].userData.stocks = existingStocks || {
                                food: 0,
                                cabbage: 0,
                                wheat: 0,
                                carrot: 0
                            };
                        }

                        // Update userData food
                        datas.filter(data => !data.decrease).forEach((data) => {
                            if (buildings[x][y].userData.stocks[data.key] !== undefined) {
                                buildings[x][y].userData.stocks[data.key] += data.number
                            }
                        })

                        datas.filter(data => data.decrease).forEach((data) => {
                            if (buildings[x][y].userData.stocks[data.key] !== undefined) {
                                buildings[x][y].userData.stocks[data.key] -= data.number
                            }
                        })

                        // turn by turn values from userData need to be mirrored in indexDB using userData
                        const commerceUserData = {
                            stocks:
                                {
                                    food: buildings[x][y].userData.stocks.food || 0,
                                    carrot: buildings[x][y].userData.stocks.carrot || 0,
                                    cabbage: buildings[x][y].userData.stocks.cabbage || 0,
                                    wheat: buildings[x][y].userData.stocks.wheat || 0
                                }
                        }

                        await housesStore.updateHouseFields(currentUniqueID, commerceUserData)
                    }



                    const currentMarket = await housesStore.getHouse(currentUniqueID);
                    let marketHouses = [];
                    let farmsNearBy = [];

                    if(currentMarket) {
                        // Check if market has road access before processing
                        const hasRoadAccess = currentMarket.neighbors && currentMarket.neighbors.filter(neighbor => neighbor.name === 'roads').length > 0;
                        
                        if (hasRoadAccess) {
                            // Market has road access - process normally
                            farmsNearBy =  currentMarket?.neighbors.filter(neighbor => neighbor.name.includes("Farms"))
                            marketHouses = currentMarket?.neighbors.filter(neighbor => neighbor.name.includes("House"))

                            let carrotMarketStocks = 0;
                            let cabbageMarketStocks = 0;
                            let wheatMarketStocks = 0;

                            if(farmsNearBy.length > 0) {

                                farmsNearBy.forEach(farm => {
                                    if(farm.name.includes("Farms-Wheat")) {
                                        wheatMarketStocks++;
                                        // Wheat added to market stocks
                                    }
                                    if(farm.name.includes("Farms-Carrot")) {
                                        carrotMarketStocks++;
                                        // Carrot added to market stocks
                                    }
                                    if(farm.name.includes("Farms-Cabbage")) {
                                        cabbageMarketStocks++;
                                        // Cabbage added to market stocks
                                    }
                                })

                                const datas = [
                                    {key: 'cabbage', number:  carrotMarketStocks, decrease: false},
                                    {key: 'carrot', number:  cabbageMarketStocks, decrease: false},
                                    {key: 'wheat', number: wheatMarketStocks, decrease: false},
                                    {key: 'food', number: 3, decrease: false}
                                ]
                                await updateMarketStocks(buildings, housesStore, datas);
                            }
                        }

                            let carrotHousesStocks = 0;
                            let cabbageHousesStocks = 0;
                            let wheatHousesStocks = 0;
                            let wheatByHouse = 1;
                            let carrotByHouse = 1;
                            let cabbageByHouse = 1;
                            let totalHouseFood = wheatByHouse + carrotByHouse + cabbageByHouse;
                            for (const house of marketHouses) {
                                const buildingsUserData = buildings[house.x][house.y].userData
                                const newStocks = {food: totalHouseFood, carrot: carrotByHouse, cabbage: cabbageByHouse, wheat: wheatByHouse};
                                buildings[house.x][house.y].userData = {...buildingsUserData, stocks: newStocks};
                                
                                await housesStore.updateHouseFields(house.id, {stocks: newStocks});
                                
                                carrotHousesStocks += carrotByHouse;
                                cabbageHousesStocks += cabbageByHouse;
                                wheatHousesStocks += wheatByHouse;
                            }
                            const foodHousesStocks = cabbageHousesStocks + carrotHousesStocks + wheatHousesStocks;
                            const datas = [
                                {key: 'cabbage', number: cabbageHousesStocks, decrease: true},
                                {key: 'carrot', number: carrotHousesStocks, decrease: true},
                                {key: 'wheat', number: wheatHousesStocks, decrease: true},
                                {key: 'food', number: foodHousesStocks, decrease: true}
                            ]
                            await updateMarketStocks(buildings, housesStore, datas);
                        } else {
                            // Market has no road access - cannot distribute food
                        }
                    }

                //  only update if current building is a house or palace
                if((houses.includes(currentBuildingId) || palaces.includes(currentBuildingId)) && buildings[x][y]) {

                    // Initialize stocks if not present
                    if(!Object.hasOwn(buildings[x][y], 'userData') || !Object.hasOwn(buildings[x][y].userData, 'stocks')) {
                        buildings[x][y].userData = {
                            ...buildings[x][y].userData,
                            stocks: {food: 0, carrot: 0, cabbage: 0, wheat: 0}
                        };
                    }

                    // turn by turn values from userData need to be mirrored in indexDB
                    let valuesFromUserData = {}

                    if(buildings[x][y] && Object.hasOwn(buildings[x][y], 'userData') && Object.hasOwn(buildings[x][y].userData, 'stocks')) {
                        valuesFromUserData = {
                            stocks:
                                {
                                    food: buildings[x][y].userData.stocks.food,
                                    carrot: buildings[x][y].userData.stocks.carrot,
                                    cabbage: buildings[x][y].userData.stocks.cabbage,
                                    wheat: buildings[x][y].userData.stocks.wheat
                                }
                        }
                    }

                    await housesStore.updateHouseFields(currentUniqueID, valuesFromUserData)
                    const currentHouse = await housesStore.getHouse(currentUniqueID);

                    if(currentHouse) {
                        // Processing house data
                    }

                    if(time > 0) {
                        const HouseTime = { name: currentUniqueID, increment: 1, field: 'time' };
                        await housesStore.incrementHouseField(HouseTime, false)
                    }

                    // Check if house has food AND road access before allowing population growth
                    const houseFoodStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                    const houseNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
                    const hasFood = houseFoodStocks && houseFoodStocks.food > 0;
                    const hasRoadAccess = houseNeighbors && houseNeighbors.filter(neighbor => neighbor.name === 'roads').length > 0;
                    
                    if (hasFood && hasRoadAccess) {
                        // Has food AND road access - population can grow (max 2)
                        const housePop = { name: currentUniqueID, increment: 1, field: 'pop' };
                        await housesStore.incrementHouseField(housePop, {operator: '<=', limit: 2});
                    } else {
                        // No food OR no road access - reset population to 0
                        const currentPop = await housesStore.getHouseItem(currentUniqueID, 'pop');
                        if (currentPop > 0) {
                            await housesStore.updateHouseFields(currentUniqueID, { pop: 0 });
                        }
                    }

                    const houseTime = await housesStore.getHouseItem(currentUniqueID, 'time');
                    // House time processing

                    if(houseNeighbors) {
                        const isRoad = houseNeighbors.filter(neighbor => neighbor.name === 'roads').length
                        const HouseRoads = {roads : houseNeighbors.filter(neighbor => neighbor.name === 'roads').length};
                        await housesStore.updateHouseFields(currentUniqueID, HouseRoads)
                        
                        if(isRoad > 0 && buildings[x][y]) {
                            assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                                statutsIconsMeta.road.scale, statutsIconsMeta.road.position, false)
                        } else if(buildings[x][y]) {
                            assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                                statutsIconsMeta.road.scale, statutsIconsMeta.road.position, true)
                        }
                    } else if(buildings[x][y]) {
                        assetManager.setStatusSprite(buildings[x][y], textures['no-roads'], 'no-road',
                            statutsIconsMeta.road.scale, statutsIconsMeta.road.position, true)
                    }

                    /* house evolution to stage 2 */
                    const houseStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks')
                    const housePop = await housesStore.getHouseItem(currentUniqueID, 'pop')
                    const foodGoal = housePop > 2 && houseStocks.food > housePop * 2
                    const decay = houseTime > 3 && housePop >= 2 && houseStocks.food < housePop

                    if(houseStocks.food <= 0 && buildings[x][y]) {
                        assetManager.setStatusSprite(buildings[x][y], textures['nofood'], 'no-food', statutsIconsMeta.food.scale, statutsIconsMeta.food.position, true)
                    } else if(buildings[x][y]) {
                        assetManager.setStatusSprite(buildings[x][y], textures['nofood'], 'no-food', statutsIconsMeta.food.scale, statutsIconsMeta.food.position, false)
                    }
                    
                  
                    if(decay) {
                        assetManager.changeMeshColor(buildings[x][y],  0X404040)
                    }

                    if(houseTime > 3 && foodGoal && firstHouses.includes(currentBuildingId)) {
                        scene.remove(buildings[x][y]);
                        const newUniqueBuildingId = makeDbItemId('House-2Story', x, y);
                        const keys = { type : "House-2Story", price: assetsPrices["House-2Story"].price}
                        await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                        await housesStore.deleteOneHouse(currentUniqueID);
                        buildings[x][y] = assetManager.createAsset('House-2Story', x, y);
                        scene.add(buildings[x][y]);
                    }

                }
          
              }

                  // if data model has changed as user add a new building, update the mesh 
            if(newBuildingId && (newBuildingId !== currentBuildingId)) {
                // Check if this is the origin tile for multi-tile buildings
                // We only create a building at the origin (top-left) tile
                const buildingData = assetsPrices[newBuildingId];
                const gridSize = buildingData?.gridSize || 1;
                
                let isOriginTile = true;
                if (gridSize > 1) {
                    // Check if there's already a building at (x-1, y) or (x, y-1) with the same ID
                    // If yes, this is NOT the origin tile
                    if ((x > 0 && city.tiles[x-1][y].buildingId === newBuildingId) ||
                        (y > 0 && city.tiles[x][y-1].buildingId === newBuildingId)) {
                        isOriginTile = false;
                    }
                }
                
                // Only create the mesh if this is the origin tile
                if (isOriginTile) {
                    //remove the initial building if needed
                    let isExistingBuilding;
                    if(currentBuildingId) {
                        isExistingBuilding = housesStore.getHouse(currentBuildingId);
                    }

                    // Checking building existence
                    if(!isExistingBuilding) {
                        scene.remove(buildings[x][y]);
                        buildings[x][y] = assetManager.createAsset(newBuildingId, x, y);
                        scene.add(buildings[x][y]);
                    }

                    // Add the new building
                }
                }

            }

        }

        // Gestion de la barre des délais
        if(delayBox && displayDelayUI) {
            if(delay > 0 && delay < 80) {
                delayBox.style.opacity = 1
                displayDelayUI.textContent += '****'
            } else {
                delayBox.style.opacity = 0.5
                displayDelayUI.textContent += ''
            }
        }

        // Calculate building counts for budget operations
        let buildingCounts = {
            houses: 0,
            farms: 0,
            markets: 0,
            roads: 0,
            total: 0
        };
        
        for(let x = 0; x < city.size; x++) {
            for(let y = 0; y < city.size; y++) {
                const building = buildings[x][y];
                if (building && building.userData && building.userData.type) {
                    const type = building.userData.type;
                    if (type.includes('House')) buildingCounts.houses++;
                    else if (type.includes('Farm')) buildingCounts.farms++;
                    else if (type.includes('Market')) buildingCounts.markets++;
                    else if (type.includes('roads')) buildingCounts.roads++;
                    buildingCounts.total++;
                }
            }
        }

        // Daily budget operations - expenses and income
        try {
            if (window.budgetManager) {
                // Add taxes (10€ per citizen per turn)
                if (totalPop > 0) {
                    await window.budgetManager.addTaxes(totalPop);
                }
                
                // Add building maintenance expenses only
                const buildingAmount = buildingCounts.total * 2; // Building maintenance cost
                if (buildingAmount > 0) {
                    await window.budgetManager.addBuildingMaintenance(buildingAmount);
                }
                
                // Process population/food logic
                if (window.housesStore) {
                    const populationResult = await window.housesStore.processPopulationFoodLogic();
                    if (populationResult.totalPopulationLost > 0) {
                        console.warn(`⚠️ ${populationResult.message}`);
                    }
                }
                
                // Update turn
                await window.budgetManager.updateTurn(time);
                
                // Process loan payments BEFORE saving budget state
                if (window.processLoanPayments) {
                    await window.processLoanPayments();
                }
                
                // Save budget state every 3 turns (AFTER loan payments)
                if (time % 3 === 0 && time > 0) {
                    try {
                        const additionalData = {
                            population: totalPop,
                            buildingCounts: buildingCounts
                        };
                        
                        await window.budgetManager.saveBudgetState(time, additionalData);
                        
                        // Clean up old states by age (60+ days)
                        const cleanupResult = await window.budgetManager.cleanupOldBudgetStatesByAge();
                        if (cleanupResult.deleted > 0) {
                            // Show notification to user only once
                            showCleanupNotificationOnce(cleanupResult);
                        }
                    } catch (error) {
                        console.warn('Failed to save budget state:', error);
                    }
                }
            }
        } catch (error) {
            console.warn('Budget operations failed:', error);
        }

        //  Display results in UI
        // Display elements removed - using real-time budget panel instead
        const gameItems = await gameStore.listAllGameItems()

        gameItems.filter(item => item).forEach(async (item) => {
            // Processing game item
            const {
                name,
                turn,
                population,
                maxPop,
                deads,
                foodAvailable,
                foodNeeded,
                salaries,
                salesTax,
                citizenTax,
                markets,
                foodMarkets,
                goodsMarkets,
                goodsNeeded,
                goodsAvailable,
                foodSales,
                goodSales,
                lastImmoExpense
            } = item;

            // Get budget data from BudgetManager instead of game table
            let funds = 0;
            if (window.budgetManager) {
                const budgetData = await window.budgetManager.getCurrentBudget();
                funds = budgetData.funds;
            }

            // Update population and funds display in general bar
            const displayPop = document.querySelector('.display-pop');
            const displayFunds = document.querySelector('.display-funds');
            if (displayPop) {
                displayPop.textContent = population.toString();
            }
            if (displayFunds) {
                displayFunds.textContent = funds.toString();
            }
        })

        // End turn processing

    }

    function setUpLights(citySize) {
        // Setting up lights for city

        // Use the derived formula for light intensity
        const b = Math.log10(0.1) / Math.log10(2); // Exponent
        const a = 0.03 / Math.pow(16, b); // Coefficient
        const c = 0.05 / Math.pow(16, b);

        const AmbientLightIntensity = a * Math.pow(citySize, b);
        const DirectionalLightIntensity = c * Math.pow(citySize, b);

        // Light intensity calculated
        const lights = [
            new THREE.AmbientLight(0xffffff, AmbientLightIntensity),
            new THREE.DirectionalLight(0x999999, DirectionalLightIntensity),
            new THREE.DirectionalLight(0x999999, DirectionalLightIntensity),
            new THREE.DirectionalLight(0x999999, DirectionalLightIntensity),
        ];

        // Set up directional lights
        lights[1].position.set(0, 1, 0);
        lights[2].position.set(0, 1, 0);
        lights[3].position.set(0, 1, 0);

        // Configure shadows for the first directional light
        lights[1].shadow.camera.left = -10;
        lights[1].shadow.camera.right = 10;
        lights[1].shadow.camera.top = 0;
        lights[1].shadow.camera.bottom = -10;
        lights[1].shadow.mapSize.width = 1024;
        lights[1].shadow.mapSize.height = 1024;
        lights[1].shadow.camera.near = 0.5;
        lights[1].shadow.camera.far = 50;

        // Add lights to the scene
        scene.add(...lights);

        // Add a hemisphere light
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.1);
        hemiLight.position.set(0, 50, 0);
        scene.add(hemiLight);
    }


    function draw() {
        renderer.render(scene, camera.camera);
    }

    function start() {
        renderer.setAnimationLoop(draw);
    }

    function stop(){
        renderer.setAnimationLoop(null);
    }

    let hoveredObject = null
    let hoveredObjectName = null
    const objectsNames = ['grass', 'roads', 'House-Red', 'House-Purple', 'House-Blue', 'Market-Stall']

    function onMouseDown(event){
        // Block interaction if a popup is open
        if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
            return;
        }
        
        camera.onMouseDown(event);
        // Raycasting need y and x axis as + on the terrain (plan) (y-1,y1,x1,x-1)
        mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera.camera);
        // all children of the scene (all objects) and recursive = true (all children of the children)
        // @return {Array} An array of intersections, which are objects containing distance, point, face, faceIndex, and object fields.
        // The clossest object is the first one in the array
        let intersections = raycaster.intersectObjects(scene.children, false);
        // if any intersection where found (if the array is not empty)
        if(intersections.length > 0) {
            // get the first object (the intersection) of the array of intersections
            // Processing intersection
            // if(selectedObject) selectedObject.material.emissive.setHex(0);
            selectedObject = intersections[0].object;
            // if(selectedObject.material.length !== undefined) {
               
            // }
            // Object selected

            if(this.onObjectSelected) {
                this.onObjectSelected(selectedObject);
            }
        }
    }

    function onMouseUp(event){
        // Block interaction if a popup is open
        if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
            return;
        }
        
        camera.onMouseUp(event);
    }

function onMouseMove(event) {
    // Block interaction if a popup is open
    if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
        return;
    }
    
    camera.onMouseMove(event);

    // Update the mouse coordinates for raycasting
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    // Perform raycasting
    raycaster.setFromCamera(mouse, camera.camera);
    const intersections = raycaster.intersectObjects(scene.children, false);

    if(intersections.length) {
        // Mouse move intersection
        hoveredObjectName = intersections[0]?.object?.name || ""
    }
}


 function handleHover(intersections, hexColor, objectName="roads") {
    if (intersections.length > 0) {
        const intersectedObject = intersections[0].object;

        // Check if the intersected object is the one we want to interact with
        if (intersectedObject.name === objectName) {

            // If the hovered object has changed
            if (hoveredObject !== intersectedObject) {
                // Handling hover object
                if (hoveredObject) {
                    resetObjectColor(hoveredObject);
                }

                hoveredObject = intersectedObject;
                applyHoverColor(hoveredObject, hexColor, objectName);
            }
        } else {
            resetHoveredObject(hoveredObject);
        }


    } else {
        resetHoveredObject(hoveredObject);
    }
}





    function onKeyBoardDown(event){

        camera.onKeyBoardDown(event);
        // Raycasting need y and x axis as + on the terrain (plan) (y-1,y1,x1,x-1)
        // (number btw 0 and 1) * 2 - 1 > to get the value between -1 and 1
        mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera.camera);
        // array of object > all objects from our scene that intersect with the ray (false = non recursive = only the first object)
        // array of intersections sorted by distance with the closest object 
        const intersections = raycaster.intersectObjects(scene.children, false);
    
        if(intersections.length > 0) {
            // get the first object (the intersection) of the array of intersections
            const selected = intersections[0].object;
            if(selected) {
                // Material selected
            }
            // selected.material.emissive.setHex(0xff0000);
            // Object selection complete
        }

    }

    function onKeyBoardUp(event){
        camera.onKeyBoardUp(event);
    }

    /**
     * Show cleanup notification to user only once
     * @param {Object} cleanupResult - Result from cleanupOldBudgetStatesByAge
     */
    function showCleanupNotificationOnce(cleanupResult) {
        // Check if user has already seen this notification
        const hasSeenCleanupNotification = localStorage.getItem('hasSeenCleanupNotification');
        
        if (hasSeenCleanupNotification === 'true') {
            // User has already seen this notification, don't show it again
            return;
        }
        
        // Mark that user has seen this notification
        localStorage.setItem('hasSeenCleanupNotification', 'true');
        
        // Show the notification
        showCleanupNotification(cleanupResult);
    }

    /**
     * Show cleanup notification to user
     * @param {Object} cleanupResult - Result from cleanupOldBudgetStatesByAge
     */
    function showCleanupNotification(cleanupResult) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'cleanup-notification';
        notification.innerHTML = `
            <div class="cleanup-content">
                <div class="cleanup-icon">🧹</div>
                <div class="cleanup-text">
                    <strong>Nettoyage automatique</strong><br>
                    Les états financiers de plus de 60 jours seront supprimés
                    ${cleanupResult.deletedTurns ? `<br><small>Tours: ${cleanupResult.deletedTurns.join(', ')}</small>` : ''}
                </div>
                <button class="cleanup-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // make the game know the object userData I selected (to reach x and y position of the object or its id from asset
    return {
        onObjectSelected,
        initialize,
        update,
        start,
        onMouseDown,
        onMouseUp,
        onMouseMove, 
        onKeyBoardDown,
        onKeyBoardUp,
        delay
    }
}