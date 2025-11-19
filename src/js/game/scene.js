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
import { checkRoadAccess, checkFoodAvailability } from './modules/ModuleHelper.js';
import { setRoadAccessIcon } from './modules/StatusIconHelper.js';
import config from './config.js';

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

export function createScene(housesStore, gameStore, assetManager) {
    // BudgetManager will be set by the game initialization

    const scene = new THREE.Scene();
    // Subtle atmospheric fog to blend far terrain and sky (tuned to match background)
    try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}
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
    
    // Add WebGL error handling
    const canvas = renderer.domElement;
    
    // Handle WebGL context lost (indicates insufficient GPU resources)
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.error('[WebGL] Context lost - this may indicate insufficient GPU resources');
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'building-notification webgl-error';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🔴</div>
                <div class="notification-text">
                    <div class="notification-title">Erreur WebGL</div>
                    <div class="notification-message">Le contexte WebGL a été perdu. Cela indique que votre système manque de ressources GPU. Veuillez réduire la taille de la ville ou fermer d'autres applications.</div>
                </div>
            </div>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(211, 47, 47, 0.3);
            z-index: 10002;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 500px;
            animation: slideDown 0.3s ease-out;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        document.body.appendChild(notification);
    });
    
    // Handle WebGL context restored
    canvas.addEventListener('webglcontextrestored', () => {
        console.log('[WebGL] Context restored');
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Ensure canvas allows touch events on mobile
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.pointerEvents = 'auto';
    
    // ORIGINAL ANORIA RENDERER SHADOW SETUP (restored exactly)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const controls = new OrbitControls(camera.camera, renderer.domElement);
    // Disable OrbitControls so custom camera controls handle input
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    
    // Update OrbitControls camera reference when camera mode toggles
    camera.setOnCameraChanged((newCamera) => {
        controls.object = newCamera;
        controls.update();
    });
    gameWindow.appendChild(renderer.domElement);
    
    // Helper function to check if info modal is open
    function isInfoModalOpen() {
        const infoOverlay = document.querySelector('.info-building-overlay');
        return infoOverlay && infoOverlay.classList.contains('active');
    }

    // Selections d'un objet
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedObject = undefined; // Object that is currently selected (clicked)
    let focusedObject = undefined; // Object currently under cursor (hover)
    // Référence une fonction appelée si un objet est sélectionné
    let onObjectSelected = undefined;

    // Suppress scene input for a short time (e.g., just after closing a modal)
    let suppressInputUntilMs = 0;
    function suppressInput(ms = 200) {
        suppressInputUntilMs = performance.now() + ms;
        // Ensure any drag states are cleared
        camera.onMouseUp({ button: 0 });
        camera.onMouseUp({ button: 1 });
        camera.onMouseUp({ button: 2 });
    }

    // Touch tracking for tap vs drag detection
    let touchStartPos = null;
    let touchStartObject = null;
    let touchHasMoved = false;
    let cameraTouchInitialized = false; // Track if we've initialized camera for this touch
    const TAP_THRESHOLD = 10; // pixels - movement below this is considered a tap

    function getPointerClientXY(event) {
        if (window.inputManager && window.inputManager.mouse) {
            return { x: window.inputManager.mouse.x, y: window.inputManager.mouse.y };
        }
        return { x: event.clientX, y: event.clientY };
    }

    //  Variables de items
    let terrain = [];
    let buildings = [];
    let loadingPromises = [];
    
    // OPTIMIZATION: Create a separate group for interactive objects (buildings + terrain)
    // This allows raycasting to test only relevant objects instead of all scene children
    const interactiveGroup = new THREE.Group();
    interactiveGroup.name = 'interactive-objects';
    scene.add(interactiveGroup);

    // Variables de gameplay
    let delay = 0;

    async function initialize(city) {
        scene.clear();
        // Re-apply fog after clear
        try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}
        terrain = [];
        buildings = [];
        loadingPromises = [];
        
        // Recreate interactive group after scene.clear()
        const existingGroup = scene.getObjectByName('interactive-objects');
        if (existingGroup) {
            scene.remove(existingGroup);
        }
        const newInteractiveGroup = new THREE.Group();
        newInteractiveGroup.name = 'interactive-objects';
        scene.add(newInteractiveGroup);
        // Update reference
        Object.defineProperty(scene, 'interactiveGroup', {
            value: newInteractiveGroup,
            writable: true,
            configurable: true
        });

        // Wait for all terrain to be created
        const interactiveGroupRef = scene.interactiveGroup || scene.getObjectByName('interactive-objects');
        for(let x = 0; x < city.size; x++) {
            let column = [];
            for(let y = 0; y < city.size; y++) {
                // Grass
                const terrainId = city.tiles[x][y].terrainId;
                const mesh = assetManager.createAsset(terrainId, x, y);
                mesh.name = terrainId;
                // Add to scene AND interactive group for raycasting optimization
                scene.add(mesh);
                if (interactiveGroupRef) {
                    interactiveGroupRef.add(mesh);
                }
                column.push(mesh);  
            }
            terrain.push(column);
            
            // create empty array for buildings : an array of undefined values
            buildings.push([...Array(city.size)]);
        }
        
        // CRITICAL FIX: Set up lights ONCE after terrain is created, not in the loop
        // Previously this was called 16 times for a 16×16 city, creating 80 lights!
        // This was causing severe performance issues on low-end machines.
        setUpLights(city.size);

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

        // Set camera bounds based on city size (with small margins)
        if (camera.setBounds && city && typeof city.size === 'number') {
            const margin = 2;
            camera.setBounds({
                minX: -margin,
                maxX: city.size + margin,
                minZ: -margin,
                maxZ: city.size + margin
            });
            
            // Center camera on the city (critical for proper raycasting coordinates)
            // This ensures clicks/touches align correctly with terrain tiles
            // City center is at (city.size / 2, city.size / 2)
            if (camera.centerOnCity) {
                camera.centerOnCity(city.size);
            }
        }

        // Add infinite backdrop (skydome + distant ground ring)
        addBackdrop();
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
              // Also check terrain for roads using isRoad property (roads are in terrain array but may be in buildings array too)
              if (!currentBuildingId && terrain[x] && terrain[x][y] && (terrain[x][y].userData?.isRoad || terrain[x][y].name === 'roads')) {
                  currentBuildingId = 'roads';
                  // Ensure road is in buildings array for neighbor detection
                  if (!buildings[x][y]) {
                      buildings[x][y] = terrain[x][y];
                  }
              }
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
                        removeInteractiveObject(buildings[x][y]);
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

                    // Check road access for markets (using module helper, DB remains source of truth)
                    const marketNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
                    // Adjust icon scale for markets (smaller than houses)
                    const marketRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714, // 0.5/0.7 ratio
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714
                    };

                    if (marketNeighbors && buildings[x][y]) {
                        const { hasAccess, roadCount } = checkRoadAccess(marketNeighbors);
                        await housesStore.updateHouseFields(currentUniqueID, { roads: roadCount });

                        setRoadAccessIcon({
                            assetManager,
                            mesh: buildings[x][y],
                            textures,
                            position: statutsIconsMeta.road.position,
                            scale: marketRoadScale,
                            hasAccess
                        });
                    } else if (buildings[x][y]) {
                        // No neighbors → treat as no road access
                        setRoadAccessIcon({
                            assetManager,
                            mesh: buildings[x][y],
                            textures,
                            position: statutsIconsMeta.road.position,
                            scale: marketRoadScale,
                            hasAccess: false
                        });
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



                    // Food distribution (Farm > Market > House) is now handled by FoodDistributionService
                    // Service runs before scene.update() and processes all markets city-wide using IndexedDB
                    // This ensures consistent food distribution logic across the entire city
                    // The service: collects from farms → adds to market stocks → distributes to houses
                    
                    // Market processing disabled here - FoodDistributionService handles it:
                    // - Farm collection and market stock updates
                    // - House food distribution
                    // - Market stock decreases after distribution
                    // All using IndexedDB as source of truth
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

                    // IMPORTANT: IndexedDB is the source of truth for stocks
                    // FoodDistributionService updates IndexedDB first, then we read from it
                    // DO NOT write userData.stocks back to IndexedDB - it would overwrite service updates!
                    
                    // Removed old code that wrote userData.stocks to IndexedDB:
                    // This was causing the service's updates to be overwritten
                    // The service writes: stocks = {wheat: 0, carrot: 1, cabbage: 0, food: 1}
                    // Then this code was reading empty userData.stocks and overwriting IndexedDB with 0s!

                    if(time > 0) {
                        const HouseTime = { name: currentUniqueID, increment: 1, field: 'time' };
                        await housesStore.incrementHouseField(HouseTime, false)
                    }

                    // Check if house has food AND road access before allowing population growth (using module helpers, DB remains source of truth)
                    // Read stocks from IndexedDB (FoodDistributionService's updates are here)
                    const houseFoodStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                    const houseNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
                    const currentPop = await housesStore.getHouseItem(currentUniqueID, 'pop');
                    
                    // IMPORTANT: Sync IndexedDB stocks to userData for visual display
                    // This ensures stocks updated by FoodDistributionService are reflected in UI
                    if (houseFoodStocks && buildings[x][y] && buildings[x][y].userData) {
                        buildings[x][y].userData.stocks = {
                            food: houseFoodStocks.food || 0,
                            wheat: houseFoodStocks.wheat || 0,
                            carrot: houseFoodStocks.carrot || 0,
                            cabbage: houseFoodStocks.cabbage || 0
                        };
                        console.log('[scene.js] Synced house stocks from IndexedDB to userData:', {
                            houseId: currentUniqueID,
                            stocks: buildings[x][y].userData.stocks,
                            x, y
                        });
                    }
                    
                    const { hasFood, totalFood } = checkFoodAvailability(houseFoodStocks || {}, currentPop);
                    const { hasAccess: hasRoadAccess } = checkRoadAccess(houseNeighbors || []);
                    
                    console.log('[scene.js] Population check for house:', {
                        houseId: currentUniqueID,
                        hasFood,
                        totalFood,
                        hasRoadAccess,
                        currentPop,
                        stocks: houseFoodStocks,
                        stocksDetail: {
                            food: houseFoodStocks?.food || 0,
                            wheat: houseFoodStocks?.wheat || 0,
                            carrot: houseFoodStocks?.carrot || 0,
                            cabbage: houseFoodStocks?.cabbage || 0
                        }
                    });
                    
                    if (hasFood && hasRoadAccess) {
                        // Has food AND road access - population can grow (max 2)
                        const housePop = { name: currentUniqueID, increment: 1, field: 'pop' };
                        await housesStore.incrementHouseField(housePop, {operator: '<=', limit: 2});
                        console.log('[scene.js] Population incremented for house:', currentUniqueID);
                    } else {
                        // No food OR no road access - reset population to 0
                        if (currentPop > 0) {
                            await housesStore.updateHouseFields(currentUniqueID, { pop: 0 });
                            console.log('[scene.js] Population reset to 0 (no food or road):', currentUniqueID);
                        }
                    }

                    const houseTime = await housesStore.getHouseItem(currentUniqueID, 'time');
                    // House time processing

                    if(houseNeighbors && buildings[x][y]) {
                        const { hasAccess, roadCount } = checkRoadAccess(houseNeighbors);
                        await housesStore.updateHouseFields(currentUniqueID, { roads: roadCount });

                        setRoadAccessIcon({
                            assetManager,
                            mesh: buildings[x][y],
                            textures,
                            position: statutsIconsMeta.road.position,
                            scale: statutsIconsMeta.road.scale,
                            hasAccess
                        });
                    } else if(buildings[x][y]) {
                        setRoadAccessIcon({
                            assetManager,
                            mesh: buildings[x][y],
                            textures,
                            position: statutsIconsMeta.road.position,
                            scale: statutsIconsMeta.road.scale,
                            hasAccess: false
                        });
                    }

                    /* house evolution to stage 2 */
                    // Use food module for calculations (DB stocks remain source of truth, reuse already-fetched values)
                    const { meetsFoodGoal, isInsufficient } = checkFoodAvailability(houseFoodStocks, currentPop);
                    const foodGoal = meetsFoodGoal;
                    const decay = houseTime > 3 && isInsufficient;

                    // Set food status sprite based on module result
                    // Show "no-food" icon when !hasFood (sprite shown when condition is true)
                    // hasFood is computed above from IndexedDB stocks (source of truth)
                    if(buildings[x][y]) {
                        const showNoFoodIcon = !hasFood; // Show icon when NO food
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['nofood'],
                            'no-food',
                            statutsIconsMeta.food.scale,
                            statutsIconsMeta.food.position,
                            showNoFoodIcon
                        );
                        console.log('[scene.js] Food sprite update:', {
                            houseId: currentUniqueID,
                            hasFood,
                            showNoFoodIcon,
                            totalFood,
                            stocks: houseFoodStocks
                        });
                    }
                    
                  
                    if(decay) {
                        assetManager.changeMeshColor(buildings[x][y],  0X404040)
                    }

                    if(houseTime > 3 && foodGoal && firstHouses.includes(currentBuildingId)) {
                        removeInteractiveObject(buildings[x][y]);
                        const newUniqueBuildingId = makeDbItemId('House-2Story', x, y);
                        const keys = { type : "House-2Story", price: assetsPrices["House-2Story"].price}
                        await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                        await housesStore.deleteOneHouse(currentUniqueID);
                        buildings[x][y] = assetManager.createAsset('House-2Story', x, y);
                        scene.add(buildings[x][y]);
                        // Add to interactive group for optimized raycasting
                        const interactiveGroupRef = scene.interactiveGroup || scene.getObjectByName('interactive-objects');
                        if (interactiveGroupRef) {
                            interactiveGroupRef.add(buildings[x][y]);
                        }
                    }

                }
          
              }

                  // if data model has changed as user add a new building, update the mesh 
            if(newBuildingId && (newBuildingId !== currentBuildingId)) {
                // Special handling for roads: update terrain mesh AND add to buildings array for neighbor detection
                if (newBuildingId === 'roads') {
                    // Update terrain mesh material to show road texture
                    if (terrain[x] && terrain[x][y]) {
                        const terrainMesh = terrain[x][y];
                        const sharedMaterials = assetManager.getSharedTerrainMaterials();
                        if (sharedMaterials && sharedMaterials['roads'] && terrainMesh.material) {
                            terrainMesh.material = sharedMaterials['roads'];
                            terrainMesh.name = 'roads';
                            terrainMesh.userData.id = 'roads';
                            terrainMesh.userData.type = 'roads';
                            terrainMesh.userData.x = x;
                            terrainMesh.userData.y = y;
                            terrainMesh.userData.isBuilding = false;
                            terrainMesh.userData.isRoad = true; // Mark as road for easier detection
                        }
                    }
                    // CRITICAL: Add terrain mesh to buildings array so it's detected as a neighbor
                    // Roads need to be in buildings array for neighbor detection to work
                    if (!buildings[x][y]) {
                        buildings[x][y] = terrain[x][y];
                    }
                } else if (currentBuildingId === 'roads' || buildings[x][y]?.userData?.isRoad) {
                    // If removing a road, restore terrain to grass
                    if (terrain[x] && terrain[x][y]) {
                        const terrainMesh = terrain[x][y];
                        const sharedMaterials = assetManager.getSharedTerrainMaterials();
                        if (sharedMaterials && sharedMaterials['grass'] && terrainMesh.material) {
                            terrainMesh.material = sharedMaterials['grass'];
                            terrainMesh.name = 'grass';
                            terrainMesh.userData.id = 'grass';
                            terrainMesh.userData.type = 'grass';
                            terrainMesh.userData.x = x;
                            terrainMesh.userData.y = y;
                        }
                    }
                    // Remove from buildings array when road is removed
                    if (buildings[x][y] === terrain[x][y]) {
                        buildings[x][y] = undefined;
                    }
                }
                
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
                
                // Only create the mesh if this is the origin tile (and it's not a road)
                if (isOriginTile && newBuildingId !== 'roads') {
                    //remove the initial building if needed
                    let isExistingBuilding;
                    if(currentBuildingId) {
                        isExistingBuilding = housesStore.getHouse(currentBuildingId);
                    }

                    // Checking building existence
                    if(!isExistingBuilding) {
                        const interactiveGroupRef = scene.interactiveGroup || scene.getObjectByName('interactive-objects');
                        // Remove from both scene and interactive group
                        removeInteractiveObject(buildings[x][y]);
                        buildings[x][y] = assetManager.createAsset(newBuildingId, x, y);
                        scene.add(buildings[x][y]);
                        // Add to interactive group for optimized raycasting
                        if (interactiveGroupRef) {
                            interactiveGroupRef.add(buildings[x][y]);
                        }
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
                // Add taxes from houses (10€ per citizen per turn)
                await window.budgetManager.addTaxes();
                
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
                    
                    // Recalculate loan totals to ensure cumulative values are correct
                    const budget = await window.budgetManager.getCurrentBudget();
                    await window.budgetManager.calculateLoanTotals(budget);
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
                        
                        // Also cleanup old journal entries (60+ days)
                        if (window.budgetManager.cleanupOldJournalEntries) {
                            await window.budgetManager.cleanupOldJournalEntries(60);
                        }
                    } catch (error) {
                        console.warn('Failed to save budget state:', error);
                    }
                }
            }
        } catch (error) {
            console.warn('Budget operations failed:', error);
        }

        //  Display results in UI - Use IndexedDB as source of truth
        // Get population from housesStore (IndexedDB) instead of gameStore
        const currentPopulation = await housesStore.getGlobalPopulation();
        
        // Get budget data from BudgetManager
        let funds = 0;
        if (window.budgetManager) {
            const budgetData = await window.budgetManager.getCurrentBudget();
            funds = budgetData.funds;
        }

        // Update population and funds display in general bar using GameUI
        // This ensures consistent UI updates (IndexedDB is source of truth)
        if (window.gameUI) {
            window.gameUI.updatePopulation(currentPopulation || 0);
            window.gameUI.updateFunds(funds);
        } else {
            // Fallback to direct DOM update if GameUI not available
            const displayPop = document.querySelector('.display-pop');
            const displayFunds = document.querySelector('.display-funds');
            if (displayPop) {
                displayPop.textContent = (currentPopulation || 0).toString();
            }
            if (displayFunds) {
                displayFunds.textContent = funds.toString();
            }
        }

        console.log('[scene.js] Updated top bar display:', {
            population: currentPopulation,
            funds,
            usingGameUI: !!window.gameUI
        });

        // End turn processing

    }

    /**
     * Sets up lighting and shadows for the scene
     * Inspired by simcity-threejs-clone's explicit lighting pattern
     * @param {number} citySize - Size of the city (used for dynamic intensity scaling)
     */
    function setUpLights(citySize) {
        // CRITICAL FIX: Remove existing lights before adding new ones
        // This prevents light accumulation when reinitializing the scene
        const lightsToRemove = [];
        scene.traverse((child) => {
            if (child instanceof THREE.Light) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => {
            scene.remove(light);
            // Dispose of shadow maps to free GPU memory
            if (light.shadow && light.shadow.map) {
                light.shadow.map.dispose();
            }
        });

        // Calculate dynamic light intensity based on city size (Anoria-specific)
        // Use the derived formula for light intensity
        const b = Math.log10(0.1) / Math.log10(2); // Exponent
        const a = 0.03 / Math.pow(16, b); // Coefficient
        const c = 0.05 / Math.pow(16, b);
        let AmbientLightIntensity = a * Math.pow(citySize, b);
        let DirectionalLightIntensity = c * Math.pow(citySize, b);
        
        // BRIGHTNESS FIX: Compensate for the fact that lights were previously multiplied 16x
        // Before optimization: setUpLights() was called 16 times = 16x ambient + 48x directional + 16x hemisphere
        // Now: Only called once = 1x ambient + 3x directional + 1x hemisphere
        // We need to multiply intensities to match the original brightness
        // Approximate compensation factor: multiply by ~16 for ambient, ~16 for directional
        // But we'll use a more conservative factor to avoid over-brightening
        const brightnessCompensation = citySize; // Use city size as multiplier (16 for 16×16 city)
        AmbientLightIntensity *= brightnessCompensation;
        DirectionalLightIntensity *= brightnessCompensation;

        // OPTIMIZED LIGHTING SETUP - Only 5 lights total (was 80+ before!)
        // Setup ambient light (base illumination) - compensated intensity
        const ambientLight = new THREE.AmbientLight(0xffffff, AmbientLightIntensity);
        scene.add(ambientLight);

        // Setup THREE directional lights - all with 0x999999 color (original Anoria)
        // First light has shadows, others don't - compensated intensity
        const dirLight1 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight1.position.set(0, 1, 0);
        dirLight1.castShadow = config.rendering.shadows.enabled;

        // Configure shadows for first directional light (optimized resolution)
        if (dirLight1.castShadow) {
            dirLight1.shadow.camera.left = -10;
            dirLight1.shadow.camera.right = 10;
            dirLight1.shadow.camera.top = 0;
            dirLight1.shadow.camera.bottom = -10;
            // Reduced shadow map resolution for better performance (512 instead of 1024)
            // Can be increased to 1024 if quality is more important than performance
            dirLight1.shadow.mapSize.width = 512;
            dirLight1.shadow.mapSize.height = 512;
            dirLight1.shadow.camera.near = 0.5;
            dirLight1.shadow.camera.far = 50;
        }

        scene.add(dirLight1);

        // Second directional light (no shadows) - compensated intensity
        const dirLight2 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight2.position.set(0, 1, 0);
        scene.add(dirLight2);

        // Third directional light (no shadows) - compensated intensity
        const dirLight3 = new THREE.DirectionalLight(0x999999, DirectionalLightIntensity);
        dirLight3.position.set(0, 1, 0);
        scene.add(dirLight3);

        // Hemisphere light for atmospheric illumination - increased intensity to compensate
        const hemiLightIntensity = 0.1 * brightnessCompensation; // Scale hemisphere light too
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, hemiLightIntensity);
        hemiLight.position.set(0, 50, 0);
        scene.add(hemiLight);
    }

    // Note: setupShadowRenderer() removed - using original inline setup for exact brightness match


    /**
     * Helper function to get interactive objects for raycasting
     * OPTIMIZATION: Returns only buildings + terrain, not backdrop/lights/etc.
     */
    function getInteractiveObjects() {
        const interactiveGroupRef = scene.interactiveGroup || scene.getObjectByName('interactive-objects');
        return interactiveGroupRef ? interactiveGroupRef.children : scene.children;
    }

    /**
     * Helper function to remove an object from both scene and interactive group
     * OPTIMIZATION: Ensures objects are properly cleaned up
     */
    function removeInteractiveObject(object) {
        if (!object) return;
        const interactiveGroupRef = scene.interactiveGroup || scene.getObjectByName('interactive-objects');
        scene.remove(object);
        if (interactiveGroupRef && interactiveGroupRef.children.includes(object)) {
            interactiveGroupRef.remove(object);
        }
    }

    /**
     * Updates the focused object (object under cursor) via raycasting
     * Called every frame in the render loop
     * OPTIMIZED: Only raycast against interactive objects (buildings + terrain)
     * instead of all scene children (backdrop, lights, etc.)
     */
    function updateFocusedObject() {
        // Use InputManager mouse position if available, otherwise skip
        if (!window.inputManager || !window.inputManager.mouse) {
            return;
        }

        const { x: clientX, y: clientY } = window.inputManager.mouse;
        mouse.x = (clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(clientY / renderer.domElement.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera.camera);
        
        // OPTIMIZATION: Only test interactive objects (buildings + terrain)
        // This dramatically reduces raycast tests (from ~300+ objects to ~256 for 16×16 city)
        const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
        
        const newFocusedObject = intersections.length > 0 ? intersections[0].object : null;
        
        // Only update if changed (prevent unnecessary updates)
        if (newFocusedObject !== focusedObject) {
            // Clear previous focus (if object supports it)
            if (focusedObject && typeof focusedObject.setFocused === 'function') {
                focusedObject.setFocused(false);
            }
            focusedObject = newFocusedObject;
            // Set new focus (if object supports it)
            if (focusedObject && typeof focusedObject.setFocused === 'function') {
                focusedObject.setFocused(true);
            }
        }
    }

    /**
     * Updates the selected object and calls the selection callback
     * @param {THREE.Object3D} object - The object to select (or null to deselect)
     */
    function updateSelectedObject(object) {
        // Clear previous selection highlight if existed
        if (selectedObject && typeof selectedObject.setSelected === 'function') {
            selectedObject.setSelected(false);
        }

        selectedObject = object;

        // Set new selection highlight if exists
        if (selectedObject && typeof selectedObject.setSelected === 'function') {
            selectedObject.setSelected(true);
        }

        // Call the selection callback if registered
        if (this.onObjectSelected && object) {
            this.onObjectSelected(object);
        }
    }

    function draw() {
        updateFocusedObject(); // Update focused object every frame
        renderer.render(scene, camera.camera);
    }

    function start() {
        renderer.setAnimationLoop(draw);
    }

    function stop(){
        renderer.setAnimationLoop(null);
    }

    // Shared backdrop materials - created once and reused to reduce texture units
    let sharedBackdropMaterials = null;
    
    // Add a distant ground plane + ring to fake infinity (keep existing sky background)
    function addBackdrop() {
        // Avoid duplicating if reinitializing
        const existingBase = scene.getObjectByName('infinite-ground-base');
        const existingRing = scene.getObjectByName('infinite-ground-ring');
        if (existingBase && existingRing) return;

        // Get grass texture - use shared materials to reduce texture unit usage
        const grassTex = (textures && textures['grass']) ? textures['grass'] : null;
        
        // Create shared backdrop materials once
        if (!sharedBackdropMaterials) {
            if (grassTex && grassTex instanceof THREE.Texture) {
                // Use original texture directly (don't clone) to save texture units
                // Set repeat on a cloned texture only if needed
                const baseTex = grassTex.clone();
                baseTex.wrapS = THREE.RepeatWrapping;
                baseTex.wrapT = THREE.RepeatWrapping;
                baseTex.repeat.set(1500, 1500); // Tile texture across the plane
                
                const ringTex = grassTex.clone();
                ringTex.wrapS = THREE.RepeatWrapping;
                ringTex.wrapT = THREE.RepeatWrapping;
                ringTex.repeat.set(120, 120);
                
                sharedBackdropMaterials = {
                    base: new THREE.MeshLambertMaterial({
                        map: baseTex,
                        color: 0xA4B98B,
                        fog: true
                    }),
                    ring: new THREE.MeshLambertMaterial({
                        map: ringTex,
                        color: 0xA4B98B,
                        fog: true,
                        depthWrite: true
                    })
                };
            } else {
                sharedBackdropMaterials = {
                    base: new THREE.MeshLambertMaterial({
                        color: 0xA4B98B,
                        fog: true
                    }),
                    ring: new THREE.MeshLambertMaterial({
                        color: 0xA4B98B,
                        fog: true,
                        depthWrite: true
                    })
                };
            }
        }
        
        // Base ground plane with shared material
        try {
            const baseSize = 3000;
            const baseGeo = new THREE.PlaneGeometry(baseSize, baseSize, 1, 1);
            const base = new THREE.Mesh(baseGeo, sharedBackdropMaterials.base);
            base.rotation.x = -Math.PI / 2;
            base.position.y = -0.02;
            base.receiveShadow = true;
            base.name = 'infinite-ground-base';
            base.renderOrder = -10;
            scene.add(base);
        } catch (_) {}

        // Distant ground ring with shared material
        try {
            const size = 1200;
            const ringGeo = new THREE.PlaneGeometry(size, size, 1, 1);
            const ring = new THREE.Mesh(ringGeo, sharedBackdropMaterials.ring);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = -0.01;
            ring.receiveShadow = true;
            ring.name = 'infinite-ground-ring';
            ring.frustumCulled = false;
            scene.add(ring);
        } catch (_) {}
    }

    let hoveredObject = null
    let hoveredObjectName = null
    const objectsNames = ['grass', 'roads', 'House-Red', 'House-Purple', 'House-Blue', 'Market-Stall']

    function onMouseDown(event){
        // Block interaction if a popup is open or info modal is open
        if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
            return;
        }
        if (isInfoModalOpen()) {
            return;
        }
        if (performance.now() < suppressInputUntilMs) {
            return;
        }
        
        camera.onMouseDown(event);
        
        // Use focusedObject if available (from per-frame updates), otherwise raycast
        let objectToSelect = focusedObject;
        
        // Fallback: perform raycast if focusedObject not available
        if (!objectToSelect) {
            const p = getPointerClientXY(event);
            mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera.camera);
            const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
            objectToSelect = intersections.length > 0 ? intersections[0].object : null;
        }
        
        // Update selected object using unified method
        if (objectToSelect) {
            updateSelectedObject.call(this, objectToSelect);
        }
    }

    function onMouseUp(event){
        // Block interaction if a popup is open or info modal is open
        if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
            return;
        }
        if (isInfoModalOpen()) {
            return;
        }
        if (performance.now() < suppressInputUntilMs) {
            return;
        }
        
        camera.onMouseUp(event);
    }

function onMouseMove(event) {
    // Block interaction if a popup is open or info modal is open
    if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
        return;
    }
    if (isInfoModalOpen()) {
        // Reset mouse button states in camera to prevent dragging when modal closes
        camera.onMouseUp({ button: 0 }); // Reset left mouse
        camera.onMouseUp({ button: 1 }); // Reset middle mouse
        camera.onMouseUp({ button: 2 }); // Reset right mouse
        return;
    }
    if (performance.now() < suppressInputUntilMs) {
        return;
    }
    
    camera.onMouseMove(event);

    // Update the mouse coordinates for raycasting
    const p = getPointerClientXY(event);
    mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;

    // Perform raycasting (OPTIMIZED: only interactive objects)
    raycaster.setFromCamera(mouse, camera.camera);
    const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);

    if(intersections.length) {
        // Mouse move intersection
        hoveredObjectName = intersections[0]?.object?.name || ""
    }
}


function onTouchStart(event) {
    // If canvas has pointer-events-disabled, touch events won't reach us at all
    // But if they do, we should still check for blocking popups
    // BUT: panel-layout should not block events (it's configured with shouldBlockEvents: false)
    const activePopups = window.popupManager?.getActivePopups() || [];
    const blockingPopups = activePopups.filter(id => {
        const config = window.popupManager?.popupConfigs?.get(id);
        return config && config.shouldBlockEvents;
    });
    
    if (blockingPopups.length > 0) {
        return;
    }
    if (isInfoModalOpen()) {
        return;
    }
    if (performance.now() < suppressInputUntilMs) {
        return;
    }
    
    // Reset touch tracking
    touchHasMoved = false;
    touchStartPos = null;
    touchStartObject = null;
    cameraTouchInitialized = false;
    
    // Handle object selection for single touch
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        const p = { x: touch.clientX, y: touch.clientY };
        mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera.camera);
        const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
        touchStartObject = intersections.length > 0 ? intersections[0].object : null;
        
        console.log('[Touch] Touch start', {
            pos: touchStartPos,
            intersections: intersections.length,
            object: touchStartObject?.name || touchStartObject?.userData?.id || 'none'
        });
        
        // Don't update selection yet - wait for touchEnd to determine if it was a tap
        
        // For single touch, we'll handle camera in onTouchMove only if movement is significant
        // But we still need to prevent default behavior (scrolling)
        event.preventDefault();
    } else if (event.touches.length === 2) {
        // Multi-touch: always allow camera handling (pinch to zoom)
        camera.onTouchStart(event);
        cameraTouchInitialized = true;
    } else {
        // Other cases: allow camera handling
        camera.onTouchStart(event);
        cameraTouchInitialized = true;
    }
}

function onTouchMove(event) {
    // Block interaction if a popup is open or info modal is open
    if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
        return;
    }
    if (isInfoModalOpen()) {
        return;
    }
    if (performance.now() < suppressInputUntilMs) {
        return;
    }
    
    // Check if touch has moved significantly (indicating a drag/pan)
    if (touchStartPos && event.touches.length === 1) {
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > TAP_THRESHOLD) {
            touchHasMoved = true;
            // Movement is significant - this is a drag, so allow camera panning
            // Need to call camera.onTouchStart first if we haven't already (for single touch)
            if (!cameraTouchInitialized) {
                camera.onTouchStart(event);
                cameraTouchInitialized = true;
            }
            camera.onTouchMove(event);
        }
        // If movement is below threshold, don't call camera handlers to prevent accidental panning
    } else {
        // For multi-touch or when touchStartPos is not set, always allow camera handling
        camera.onTouchMove(event);
    }
}

function onTouchEnd(event) {
    // Block interaction if a popup is open or info modal is open
    const activePopups = window.popupManager?.getActivePopups() || [];
    const blockingPopups = activePopups.filter(id => {
        const config = window.popupManager?.popupConfigs?.get(id);
        return config && config.shouldBlockEvents;
    });
    
    if (blockingPopups.length > 0) {
        return;
    }
    if (isInfoModalOpen()) {
        return;
    }
    if (performance.now() < suppressInputUntilMs) {
        return;
    }
    
    // Check if this was a tap (no significant movement)
    if (!touchHasMoved && event.changedTouches && event.changedTouches.length > 0) {
        // Re-raycast at the touch end position to get the current object
        // This ensures we get the correct object even if camera moved slightly
        const touch = event.changedTouches[0];
        const p = { x: touch.clientX, y: touch.clientY };
        mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera.camera);
        const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
        const objectToSelect = intersections.length > 0 ? intersections[0].object : null;
        
        if (objectToSelect) {
            // This was a tap - trigger building placement
            updateSelectedObject.call(this, objectToSelect);
            // Prevent default behavior for taps
            event.preventDefault();
        }
    }
    
    // Reset touch tracking
    touchStartPos = null;
    touchStartObject = null;
    touchHasMoved = false;
    
    // Only call camera.onTouchEnd if we initialized camera touch handling
    if (cameraTouchInitialized || event.touches.length > 0) {
        camera.onTouchEnd(event);
    }
    cameraTouchInitialized = false;
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
        const p = window.inputManager ? window.inputManager.mouse : {x: undefined, y: undefined};
        if (p.x !== undefined && p.y !== undefined) {
            mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;
        }

        raycaster.setFromCamera(mouse, camera.camera);
        // array of object > all objects from our scene that intersect with the ray (false = non recursive = only the first object)
        // array of intersections sorted by distance with the closest object 
        // OPTIMIZED: Only test interactive objects
        const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
    
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

    function onMouseWheel(event) {
        // Block interaction if a popup is open or info modal is open
        if (window.popupManager && window.popupManager.getActivePopups().length > 0) {
            return;
        }
        if (isInfoModalOpen()) {
            return;
        }
        if (performance.now() < suppressInputUntilMs) {
            return;
        }
        
        // Prevent browser zoom when Ctrl+wheel is used (for camera zoom)
        if (event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        if (camera.onWheel) {
            camera.onWheel(event);
        }
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
        stop,
        onMouseDown,
        onMouseUp,
        onMouseMove, 
        onKeyBoardDown,
        onKeyBoardUp,
        onMouseWheel,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        delay,
        // Expose focused/selected for external access if needed
        get focusedObject() { return focusedObject; },
        get selectedObject() { return selectedObject; },
        // Expose controls to enable/disable OrbitControls when modal opens/closes
        get controls() { return controls; },
        // Expose canvas element to attach precise listeners
        get domElement() { return renderer.domElement; },
        // Expose camera for mobile controls
        get camera() { return camera; },
        suppressInput
    }
}