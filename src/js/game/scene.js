import * as THREE from 'three';
import {createCamera} from './camera.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
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
    farms,
    firstHouses,
    gameWindow,
    houses,
    palaces
} from '../ui/nodes.js';
import {assetsPrices} from "../meshs/data.js";
import { checkRoadAccess, checkFoodAvailability, canHouseEvolveToPalace, canHouseEvolveToPurple } from './modules/ModuleHelper.js';
import { setRoadAccessIcon } from './modules/StatusIconHelper.js';
import { TimeManager } from './utils/TimeManager.js';
import config from './config.js';

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

/**
 * Get the maximum population capacity for a house type
 * @param {string} houseType - The house type (e.g., 'House-Blue', 'House-2Story')
 * @returns {number} Maximum population capacity
 */
function getHouseMaxPopulation(houseType) {
    if (!houseType) return 0;
    
    // 2Story houses (evolved houses) can hold 12 people
    if (houseType.includes('House-2Story') || houseType.includes('House_2Story')) {
        return 12;
    }
    
    // Regular houses (Blue, Red, Purple) can hold 6 people
    if (houseType.includes('House-Blue') || houseType.includes('House-Red') || houseType.includes('House-Purple')) {
        return 6;
    }
    
    // Default: no population for non-house buildings
    return 0;
}

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
    let currentCitySize = 16; // Store current city size for citizen pathfinding
    
    // Track last month when maintenance was paid (to pay only once per month)
    let lastMaintenanceMonth = -1;
    
    // Multiple citizens support (max 3)
    const MAX_CITIZENS = 3;
    let citizenAnimations = {}; // Shared animation clips (loaded once)
    let citizens = []; // Array of citizen objects, each with its own state
    let previousPopulation = 0; // Track previous population to detect changes
    const WALK_SPEED = 2; // Units per second
    
    // Citizen data structure
    class CitizenData {
        constructor() {
            this.character = null; // THREE.Object3D reference
            this.mixer = null; // AnimationMixer
            this.currentAction = null; // Current AnimationAction
            this.spawned = false; // Track if citizen has been spawned
            this.isWalking = false; // Track if citizen is currently walking
            this.targetPosition = null; // Target position for citizen to walk to
            this.path = []; // Path of road tiles to follow
            this.currentPathIndex = 0; // Current index in the path
            this.pathDirection = 1; // 1 for forward, -1 for backward
            this.onRoad = false; // Track if citizen is on a road
            this.waitingForRoad = false; // Track if citizen is waiting for road access
            this.wasWalkingBeforePause = false; // Track if citizen was walking before pause
            this.lastPathRecalculationTurn = -1; // Track last turn when path was recalculated
        }
    }
    
    // OPTIMIZATION: Create a separate group for interactive objects (buildings + terrain)
    // This allows raycasting to test only relevant objects instead of all scene children
    const interactiveGroup = new THREE.Group();
    interactiveGroup.name = 'interactive-objects';
    scene.add(interactiveGroup);
    
    // OPTIMIZATION: Zone groups for frustum culling
    // Group buildings/terrain by zones (4x4 tiles per zone) for efficient frustum culling
    const zoneGroups = [];
    const ZONE_SIZE = 4; // 4x4 tiles per zone
    let zoneGroupsInitialized = false;

    // Variables de gameplay
    let delay = 0;

    async function initialize(city) {
        scene.clear();
        // Re-apply fog after clear
        try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}
        terrain = [];
        buildings = [];
        loadingPromises = [];
        
        // Store city size for citizen pathfinding
        if (city && typeof city.size === 'number') {
            currentCitySize = city.size;
        }
        
        // Reset citizen state
        // Remove all existing citizens
        citizens.forEach(citizen => {
            if (citizen.character && citizen.character.parent) {
                citizen.character.parent.remove(citizen.character);
            }
            if (citizen.mixer) {
                // Stop all animations
                Object.values(citizenAnimations).forEach(clip => {
                    if (clip) {
                        const action = citizen.mixer.clipAction(clip);
                        if (action && typeof action.isRunning === 'function' && action.isRunning()) {
                            action.stop();
                        }
                    }
                });
            }
        });
        citizens = [];
        previousPopulation = 0;
        
        // Reset maintenance tracking
        lastMaintenanceMonth = -1;
        
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
        
        // OPTIMIZATION: Initialize zone groups for frustum culling
        if (!zoneGroupsInitialized) {
            const numZonesX = Math.ceil(city.size / ZONE_SIZE);
            const numZonesY = Math.ceil(city.size / ZONE_SIZE);
            
            for (let zoneX = 0; zoneX < numZonesX; zoneX++) {
                for (let zoneY = 0; zoneY < numZonesY; zoneY++) {
                    const zoneGroup = new THREE.Group();
                    zoneGroup.name = `zone_${zoneX}_${zoneY}`;
                    zoneGroup.userData = { zoneX, zoneY, minX: zoneX * ZONE_SIZE, minY: zoneY * ZONE_SIZE };
                    scene.add(zoneGroup);
                    zoneGroups.push(zoneGroup);
                }
            }
            zoneGroupsInitialized = true;
        }
        
        // OPTIMIZATION: Create terrain synchronously but efficiently
        // Chunking with requestAnimationFrame added overhead, so we use direct creation
        // but optimize by batching DOM updates and deferring non-critical work
        
        // Create initial empty arrays for buildings
        for(let x = 0; x < city.size; x++) {
            buildings.push([...Array(city.size)]);
        }
        
        // Create terrain efficiently
        for(let x = 0; x < city.size; x++) {
            let column = [];
            for(let y = 0; y < city.size; y++) {
                // Grass
                const terrainId = city.tiles[x][y].terrainId;
                const mesh = assetManager.createAsset(terrainId, x, y);
                mesh.name = terrainId;
                
                // OPTIMIZATION: Add to zone group (zone groups are in scene)
                // This allows frustum culling to work properly
                const zoneX = Math.floor(x / ZONE_SIZE);
                const zoneY = Math.floor(y / ZONE_SIZE);
                const zoneIndex = zoneX * Math.ceil(city.size / ZONE_SIZE) + zoneY;
                if (zoneGroups[zoneIndex]) {
                    zoneGroups[zoneIndex].add(mesh);
                } else {
                    // Fallback: add directly to scene if zone group doesn't exist
                    scene.add(mesh);
                }
                
                column.push(mesh);  
            }
            terrain.push(column);
        }
        
        // CRITICAL FIX: Set up lights ONCE after terrain is created, not in the loop
        // Previously this was called 16 times for a 16×16 city, creating 80 lights!
        setUpLights(city.size);
        
        // OPTIMIZATION: Defer DOM updates to reduce main-thread work
        // Use requestIdleCallback or setTimeout to defer non-critical DOM operations
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
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
            }, { timeout: 1000 });
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => {
                const displayPop = document.querySelector('.display-pop');
                const displayFunds = document.querySelector('.display-funds');
                if (displayPop) displayPop.textContent = '0';
                if (displayFunds) displayFunds.textContent = '0';
                const debtBox = document.querySelector('.debt-box');
                if (debtBox) debtBox.style.display = 'none';
            }, 0);
        }
        
        // Wait for any remaining promises to complete
        if (loadingPromises.length > 0) {
            await Promise.all(loadingPromises);
        }
        
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
            if (camera.centerOnCity) {
                camera.centerOnCity(city.size);
            }
        }

        // Add infinite backdrop (skydome + distant ground ring)
        addBackdrop();
        
        // Load and add citizen character to the scene
        loadCitizenAnimations();
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
                scale : {x: 1.2, y: 1.2, z: 1},
                spriteColor: null,
                backgroundColor: null
            },
            food: {
                position : {x: -0.5, y: 1, z: 0},
                scale : {x: 1.0, y: 1.0, z: 1},
                spriteColor: null,
                backgroundColor: null
            },
            // Different positions for different farm sprites
            'no-food': {
                position : {x: -0.5, y: 1, z: 0},
                scale : {x: 1.0, y: 1.0, z: 1},
                spriteColor: null,
                backgroundColor: null
            },
            'no-food-farm': {
                position : {x: -0.8, y: 0.5, z: -0.2},
                scale : {x: 0.6, y: 0.6, z: 0.6},
                spriteColor: 0xFFFF00, // Yellow
                backgroundColor: null
            },
            'grow-food': {
                position : {x: -0.8, y: 0.5, z: -0.2},
                scale : {x: 0.4, y: 0.4, z: 0.4},
                spriteColor: null, // Keep original colors
                backgroundColor: 0xFFE8E8 
            },
            'harvest': {
                position : {x: -0.8, y: 0.5, z: -0.2},
                scale : {x: 0.4, y: 0.4, z: 0.4},
                spriteColor: null, // Keep original colors
                backgroundColor: 0xFFE8E8
            },
            'sell-food': {
                position : {x: -0.8, y: 0.5, z: -0.2},
                scale : {x: 0.4, y: 0.4, z: 0.4},
                spriteColor: null, // Keep original colors
                backgroundColor: 0xFFE8E8
            },
            'isBuying': {
                position : {x: -0.5, y: 0.5, z: 0},
                scale : {x: 0.6, y: 0.6, z: 1},
                spriteColor: 0x00FF00, // Green color
                backgroundColor: 0xFFFFFF // White background
            }
        };

        for(let x = 0; x < city.size; x++) {
            for(let y = 0; y < city.size; y++) {
                // Processing city tile
              let currentBuildingId = buildings[x][y]?.userData?.type || buildings[x][y]?.userData?.id;
              // Also check terrain for roads using isRoad property (roads are in terrain array but may be in buildings array too)
              // FIX BUG 1: Only detect road from terrain if it's also in city.tiles (meaning it was properly placed)
              const tileBuildingId = city.tiles[x][y]?.buildingId;
              if (!currentBuildingId && terrain[x] && terrain[x][y] && (terrain[x][y].userData?.isRoad || terrain[x][y].name === 'roads')) {
                  // Only treat as road if it's also marked in city.tiles (was properly placed)
                  if (tileBuildingId === 'roads' || tileBuildingId === 'Road') {
                      currentBuildingId = 'roads';
                      // Ensure road is in buildings array for neighbor detection
                      if (!buildings[x][y]) {
                          buildings[x][y] = terrain[x][y];
                      }
                  } else {
                      // Terrain has road material but city.tiles doesn't - restore to grass
                      const terrainMesh = terrain[x][y];
                      const sharedMaterials = assetManager.getSharedTerrainMaterials();
                      if (sharedMaterials && sharedMaterials['grass'] && terrainMesh.material) {
                          terrainMesh.material = sharedMaterials['grass'];
                          terrainMesh.name = 'grass';
                          terrainMesh.userData.id = 'grass';
                          terrainMesh.userData.type = 'grass';
                          terrainMesh.userData.isRoad = false;
                      }
                  }
              }
              const currentBuilding = buildings[x][y];
              const newBuildingId = city.tiles[x][y]?.buildingId;
              const buildingInfo =  city.tiles[x][y];

              // Check bounds for neighbor processing (avoid accessing out-of-bounds neighbors)
              const isInCityLimits = x >= 0 && x < city.size && y >= 0 && y < city.size;
              // Check if building is on edge (need special handling for neighbors)
              const isOnEdge = x === 0 || x === city.size - 1 || y === 0 || y === city.size - 1;

              if(currentBuildingId && isInCityLimits) {
                let currentUniqueID =  makeDbItemId(currentBuildingId, x, y)
                // Skip if makeDbItemId returned false (invalid building ID or coordinates)
                if(!currentUniqueID) {
                    continue;
                }
                
                // Vérifier si le bâtiment existe encore dans la base de données
                // Si non, le supprimer de la scène (cas des événements aléatoires, etc.)
                // IMPORTANT: Ne pas supprimer si un nouveau bâtiment est en cours de création (newBuildingId existe)
                const isRoad = currentBuildingId === 'roads' || buildings[x][y]?.userData?.isRoad;
                const hasNewBuilding = newBuildingId && newBuildingId !== currentBuildingId;
                
                // FIX BUG 1: For roads, use city.tiles as source of truth
                // If city.tiles doesn't have a road but terrain shows road material, restore to grass
                // This prevents "ghost" roads from terrain material when payment failed
                if (isRoad) {
                    const tileHasRoad = city.tiles[x][y]?.buildingId === 'roads' || city.tiles[x][y]?.buildingId === 'Road';
                    if (!tileHasRoad) {
                        // Terrain shows road but city.tiles doesn't - this means payment failed or road was removed
                        // Restore terrain to grass
                        if (terrain[x] && terrain[x][y]) {
                            const terrainMesh = terrain[x][y];
                            const sharedMaterials = assetManager.getSharedTerrainMaterials();
                            if (sharedMaterials && sharedMaterials['grass'] && terrainMesh.material) {
                                terrainMesh.material = sharedMaterials['grass'];
                                terrainMesh.name = 'grass';
                                terrainMesh.userData.id = 'grass';
                                terrainMesh.userData.type = 'grass';
                                terrainMesh.userData.isRoad = false; // Clear road flag
                                terrainMesh.userData.x = x;
                                terrainMesh.userData.y = y;
                            }
                        }
                        // Remove from buildings array
                        if (buildings[x][y] === terrain[x][y]) {
                            buildings[x][y] = undefined;
                        }
                        continue; // Skip further processing for this tile
                    }
                }
                
                // Ne vérifier la suppression que si aucun nouveau bâtiment n'est en cours de création
                if (!isRoad && !hasNewBuilding) {
                    const buildingExists = await housesStore.getHouse(currentUniqueID);
                    if (!buildingExists) {
                        // Le bâtiment n'existe plus dans la DB, le supprimer visuellement
                        // IMPORTANT: Ne pas supprimer si c'est aussi le terrain (routes)
                        const isTerrain = buildings[x][y] === terrain[x][y];
                        if (!isTerrain) {
                            removeInteractiveObject(buildings[x][y]);
                            buildings[x][y] = undefined;
                        }
                        city.tiles[x][y].buildingId = undefined;
                        continue; // Passer au prochain tile
                    }
                }
                
                // Update building data in database
                if (!isRoad) {
                    await housesStore.updateHouseFields(currentUniqueID, {worldTime: time})
                    
                    /* update userData in indexDB === real userData state from three mesh */
                    const currentUserData = buildings[x][y].userData
                    // Building userData processing
                    await housesStore.updateHouseFields(currentUniqueID, {})
                } else {
                    // Pour les routes, on essaie de mettre à jour mais on ne bloque pas si ça échoue
                    try {
                        await housesStore.updateHouseFields(currentUniqueID, {worldTime: time})
                        const currentUserData = buildings[x][y].userData
                        await housesStore.updateHouseFields(currentUniqueID, {})
                    } catch (err) {
                        // Route peut ne pas exister encore dans la DB, c'est normal lors de la création
                        // On continue quand même pour permettre l'affichage visuel
                    }
                }



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

                    // Display buying icon during autumn (when markets buy from farms)
                    // Show green buying icon if market is in buying period (isBuying === true)
                    // isBuying indicates that conditions are met to buy food from nearest farms
                    if (buildings[x][y]) {
                        const isBuying = await housesStore.getHouseItem(currentUniqueID, 'isBuying');
                        
                        // Show/hide buying icon based on buying status only
                        // isBuying means market can buy food from farms (conditions are met)
                        if (isBuying === true) {
                            // Market is in buying period - show green buying icon
                            const buyingMeta = statutsIconsMeta['isBuying'];
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isBuying'],
                                'isBuying',
                                buyingMeta.scale,
                                buyingMeta.position,
                                true,
                                buyingMeta.spriteColor, // Green color from metadata
                                buyingMeta.backgroundColor // White background from metadata
                            );
                        } else {
                            // Not in buying period - hide buying icon
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isBuying'],
                                'isBuying',
                                statutsIconsMeta['isBuying'].scale,
                                statutsIconsMeta['isBuying'].position,
                                false,
                                null,
                                null
                            );
                        }
                    }
                    
                    // Set no-food icon for markets (independent of other sprites, like houses)
                    // Show "no-food" icon when market has no food stocks (same logic as houses)
                    if (buildings[x][y]) {
                        const marketStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks') || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                        const hasFoodBaskets = (marketStocks.wheat || 0) > 0 || 
                                               (marketStocks.carrot || 0) > 0 || 
                                               (marketStocks.cabbage || 0) > 0 || 
                                               (marketStocks.food || 0) > 0;
                        
                        const showNoFoodIcon = !hasFoodBaskets; // Show icon when NO food
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['nofood'],
                            'no-food',
                            statutsIconsMeta['no-food'].scale,
                            statutsIconsMeta['no-food'].position,
                            showNoFoodIcon
                        );
                        console.log('[scene.js] Market food sprite update:', {
                            marketId: currentUniqueID,
                            hasFoodBaskets,
                            showNoFoodIcon,
                            stocks: marketStocks
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

                // Process farms: show season-specific sprites and manage harvest stocks
                if(farms.includes(currentBuildingId) && buildings[x][y]) {
                    // First, clean up ALL possible farm sprites to prevent any leftover sprites
                    const allFarmSpriteNames = ['no-food', 'grow-food', 'harvest', 'sell-food', 
                                                'no-food-bg', 'grow-food-bg', 'harvest-bg', 'sell-food-bg'];
                    allFarmSpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });
                    
                    // Get current time info to determine season
                    const timeInfo = TimeManager.getTimeInfo(time);
                    const season = timeInfo.season;
                    
                    // Initialize farm stocks in IndexedDB if not present
                    const farmStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                    if (!farmStocks) {
                        await housesStore.updateHouseFields(currentUniqueID, {
                            stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 }
                        });
                    }
                    
                    // Harvest season (Automne): produce 12 paniers once per year (enough to feed 1 person for 1 year)
                    // 1 person consumes 1 panier per month = 12 paniers per year
                    // Only produce once per year - track the last year when production happened
                    if (season === 'Automne') {
                        // Get farm data to check last production year
                        const farmData = await housesStore.getHouse(currentUniqueID);
                        const lastProductionYear = farmData?.lastProductionYear;
                        const currentYear = timeInfo.year || 0;
                        const currentMonthIndex = timeInfo.monthIndex;
                        
                        // Only produce if we haven't produced this year yet (produce once per year in autumn)
                        if (lastProductionYear !== currentYear) {
                            // Get current stocks
                            const currentFarmStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks') || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                            
                            // Determine farm type and add 12 paniers of that type (enough to feed 1 person for 1 year)
                            let farmType = currentBuildingId;
                            let newStocks = { ...currentFarmStocks };
                            
                            // Production: 12 paniers = enough to feed 1 person for 1 year (1 panier/month × 12 months)
                            const productionAmount = 12;
                            
                            if (farmType.includes('Farm-Wheat') || farmType.includes('Wheat')) {
                                // Add 12 wheat paniers (enough to feed 1 person for 1 year)
                                newStocks.wheat = (currentFarmStocks.wheat || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            } else if (farmType.includes('Farm-Carrot') || farmType.includes('Carrot')) {
                                // Add 12 carrot paniers (enough to feed 1 person for 1 year)
                                newStocks.carrot = (currentFarmStocks.carrot || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Cabbage')) {
                                // Add 12 cabbage paniers (enough to feed 1 person for 1 year)
                                newStocks.cabbage = (currentFarmStocks.cabbage || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            }
                            
                            // Update stocks and track production year in IndexedDB
                            await housesStore.updateHouseFields(currentUniqueID, { 
                                stocks: newStocks,
                                lastProductionYear: currentYear,
                                lastProductionMonth: currentMonthIndex // Keep for compatibility
                            });
                            
                            console.log('[scene.js] Farm produced annual harvest:', {
                                farmId: currentUniqueID,
                                farmType,
                                productionAmount,
                                newStocks,
                                year: currentYear
                            });
                        }
                    }
                    
                    // Determine which sprite to show based on season
                    let spriteTexture, spriteName, spriteColor, spritePosition, spriteScale, backgroundColor;
                    
                    if (season === 'Hiver') {
                        // Winter: no-food (yellow, no background)
                        spriteTexture = textures['nofood'];
                        spriteName = 'no-food';
                        spritePosition = statutsIconsMeta['no-food-farm'].position;
                        spriteScale = statutsIconsMeta['no-food-farm'].scale;
                        spriteColor = statutsIconsMeta['no-food-farm'].spriteColor;
                        backgroundColor = statutsIconsMeta['no-food-farm'].backgroundColor;
                    } else {
                        if (season === 'Printemps') {
                            // Spring: grow-food with pastel green background
                            spriteTexture = textures['grow-food'];
                            spriteName = 'grow-food';
                            spritePosition = statutsIconsMeta['grow-food'].position;
                            spriteScale = statutsIconsMeta['grow-food'].scale;
                            spriteColor = statutsIconsMeta['grow-food'].spriteColor;
                            backgroundColor = statutsIconsMeta['grow-food'].backgroundColor;
                        } else if (season === 'Été') {
                            // Summer: harvest with pastel yellow/orange background
                            spriteTexture = textures['harvest'];
                            spriteName = 'harvest';
                            spritePosition = statutsIconsMeta['harvest'].position;
                            spriteScale = statutsIconsMeta['harvest'].scale;
                            spriteColor = statutsIconsMeta['harvest'].spriteColor;
                            backgroundColor = statutsIconsMeta['harvest'].backgroundColor;
                        } else if (season === 'Automne') {
                            // Autumn: sell-food with pastel orange/red background
                            spriteTexture = textures['sell-food'];
                            spriteName = 'sell-food';
                            spritePosition = statutsIconsMeta['sell-food'].position;
                            spriteScale = statutsIconsMeta['sell-food'].scale;
                            spriteColor = statutsIconsMeta['sell-food'].spriteColor;
                            backgroundColor = statutsIconsMeta['sell-food'].backgroundColor;
                        }
                    }
                    
                    // Show the appropriate sprite for the current season (only one sprite per season)
                    if(buildings[x][y] && spriteTexture) {
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            spriteTexture,
                            spriteName,
                            spriteScale,
                            spritePosition,
                            true, // Always show sprite (season-specific)
                            spriteColor, // Color (red for winter, null for others to keep original colors)
                            backgroundColor // Pastel colored circular background for season sprites (null for winter)
                        );
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

                    // IMPORTANT: IndexedDB is the source of truth for stocks
                    // FoodDistributionService updates IndexedDB first, then we read from it
                    // DO NOT write userData.stocks back to IndexedDB - it would overwrite service updates!
                    
                    // Removed old code that wrote userData.stocks to IndexedDB:
                    // This was causing the service's updates to be overwritten
                    // The service writes: stocks = {wheat: 0, carrot: 1, cabbage: 0, food: 1}
                    // Then this code was reading empty userData.stocks and overwriting IndexedDB with 0s!

                    // Check if house has food AND road access before allowing population growth (using module helpers, DB remains source of truth)
                    // Read stocks from IndexedDB (FoodDistributionService's updates are here)
                    const houseFoodStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                    const houseNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
                    const currentPop = await housesStore.getHouseItem(currentUniqueID, 'pop');
                    const worldTime = await housesStore.getHouseItem(currentUniqueID, 'worldTime');
                    
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
                    
                    // NEW: Monthly food consumption - 1 basket per citizen per month
                    // Fetch house data once for use in both food consumption and population logic
                    const houseData = await housesStore.getHouse(currentUniqueID);
                    const timeInfo = TimeManager.getTimeInfo(time);
                    const currentMonthIndex = timeInfo.monthIndex;
                    const lastConsumptionMonth = houseData?.lastConsumptionMonth;
                    
                    // Only consume food once per month
                    if (lastConsumptionMonth !== currentMonthIndex && currentPop > 0) {
                        const currentStocks = houseFoodStocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                        const consumptionAmount = currentPop; // 1 basket per citizen
                        
                        // Consume food: prioritize wheat, then carrot, then cabbage
                        let remainingConsumption = consumptionAmount;
                        const newStocks = { ...currentStocks };
                        
                        // Track what was consumed for traceability
                        let wheatConsumed = 0;
                        let carrotConsumed = 0;
                        let cabbageConsumed = 0;
                        
                        // Consume wheat first
                        if (remainingConsumption > 0 && newStocks.wheat > 0) {
                            wheatConsumed = Math.min(remainingConsumption, newStocks.wheat);
                            newStocks.wheat -= wheatConsumed;
                            remainingConsumption -= wheatConsumed;
                        }
                        
                        // Then consume carrot
                        if (remainingConsumption > 0 && newStocks.carrot > 0) {
                            carrotConsumed = Math.min(remainingConsumption, newStocks.carrot);
                            newStocks.carrot -= carrotConsumed;
                            remainingConsumption -= carrotConsumed;
                        }
                        
                        // Finally consume cabbage
                        if (remainingConsumption > 0 && newStocks.cabbage > 0) {
                            cabbageConsumed = Math.min(remainingConsumption, newStocks.cabbage);
                            newStocks.cabbage -= cabbageConsumed;
                            remainingConsumption -= cabbageConsumed;
                        }
                        
                        // Update total food
                        newStocks.food = newStocks.wheat + newStocks.carrot + newStocks.cabbage;
                        
                        // Update stocks and track consumption month
                        await housesStore.updateHouseFields(currentUniqueID, {
                            stocks: newStocks,
                            lastConsumptionMonth: currentMonthIndex
                        });
                        
                        // Enregistrer la consommation dans la traçabilité
                        if (window.foodTraceabilityService && houseData) {
                            if (wheatConsumed > 0) {
                                await window.foodTraceabilityService.recordHouseConsumption(
                                    timeInfo.turn || 0,
                                    currentMonthIndex,
                                    timeInfo.year || 0,
                                    { id: currentUniqueID, x: houseData.x, y: houseData.y, type: houseData.type },
                                    'wheat',
                                    wheatConsumed,
                                    currentPop
                                );
                            }
                            if (carrotConsumed > 0) {
                                await window.foodTraceabilityService.recordHouseConsumption(
                                    timeInfo.turn || 0,
                                    currentMonthIndex,
                                    timeInfo.year || 0,
                                    { id: currentUniqueID, x: houseData.x, y: houseData.y, type: houseData.type },
                                    'carrot',
                                    carrotConsumed,
                                    currentPop
                                );
                            }
                            if (cabbageConsumed > 0) {
                                await window.foodTraceabilityService.recordHouseConsumption(
                                    timeInfo.turn || 0,
                                    currentMonthIndex,
                                    timeInfo.year || 0,
                                    { id: currentUniqueID, x: houseData.x, y: houseData.y, type: houseData.type },
                                    'cabbage',
                                    cabbageConsumed,
                                    currentPop
                                );
                            }
                        }
                        
                        console.log('[scene.js] Monthly food consumption:', {
                            houseId: currentUniqueID,
                            citizens: currentPop,
                            consumed: consumptionAmount - remainingConsumption,
                            remainingToConsume: remainingConsumption,
                            oldStocks: currentStocks,
                            newStocks: newStocks
                        });
                        
                        // Get updated stocks after consumption for further processing
                        const updatedStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                        if (updatedStocks) {
                            Object.assign(houseFoodStocks, updatedStocks);
                        }
                    }
                    
                    const { hasFood, totalFood } = checkFoodAvailability(houseFoodStocks || {}, currentPop);
                    const { hasAccess: hasRoadAccess } = checkRoadAccess(houseNeighbors || []);
                    
                    // Get house type to determine max population capacity (reuse houseData from above)
                    const houseType = houseData?.type || currentBuildingId;
                    const maxPopulation = getHouseMaxPopulation(houseType);
                    
                    console.log('[scene.js] Population check for house:', {
                        houseId: currentUniqueID,
                        houseType,
                        maxPopulation,
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
                    
                    // Population management: population grows independently of food up to house capacity
                    // Population can exceed food (creating un nourished people)
                    // Only road access is required for population to exist
                    if (hasRoadAccess && maxPopulation > 0) {
                        // Population grows monthly up to house capacity limit
                        // Population is not tied to food - can have un nourished people
                        const timeInfo = TimeManager.getTimeInfo(time);
                        const currentMonthIndex = timeInfo.monthIndex;
                        const lastPopulationGrowthMonth = houseData?.lastPopulationGrowthMonth;
                        
                        let targetPopulation = currentPop;
                        
                        // If house is not at capacity, allow population to grow monthly
                        if (currentPop < maxPopulation && lastPopulationGrowthMonth !== currentMonthIndex) {
                            // Population grows 1 person per month when there's space
                            targetPopulation = Math.min(currentPop + 1, maxPopulation);
                            
                            // Update population and track growth month
                            if (targetPopulation !== currentPop) {
                                await housesStore.updateHouseFields(currentUniqueID, { 
                                    pop: targetPopulation,
                                    lastPopulationGrowthMonth: currentMonthIndex
                                });
                                console.log('[scene.js] Population updated (monthly growth):', {
                                    houseId: currentUniqueID,
                                    oldPop: currentPop,
                                    newPop: targetPopulation,
                                    maxPopulation,
                                    foodStocks: houseFoodStocks?.food || 0,
                                    change: 'increased',
                                    note: targetPopulation > (houseFoodStocks?.food || 0) ? 'un nourished people possible' : 'all fed'
                                });
                            }
                        } else if (currentPop >= maxPopulation) {
                            // House is at capacity - ensure it doesn't exceed max
                            if (currentPop > maxPopulation) {
                                targetPopulation = maxPopulation;
                                await housesStore.updateHouseFields(currentUniqueID, { pop: targetPopulation });
                                console.log('[scene.js] Population capped at max capacity:', {
                                    houseId: currentUniqueID,
                                    oldPop: currentPop,
                                    newPop: targetPopulation,
                                    maxPopulation
                                });
                            }
                        }
                    } else {
                        // No road access OR not a house - reset population to 0
                        if (currentPop > 0) {
                            await housesStore.updateHouseFields(currentUniqueID, { pop: 0 });
                            console.log('[scene.js] Population reset to 0 (no road access or not a house):', {
                                houseId: currentUniqueID,
                                hasRoadAccess,
                                maxPopulation,
                                reason: !hasRoadAccess ? 'no road access' : 'not a house'
                            });
                        }
                    }

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
                    // Use unified time system for decay check (worldTime is source of truth)
                    const buildingAge = TimeManager.getBuildingAge(time, worldTime);
                    const decay = buildingAge > 3 && isInsufficient;

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
                    
                  
                    // DISABLED: Don't change building material color on decay
                    // This was causing unwanted color changes when opening info panel
                    // if(decay) {
                    //     assetManager.changeMeshColor(buildings[x][y],  0X404040)
                    // }

                    /* house evolution: Blue ↔ Red based on population */
                    // House-Blue becomes House-Red when inhabited (pop > 0)
                    if (currentBuildingId === 'House-Blue' && currentPop > 0) {
                        removeInteractiveObject(buildings[x][y]);
                        const newUniqueBuildingId = makeDbItemId('House-Red', x, y);
                        const keys = { type : "House-Red", price: assetsPrices["House-Red"].price}
                        await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                        buildings[x][y] = assetManager.createAsset('House-Red', x, y);
                        // Add to appropriate zone group (NOT directly to scene)
                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const citySize = city.size || 16;
                        const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(buildings[x][y]);
                        } else {
                            // Fallback: add directly to scene if zone group doesn't exist
                            scene.add(buildings[x][y]);
                        }
                        console.log('[scene.js] House evolved: House-Blue → House-Red (inhabited)', {
                            houseId: currentUniqueID,
                            newId: newUniqueBuildingId,
                            population: currentPop
                        });
                    }
                    // House-Red becomes House-Blue when uninhabited (pop === 0)
                    else if (currentBuildingId === 'House-Red' && currentPop === 0) {
                        removeInteractiveObject(buildings[x][y]);
                        const newUniqueBuildingId = makeDbItemId('House-Blue', x, y);
                        const keys = { type : "House-Blue", price: assetsPrices["House-Blue"].price}
                        await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                        buildings[x][y] = assetManager.createAsset('House-Blue', x, y);
                        // Add to appropriate zone group (NOT directly to scene)
                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const citySize = city.size || 16;
                        const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(buildings[x][y]);
                        } else {
                            // Fallback: add directly to scene if zone group doesn't exist
                            scene.add(buildings[x][y]);
                        }
                        console.log('[scene.js] House regressed: House-Red → House-Blue (uninhabited)', {
                            houseId: currentUniqueID,
                            newId: newUniqueBuildingId,
                            population: currentPop
                        });
                    }
                    
                    /* house evolution: Red → Purple based on food conditions */
                    // House-Red becomes House-Purple when all conditions are met:
                    // - All House-Red conditions (pop > 0, road access)
                    // - No one suffering from hunger (food stocks = population)
                    else if (currentBuildingId === 'House-Red') {
                        const purpleEvolutionCheck = canHouseEvolveToPurple({
                            stocks: houseFoodStocks,
                            population: currentPop,
                            buildingType: currentBuildingId,
                            hasRoadAccess: hasRoadAccess
                        });
                        
                        if (purpleEvolutionCheck.canEvolve) {
                            removeInteractiveObject(buildings[x][y]);
                            const newUniqueBuildingId = makeDbItemId('House-Purple', x, y);
                            const keys = { type : "House-Purple", price: assetsPrices["House-Purple"].price}
                            await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                            buildings[x][y] = assetManager.createAsset('House-Purple', x, y);
                            // Add to appropriate zone group (NOT directly to scene)
                            const zoneX = Math.floor(x / ZONE_SIZE);
                            const zoneY = Math.floor(y / ZONE_SIZE);
                            const citySize = city.size || 16;
                            const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                            if (zoneGroups[zoneIndex]) {
                                zoneGroups[zoneIndex].add(buildings[x][y]);
                            } else {
                                // Fallback: add directly to scene if zone group doesn't exist
                                scene.add(buildings[x][y]);
                            }
                            console.log('[scene.js] House evolved: House-Red → House-Purple (well-fed)', {
                                houseId: currentUniqueID,
                                newId: newUniqueBuildingId,
                                population: currentPop,
                                foodStocks: houseFoodStocks
                            });
                        }
                    }
                    
                    /* house regression: Purple → Red if conditions no longer met */
                    // House-Purple becomes House-Red when conditions are no longer met
                    else if (currentBuildingId === 'House-Purple') {
                        const purpleEvolutionCheck = canHouseEvolveToPurple({
                            stocks: houseFoodStocks,
                            population: currentPop,
                            buildingType: 'House-Red', // Check if it would qualify as House-Red
                            hasRoadAccess: hasRoadAccess
                        });
                        
                        if (!purpleEvolutionCheck.canEvolve) {
                            removeInteractiveObject(buildings[x][y]);
                            const newUniqueBuildingId = makeDbItemId('House-Red', x, y);
                            const keys = { type : "House-Red", price: assetsPrices["House-Red"].price}
                            await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                            buildings[x][y] = assetManager.createAsset('House-Red', x, y);
                            // Add to appropriate zone group (NOT directly to scene)
                            const zoneX = Math.floor(x / ZONE_SIZE);
                            const zoneY = Math.floor(y / ZONE_SIZE);
                            const citySize = city.size || 16;
                            const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                            if (zoneGroups[zoneIndex]) {
                                zoneGroups[zoneIndex].add(buildings[x][y]);
                            } else {
                                // Fallback: add directly to scene if zone group doesn't exist
                                scene.add(buildings[x][y]);
                            }
                            console.log('[scene.js] House regressed: House-Purple → House-Red (conditions no longer met)', {
                                houseId: currentUniqueID,
                                newId: newUniqueBuildingId,
                                population: currentPop,
                                reason: purpleEvolutionCheck.reason,
                                foodStocks: houseFoodStocks
                            });
                        }
                    }

                    /* house evolution to stage 2 (palace) - using unified helper function */
                    const evolutionCheck = canHouseEvolveToPalace({
                        stocks: houseFoodStocks,
                        population: currentPop,
                        buildingType: currentBuildingId,
                        firstHouses: firstHouses
                    });
                    
                    if(evolutionCheck.canEvolve) {
                        removeInteractiveObject(buildings[x][y]);
                        const newUniqueBuildingId = makeDbItemId('House-2Story', x, y);
                        const keys = { type : "House-2Story", price: assetsPrices["House-2Story"].price}
                        
                        // Preserve neighbors and roads data before evolution
                        const houseNeighborsBeforeEvolution = houseNeighbors || [];
                        const { roadCount: roadsBeforeEvolution } = checkRoadAccess(houseNeighborsBeforeEvolution);
                        
                        // Update house name in database (same pattern as House-Red evolution)
                        const updateResult = await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                        
                        // If updateHouseName failed (house not found), create the house entry
                        if (!updateResult || !updateResult.success) {
                            // House doesn't exist in DB - create it with all necessary fields
                            const newHouseData = {
                                name: newUniqueBuildingId,
                                type: keys.type,
                                price: keys.price,
                                x: x,
                                y: y,
                                neighbors: houseNeighborsBeforeEvolution,
                                pop: currentPop,
                                stocks: houseFoodStocks || { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
                                roads: roadsBeforeEvolution,
                                worldTime: worldTime || time
                            };
                            await housesStore.addHouse(newHouseData);
                        } else {
                            // House was successfully renamed - ensure neighbors and roads are preserved
                            await housesStore.updateHouseFields(newUniqueBuildingId, {
                                neighbors: houseNeighborsBeforeEvolution,
                                roads: roadsBeforeEvolution
                            });
                        }
                        
                        // IMPORTANT: Update currentBuildingId and currentUniqueID to reflect the evolution
                        // This ensures subsequent code in the same loop iteration uses the correct ID
                        currentBuildingId = 'House-2Story';
                        const oldUniqueID = currentUniqueID;
                        currentUniqueID = newUniqueBuildingId;
                        
                        // Update buildingData to reflect the evolution (used later for neighbor updates)
                        if (buildingData) {
                            buildingData.currentBuildingId = currentBuildingId;
                            buildingData.currentUniqueID = currentUniqueID;
                        }
                        
                        buildings[x][y] = assetManager.createAsset('House-2Story', x, y);
                        // Add to appropriate zone group (NOT directly to scene)
                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const citySize = city.size || 16;
                        const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(buildings[x][y]);
                        } else {
                            // Fallback: add directly to scene if zone group doesn't exist
                            scene.add(buildings[x][y]);
                        }
                        console.log('[scene.js] House evolved to palace:', {
                            houseId: oldUniqueID,
                            newId: currentUniqueID,
                            age: buildingAge,
                            population: currentPop,
                            roads: roadsBeforeEvolution,
                            neighborsCount: houseNeighborsBeforeEvolution.length
                        });
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
                        if (sharedMaterials && sharedMaterials['roads']) {
                            // Mettre à jour le matériau - utiliser directement le matériau partagé
                            // Three.js peut partager le même matériau entre plusieurs meshes
                            terrainMesh.material = sharedMaterials['roads'];
                            terrainMesh.name = 'roads';
                            terrainMesh.userData.id = 'roads';
                            terrainMesh.userData.type = 'roads';
                            terrainMesh.userData.x = x;
                            terrainMesh.userData.y = y;
                            terrainMesh.userData.isBuilding = false;
                            terrainMesh.userData.isRoad = true; // Mark as road for easier detection
                            
                            // S'assurer que le mesh est visible
                            terrainMesh.visible = true;
                            
                            // Forcer la mise à jour complète du mesh et du matériau
                            if (terrainMesh.material) {
                                terrainMesh.material.needsUpdate = true;
                                // Forcer la mise à jour de la texture
                                if (terrainMesh.material.map) {
                                    terrainMesh.material.map.needsUpdate = true;
                                }
                            }
                            
                            // Forcer la mise à jour de la géométrie si nécessaire
                            if (terrainMesh.geometry) {
                                terrainMesh.geometry.attributesNeedUpdate = true;
                            }
                            
                            // S'assurer que le parent du mesh est mis à jour
                            if (terrainMesh.parent) {
                                terrainMesh.parent.updateMatrixWorld(true);
                            }
                            
                            // Debug: vérifier l'état du mesh
                            console.log('[scene] Road material updated', {
                                x, y,
                                hasMaterial: !!terrainMesh.material,
                                materialType: terrainMesh.material?.type,
                                hasTexture: !!terrainMesh.material?.map,
                                textureLoaded: terrainMesh.material?.map?.image?.complete,
                                visible: terrainMesh.visible,
                                inScene: terrainMesh.parent !== null,
                                parentName: terrainMesh.parent?.name
                            });
                        } else {
                            console.warn('[scene] Shared materials for roads not available', { x, y, sharedMaterials });
                        }
                    } else {
                        console.warn('[scene] Terrain mesh not found for road placement', { x, y, terrainExists: !!terrain[x] });
                    }
                    // CRITICAL: Add terrain mesh to buildings array so it's detected as a neighbor
                    // Roads need to be in buildings array for neighbor detection to work
                    if (!buildings[x][y] && terrain[x] && terrain[x][y]) {
                        buildings[x][y] = terrain[x][y];
                    }
                } else if (currentBuildingId === 'roads' || buildings[x][y]?.userData?.isRoad) {
                    // FIX BUG 2: If removing a road, restore terrain to grass properly
                    if (terrain[x] && terrain[x][y]) {
                        const terrainMesh = terrain[x][y];
                        const sharedMaterials = assetManager.getSharedTerrainMaterials();
                        if (sharedMaterials && sharedMaterials['grass'] && terrainMesh.material) {
                            terrainMesh.material = sharedMaterials['grass'];
                            terrainMesh.name = 'grass';
                            terrainMesh.userData.id = 'grass';
                            terrainMesh.userData.type = 'grass';
                            terrainMesh.userData.isRoad = false; // Clear road flag
                            terrainMesh.userData.x = x;
                            terrainMesh.userData.y = y;
                            terrainMesh.userData.isBuilding = false;
                            // Ensure mesh is visible and in scene
                            terrainMesh.visible = true;
                            // Force material update
                            if (terrainMesh.material) {
                                terrainMesh.material.needsUpdate = true;
                            }
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
                        // Add to appropriate zone group (NOT directly to scene)
                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const citySize = city.size || 16;
                        const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(buildings[x][y]);
                        } else {
                            // Fallback: add directly to scene if zone group doesn't exist
                            scene.add(buildings[x][y]);
                        }
                    }

                    // Add the new building
                }
                }

            }

        }

        // Cleanup: Remove orphaned house records from IndexedDB (houses that don't exist in scene)
        // This ensures population is accurate and prevents ghost population from deleted houses
        try {
            const allHousesInDb = await housesStore.listAllHouses();
            const orphanedHouses = [];
            
            for (const house of allHousesInDb) {
                const x = house.x;
                const y = house.y;
                
                // Check if building exists in scene at this position
                if (x >= 0 && x < city.size && y >= 0 && y < city.size) {
                    const buildingInScene = buildings[x] && buildings[x][y];
                    const buildingType = buildingInScene?.userData?.type;
                    const expectedId = makeDbItemId(house.type, x, y);
                    
                    // If no building in scene, or building type doesn't match, it's orphaned
                    if (!buildingInScene || buildingType !== house.type) {
                        orphanedHouses.push(expectedId);
                    }
                } else {
                    // Invalid coordinates - definitely orphaned
                    const expectedId = makeDbItemId(house.type, x, y);
                    orphanedHouses.push(expectedId);
                }
            }
            
            // Delete orphaned houses
            if (orphanedHouses.length > 0) {
                console.log(`[Scene] Cleaning up ${orphanedHouses.length} orphaned house records from IndexedDB`);
                for (const houseId of orphanedHouses) {
                    await housesStore.deleteOneHouse(houseId);
                }
            }
        } catch (error) {
            console.warn('[Scene] Error during orphaned house cleanup:', error);
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

        // Calculate building counts and maintenance costs for budget operations
        let buildingCounts = {
            houses: 0,
            farms: 0,
            markets: 0,
            roads: 0,
            total: 0
        };
        
        // Maintenance costs per building type (per month)
        const maintenanceCosts = {
            'roads': 2,
            'House-Blue': 3,
            'House-Red': 3,
            'House-Purple': 3,
            'House-2Story': 3,
            'Farm': 1,
            'Market': 1
        };
        
        // Detailed breakdown for journal
        let maintenanceBreakdown = {
            roads: { count: 0, cost: 0 },
            houses: { count: 0, cost: 0 },
            farms: { count: 0, cost: 0 },
            markets: { count: 0, cost: 0 }
        };
        
        for(let x = 0; x < city.size; x++) {
            for(let y = 0; y < city.size; y++) {
                const building = buildings[x][y];
                if (building && building.userData && building.userData.type) {
                    const type = building.userData.type;
                    
                    // Calculate maintenance cost based on building type
                    let cost = 2; // Default cost
                    if (type.includes('roads')) {
                        cost = maintenanceCosts['roads'];
                        buildingCounts.roads++;
                        maintenanceBreakdown.roads.count++;
                        maintenanceBreakdown.roads.cost += cost;
                    } else if (type === 'House-Blue' || type === 'House-Red' || type === 'House-Purple' || type === 'House-2Story') {
                        cost = maintenanceCosts['House-Blue']; // All houses cost 3€
                        buildingCounts.houses++;
                        maintenanceBreakdown.houses.count++;
                        maintenanceBreakdown.houses.cost += cost;
                    } else if (type.includes('Farm')) {
                        cost = maintenanceCosts['Farm'];
                        buildingCounts.farms++;
                        maintenanceBreakdown.farms.count++;
                        maintenanceBreakdown.farms.cost += cost;
                    } else if (type.includes('Market')) {
                        cost = maintenanceCosts['Market'];
                        buildingCounts.markets++;
                        maintenanceBreakdown.markets.count++;
                        maintenanceBreakdown.markets.cost += cost;
                    }
                    
                    buildingCounts.total++;
                }
            }
        }

        // Daily budget operations - expenses and income
        try {
            if (window.budgetManager) {
                // Add taxes from houses (100€ per citizen, only in November)
                // Only collects if there is population
                await window.budgetManager.addTaxes(time);
                
                // Add building maintenance expenses - only once per month
                const timeInfo = TimeManager.getTimeInfo(time);
                const currentMonth = timeInfo.monthNumber; // Month number (1-12, then continues)
                
                // Only pay maintenance if we're in a different month than last time
                if (currentMonth !== lastMaintenanceMonth) {
                    // Calculate total maintenance cost from breakdown
                    const buildingAmount = maintenanceBreakdown.roads.cost + 
                                         maintenanceBreakdown.houses.cost + 
                                         maintenanceBreakdown.farms.cost + 
                                         maintenanceBreakdown.markets.cost;
                    
                    if (buildingAmount > 0) {
                        // Create detailed description with month name, year, and breakdown
                        const year = timeInfo.year + 1; // Year is 0-indexed, so add 1 for display
                        const monthName = timeInfo.month || 'Mois'; // Use 'month' property from TimeManager
                        
                        // Build structured breakdown data for journal display
                        const breakdownItems = [];
                        if (maintenanceBreakdown.roads.count > 0) {
                            breakdownItems.push({
                                label: 'Routes',
                                count: maintenanceBreakdown.roads.count,
                                unitCost: 2,
                                total: maintenanceBreakdown.roads.cost
                            });
                        }
                        if (maintenanceBreakdown.houses.count > 0) {
                            breakdownItems.push({
                                label: 'Maisons',
                                count: maintenanceBreakdown.houses.count,
                                unitCost: 3,
                                total: maintenanceBreakdown.houses.cost
                            });
                        }
                        if (maintenanceBreakdown.farms.count > 0) {
                            breakdownItems.push({
                                label: 'Fermes',
                                count: maintenanceBreakdown.farms.count,
                                unitCost: 1,
                                total: maintenanceBreakdown.farms.cost
                            });
                        }
                        if (maintenanceBreakdown.markets.count > 0) {
                            breakdownItems.push({
                                label: 'Marchés',
                                count: maintenanceBreakdown.markets.count,
                                unitCost: 1,
                                total: maintenanceBreakdown.markets.cost
                            });
                        }
                        
                        // Create description with structured data (JSON format for parsing)
                        const breakdownData = JSON.stringify(breakdownItems);
                        const maintenanceDescription = `Maintenance mensuelle - ${monthName} ${year} |BREAKDOWN|${breakdownData}|BREAKDOWN|`;
                        
                        await window.budgetManager.addBuildingMaintenance(buildingAmount, maintenanceDescription);
                        lastMaintenanceMonth = currentMonth;
                        console.log(`[Scene] Building maintenance paid for month ${currentMonth} (${monthName} ${year})`, {
                            amount: buildingAmount,
                            breakdown: maintenanceBreakdown
                        });
                    }
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
        const famishedPopulation = await housesStore.getFamishedPopulation();
        
        // Manage multiple citizens based on current population state (from IndexedDB)
        const targetCitizenCount = Math.min(currentPopulation, MAX_CITIZENS);
        const currentCitizenCount = citizens.filter(c => c.spawned && c.character && c.character.visible).length;
        
        // Spawn new citizens if population increased
        if (targetCitizenCount > currentCitizenCount) {
            const citizensToSpawn = targetCitizenCount - currentCitizenCount;
            for (let i = 0; i < citizensToSpawn; i++) {
                // Check if we have an available citizen slot
                if (citizens.length < MAX_CITIZENS) {
                    createCitizenInstance().then(newCitizen => {
                        if (newCitizen) {
                            citizens.push(newCitizen);
                            spawnCitizenCharacter(newCitizen, city);
                        }
                    });
                } else {
                    // Find a hidden citizen to reuse
                    const hiddenCitizen = citizens.find(c => !c.spawned || !c.character.visible);
                    if (hiddenCitizen) {
                        spawnCitizenCharacter(hiddenCitizen, city);
                    }
                }
            }
        }
        
        // Hide citizens if population decreased
        if (targetCitizenCount < currentCitizenCount) {
            const citizensToHide = currentCitizenCount - targetCitizenCount;
            let hiddenCount = 0;
            for (const citizen of citizens) {
                if (citizen.spawned && citizen.character && citizen.character.visible && hiddenCount < citizensToHide) {
                    hideCitizenCharacter(citizen);
                    hiddenCount++;
                }
            }
        }
        
        // Recalculate citizen paths each turn to reflect current city state
        citizens.forEach(citizen => {
            if (citizen.character && citizen.spawned && time !== citizen.lastPathRecalculationTurn) {
                // Check if citizen is waiting for a road and if a road now exists
                if (citizen.waitingForRoad) {
                    const borderRoads = findBorderRoads(city);
                    if (borderRoads.length > 0) {
                        // Road appeared - spawn citizen to walk in
                        citizen.waitingForRoad = false;
                        spawnCitizenCharacter(citizen, city);
                    }
                }
                
                // If citizen is on road, validate and recalculate path if needed
                if (citizen.onRoad && citizen.path.length > 0) {
                    // Validate current path
                    if (!validatePath(citizen.path)) {
                        // Path is invalid - recalculate from current position
                        recalculateCitizenPath(citizen);
                    } else {
                        // Path is valid, but recalculate anyway to pick up new roads
                        // This ensures the character can use newly built roads
                        recalculateCitizenPath(citizen);
                    }
                }
                
                citizen.lastPathRecalculationTurn = time;
            }
        });
        
        // Get budget data from BudgetManager
        let funds = 0;
        if (window.budgetManager) {
            const budgetData = await window.budgetManager.getCurrentBudget();
            funds = budgetData.funds;
        }

        // Update population, famished population and funds display in general bar using GameUI
        // This ensures consistent UI updates (IndexedDB is source of truth)
        if (window.gameUI) {
            window.gameUI.updatePopulation(currentPopulation || 0);
            window.gameUI.updateFamishedPopulation(famishedPopulation || 0);
            window.gameUI.updateFunds(funds);
        } else {
            // Fallback to direct DOM update if GameUI not available
            const displayPop = document.querySelector('.display-pop');
            const displayHungerPop = document.querySelector('.display-hunger-pop');
            const displayFunds = document.querySelector('.display-funds');
            if (displayPop) {
                displayPop.textContent = (currentPopulation || 0).toString();
            }
            if (displayHungerPop) {
                displayHungerPop.textContent = (famishedPopulation || 0).toString();
            }
            if (displayFunds) {
                displayFunds.textContent = funds.toString();
            }
        }

        console.log('[scene.js] Updated top bar display:', {
            population: currentPopulation,
            famishedPopulation: famishedPopulation,
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

        // Configure shadows for first directional light (dynamic resolution based on city size)
        if (dirLight1.castShadow) {
            dirLight1.shadow.camera.left = -10;
            dirLight1.shadow.camera.right = 10;
            dirLight1.shadow.camera.top = 0;
            dirLight1.shadow.camera.bottom = -10;
            // Dynamic shadow map resolution based on city size
            // Smaller cities = lower resolution, larger cities = higher resolution
            // This balances quality and performance
            const shadowMapSize = citySize <= 12 ? 256 : citySize <= 16 ? 512 : 1024;
            dirLight1.shadow.mapSize.width = shadowMapSize;
            dirLight1.shadow.mapSize.height = shadowMapSize;
            dirLight1.shadow.camera.near = 0.5;
            dirLight1.shadow.camera.far = 50;
            
            // Store reference to light for dynamic resolution updates
            scene.userData.shadowLight = dirLight1;
            scene.userData.shadowMapBaseSize = shadowMapSize;
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
     * Checks if a tile at (x, y) is a road
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    function isRoadTile(x, y) {
        if (x < 0 || x >= buildings.length || y < 0 || y >= buildings[0]?.length) {
            return false;
        }
        const building = buildings[x][y];
        const terrainTile = terrain[x]?.[y];
        
        return (building && (building.userData?.isRoad || building.userData?.type === 'roads' || building.name === 'roads')) ||
               (terrainTile && (terrainTile.userData?.isRoad || terrainTile.name === 'roads'));
    }

    /**
     * Checks if a tile at (x, y) has a building (non-road)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    function hasBuilding(x, y) {
        if (x < 0 || x >= buildings.length || y < 0 || y >= buildings[0]?.length) {
            return false;
        }
        const building = buildings[x][y];
        return building && !building.userData?.isRoad && building.userData?.type !== 'roads' && building.name !== 'roads';
    }

    /**
     * Gets adjacent road tiles (up, down, left, right)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Array<{x: number, y: number}>} Array of adjacent road coordinates
     */
    function getAdjacentRoads(x, y) {
        const adjacent = [];
        const directions = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];
        
        for (const dir of directions) {
            const newX = x + dir.x;
            const newY = y + dir.y;
            if (isRoadTile(newX, newY) && !hasBuilding(newX, newY)) {
                adjacent.push({ x: newX, y: newY });
            }
        }
        
        return adjacent;
    }

    /**
     * Finds road tiles on the border of the map
     * @param {Object} city - City object
     * @returns {Array<{x: number, y: number}>} Array of border road coordinates
     */
    function findBorderRoads(city) {
        const borderRoads = [];
        const size = city.size;
        
        // Check all border tiles
        for (let i = 0; i < size; i++) {
            // Top border (y = 0)
            if (isRoadTile(i, 0)) {
                borderRoads.push({ x: i, y: 0 });
            }
            // Bottom border (y = size - 1)
            if (isRoadTile(i, size - 1)) {
                borderRoads.push({ x: i, y: size - 1 });
            }
            // Left border (x = 0)
            if (isRoadTile(0, i)) {
                borderRoads.push({ x: 0, y: i });
            }
            // Right border (x = size - 1)
            if (isRoadTile(size - 1, i)) {
                borderRoads.push({ x: size - 1, y: i });
            }
        }
        
        return borderRoads;
    }

    /**
     * Gets the tile coordinates from a world position
     * @param {THREE.Vector3} position - World position
     * @returns {{x: number, y: number}} Tile coordinates
     */
    function worldToTile(position) {
        return {
            x: Math.round(position.x),
            y: Math.round(position.z)
        };
    }

    /**
     * Validates if the current path is still valid (all tiles are roads, no buildings)
     * @param {Array<{x: number, y: number}>} path - Path to validate
     * @returns {boolean} True if path is valid, false otherwise
     */
    function validatePath(path) {
        if (!path || path.length === 0) {
            return false;
        }
        
        for (const tile of path) {
            if (!isRoadTile(tile.x, tile.y) || hasBuilding(tile.x, tile.y)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Recalculates the citizen path from current position
     * @param {CitizenData} citizen - The citizen data object
     * @returns {boolean} True if path was successfully recalculated, false otherwise
     */
    function recalculateCitizenPath(citizen) {
        if (!citizen || !citizen.character || !citizen.onRoad) {
            return false;
        }
        
        const currentTile = worldToTile(citizen.character.position);
        
        // Check if current position is still on a road
        if (!isRoadTile(currentTile.x, currentTile.y) || hasBuilding(currentTile.x, currentTile.y)) {
            // Not on a road - try to find nearest road
            const adjacentRoads = getAdjacentRoads(currentTile.x, currentTile.y);
            if (adjacentRoads.length > 0) {
                const nearestRoad = adjacentRoads[0];
                citizen.path = createRoadPath(nearestRoad.x, nearestRoad.y);
                // Move character to nearest road
                citizen.character.position.set(nearestRoad.x, 0, nearestRoad.y);
                citizen.currentPathIndex = 0;
                citizen.pathDirection = 1;
                if (citizen.path.length > 1) {
                    const nextTile = citizen.path[1];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0, nextTile.y);
                }
                return true;
            } else {
                // No road nearby - switch to idle
                citizen.isWalking = false;
                citizen.targetPosition = null;
                citizen.onRoad = false;
                const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                let idleAnimation = null;
                for (const name of idleNames) {
                    if (citizenAnimations[name]) {
                        idleAnimation = name;
                        break;
                    }
                }
                if (idleAnimation) {
                    switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                }
                return false;
            }
        }
        
        // Current position is on a road - create new path from here
        citizen.path = createRoadPath(currentTile.x, currentTile.y);
        
        if (citizen.path.length > 1) {
            // Find the closest tile in the new path to current position
            let closestIndex = 0;
            let minDistance = Infinity;
            for (let i = 0; i < citizen.path.length; i++) {
                const tile = citizen.path[i];
                const distance = Math.abs(tile.x - currentTile.x) + Math.abs(tile.y - currentTile.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
            }
            
            citizen.currentPathIndex = closestIndex;
            citizen.pathDirection = 1;
            
            // Set next target
            if (citizen.currentPathIndex < citizen.path.length - 1) {
                const nextTile = citizen.path[citizen.currentPathIndex + 1];
                citizen.targetPosition = new THREE.Vector3(nextTile.x, 0, nextTile.y);
            } else if (citizen.currentPathIndex > 0) {
                // At end of path, go backwards
                citizen.pathDirection = -1;
                const nextTile = citizen.path[citizen.currentPathIndex - 1];
                citizen.targetPosition = new THREE.Vector3(nextTile.x, 0, nextTile.y);
            }
            
            return true;
        } else {
            // No path available
            citizen.isWalking = false;
            citizen.targetPosition = null;
            return false;
        }
    }

    /**
     * Creates a linear path following roads (not a loop)
     * Starts from a road tile and follows adjacent roads until reaching an end
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate
     * @param {number} maxPathLength - Maximum path length (default: 50)
     * @returns {Array<{x: number, y: number}>} Path of road tiles
     */
    function createRoadPath(startX, startY, maxPathLength = 50) {
        const path = [{ x: startX, y: startY }];
        const visited = new Set();
        visited.add(`${startX},${startY}`);
        
        let currentX = startX;
        let currentY = startY;
        let attempts = 0;
        const maxAttempts = maxPathLength * 2;
        
        while (path.length < maxPathLength && attempts < maxAttempts) {
            const adjacent = getAdjacentRoads(currentX, currentY);
            
            // Filter out already visited tiles
            const unvisited = adjacent.filter(road => {
                const key = `${road.x},${road.y}`;
                return !visited.has(key);
            });
            
            if (unvisited.length === 0) {
                // No unvisited roads - reached end of road, return current path
                break;
            } else {
                // Pick the first unvisited road (simple forward movement)
                const next = unvisited[0];
                currentX = next.x;
                currentY = next.y;
                path.push({ x: currentX, y: currentY });
                visited.add(`${currentX},${currentY}`);
            }
            
            attempts++;
        }
        
        return path;
    }

    /**
     * Hides and removes a citizen character
     * @param {CitizenData} citizen - The citizen data object to hide
     */
    function hideCitizenCharacter(citizen) {
        if (!citizen || !citizen.character) {
            return;
        }
        
        // Hide the character
        citizen.character.visible = false;
        
        // Remove from scene
        if (citizen.character.parent) {
            citizen.character.parent.remove(citizen.character);
        }
        
        // Stop any animations
        if (citizen.mixer) {
            // Stop all actions - get actions from mixer for each clip
            Object.values(citizenAnimations).forEach(clip => {
                if (clip) {
                    const action = citizen.mixer.clipAction(clip);
                    if (action && typeof action.isRunning === 'function' && action.isRunning()) {
                        action.fadeOut(0.2);
                        action.stop();
                    }
                }
            });
            // Also stop the current action if it exists
            if (citizen.currentAction && typeof citizen.currentAction.isRunning === 'function' && citizen.currentAction.isRunning()) {
                citizen.currentAction.fadeOut(0.2);
                citizen.currentAction.stop();
            }
        }
        
        // Reset all citizen state
        citizen.spawned = false;
        citizen.isWalking = false;
        citizen.targetPosition = null;
        citizen.onRoad = false;
        citizen.waitingForRoad = false;
        citizen.path = [];
        citizen.currentPathIndex = 0;
        citizen.pathDirection = 1;
        citizen.wasWalkingBeforePause = false;
        citizen.lastPathRecalculationTurn = -1;
    }

    /**
     * Spawns a citizen character from outside the scene and makes it walk in
     * @param {CitizenData} citizen - The citizen data object to spawn
     * @param {Object} city - The city object with size information
     */
    function spawnCitizenCharacter(citizen, city) {
        if (!citizen || !citizen.character) {
            return;
        }
        
        // If already spawned and visible, don't respawn (unless explicitly needed)
        if (citizen.spawned && citizen.character.visible && citizen.character.parent) {
            return;
        }
        
        // Reset state to ensure fresh entry
        citizen.spawned = false;
        citizen.isWalking = false;
        citizen.targetPosition = null;
        citizen.onRoad = false;
        citizen.waitingForRoad = false;
        citizen.path = [];
        citizen.currentPathIndex = 0;
        citizen.pathDirection = 1;
        citizen.wasWalkingBeforePause = false;
        citizen.lastPathRecalculationTurn = -1;
        
        // Ensure character is removed from scene before respawning
        if (citizen.character.parent) {
            citizen.character.parent.remove(citizen.character);
        }
        
        // Check for border roads
        const borderRoads = findBorderRoads(city);
        
        if (borderRoads.length === 0) {
            // No road access on border - wait outside
            citizen.waitingForRoad = true;
            citizen.spawned = true;
            
            // Position outside scene
            const spawnX = -3;
            const spawnZ = -3;
            citizen.character.position.set(spawnX, 0, spawnZ);
            citizen.character.visible = true;
            scene.add(citizen.character);
            
            // Play idle animation while waiting
            const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
            let idleAnimation = null;
            for (const name of idleNames) {
                if (citizenAnimations[name]) {
                    idleAnimation = name;
                    break;
                }
            }
            if (idleAnimation) {
                switchCitizenAnimation(citizen, idleAnimation, true, 0.2);
            }
            
            return;
        }
        
        // Road access found - spawn and walk to first border road
        citizen.spawned = true;
        citizen.waitingForRoad = false;
        
        // Find closest border road (or use first one)
        // For multiple citizens, we can distribute them across border roads
        const borderRoadIndex = citizens.length % borderRoads.length;
        const targetRoad = borderRoads[borderRoadIndex];
        
        // Calculate spawn position (outside the scene, near the border road)
        // Spawn from outside based on which border the road is on
        let spawnX, spawnZ;
        if (targetRoad.x === 0) {
            // Left border
            spawnX = -3;
            spawnZ = targetRoad.y;
        } else if (targetRoad.x === city.size - 1) {
            // Right border
            spawnX = city.size + 2;
            spawnZ = targetRoad.y;
        } else if (targetRoad.y === 0) {
            // Top border
            spawnX = targetRoad.x;
            spawnZ = -3;
        } else {
            // Bottom border
            spawnX = targetRoad.x;
            spawnZ = city.size + 2;
        }
        
        // Set initial position (outside scene)
        citizen.character.position.set(spawnX, 0, spawnZ);
        citizen.character.visible = true;
        scene.add(citizen.character);
        
        // Set target position (the border road)
        citizen.targetPosition = new THREE.Vector3(targetRoad.x, 0, targetRoad.y);
        citizen.onRoad = false;
        
        // Switch to walk animation
        const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
        let walkAnimation = null;
        for (const name of walkNames) {
            if (citizenAnimations[name]) {
                walkAnimation = name;
                break;
            }
        }
        
        // If no walk animation found, try the second animation (often walk is second after idle)
        if (!walkAnimation && Object.keys(citizenAnimations).length > 1) {
            const animationKeys = Object.keys(citizenAnimations);
            walkAnimation = animationKeys[1]; // Use second animation
        }
        
        if (walkAnimation) {
            switchCitizenAnimation(citizen, walkAnimation, true, 0.2);
            citizen.isWalking = true;
        } else {
            console.warn('[Scene] No walk animation found, using first available');
            citizen.isWalking = true;
        }
    }

    /**
     * Switches a citizen's animation
     * @param {CitizenData} citizen - The citizen data object
     * @param {string} animationName - Name of the animation to play (e.g., 'idle', 'walk', 'Walking')
     * @param {boolean} fadeIn - Whether to fade in the new animation (default: true)
     * @param {number} fadeDuration - Duration of fade transition in seconds (default: 0.3)
     */
    function switchCitizenAnimation(citizen, animationName, fadeIn = true, fadeDuration = 0.3) {
        if (!citizen || !citizen.mixer || !citizenAnimations[animationName]) {
            console.warn('[Scene] Cannot switch animation:', animationName, 'Available:', Object.keys(citizenAnimations));
            return;
        }
        
        // Stop current animation
        if (citizen.currentAction) {
            if (fadeIn) {
                citizen.currentAction.fadeOut(fadeDuration);
            } else {
                citizen.currentAction.stop();
            }
        }
        
        // Play new animation
        const newAction = citizen.mixer.clipAction(citizenAnimations[animationName]);
        if (fadeIn) {
            newAction.reset().fadeIn(fadeDuration).play();
        } else {
            newAction.reset().play();
        }
        
        citizen.currentAction = newAction;
    }

    // Store animation clips (loaded once, shared across all citizens)
    let citizenAnimationsLoaded = false;
    
    /**
     * Loads animation clips (shared across all citizens, loaded once)
     */
    function loadCitizenAnimations() {
        if (citizenAnimationsLoaded) {
            return;
        }
        
        const gltfLoader = new GLTFLoader();
        const baseUrl = config.assets.baseUrl || '/';
        const citizenPath = `${baseUrl}citizen02/citizenAnimated02.glb`.replace(/\/+/g, '/');
        
        gltfLoader.load(
            citizenPath,
            (gltf) => {
                // Store all animations (shared across all citizens)
                if (gltf.animations && gltf.animations.length > 0) {
                    gltf.animations.forEach((clip) => {
                        citizenAnimations[clip.name] = clip;
                        console.log('[Scene] Found animation:', clip.name, `(${clip.duration.toFixed(2)}s)`);
                    });
                    citizenAnimationsLoaded = true;
                } else {
                    console.warn('[Scene] No animations found in citizen GLB file');
                }
            },
            null,
            (error) => {
                console.error('[Scene] Error loading citizen animations:', error);
            }
        );
    }
    
    /**
     * Creates a new citizen instance by loading the GLB file
     * @returns {Promise<CitizenData|null>} New citizen data object or null if loading fails
     */
    function createCitizenInstance() {
        return new Promise((resolve) => {
            const gltfLoader = new GLTFLoader();
            const baseUrl = config.assets.baseUrl || '/';
            const citizenPath = `${baseUrl}citizen02/citizenAnimated02.glb`.replace(/\/+/g, '/');
            
            gltfLoader.load(
                citizenPath,
                (gltf) => {
                    const citizen = gltf.scene;
                    citizen.name = `citizen-${citizens.length}`;
                    
                    // Apply scale: 0.5 = half size (same as original single citizen)
                    const characterScale = 0.5;
                    citizen.scale.set(characterScale, characterScale, characterScale);
                    
                    // Ensure character receives proper lighting and shadows
                    citizen.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            // Enable shadows for the character
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Ensure materials are properly lit
                            if (child.material) {
                                // Make sure material responds to lights
                                if (child.material instanceof THREE.MeshBasicMaterial) {
                                    // Convert BasicMaterial to LambertMaterial for proper lighting
                                    const newMaterial = new THREE.MeshLambertMaterial({
                                        map: child.material.map,
                                        color: child.material.color,
                                        transparent: child.material.transparent,
                                        opacity: child.material.opacity
                                    });
                                    child.material = newMaterial;
                                }
                                
                                // Ensure material properties are set for lighting
                                if (child.material.needsUpdate !== undefined) {
                                    child.material.needsUpdate = true;
                                }
                            }
                        }
                    });
                    
                    // Store animations if not already loaded
                    if (gltf.animations && gltf.animations.length > 0 && !citizenAnimationsLoaded) {
                        gltf.animations.forEach((clip) => {
                            citizenAnimations[clip.name] = clip;
                        });
                        citizenAnimationsLoaded = true;
                    }
                    
                    // Create new citizen data
                    const citizenData = new CitizenData();
                    citizenData.character = citizen;
                    
                    // Set up animations for this citizen
                    if (Object.keys(citizenAnimations).length > 0) {
                        citizenData.mixer = new AnimationMixer(citizen);
                        
                        // Start with idle animation immediately
                        const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                        let idleAnimation = null;
                        for (const name of idleNames) {
                            if (citizenAnimations[name]) {
                                idleAnimation = name;
                                break;
                            }
                        }
                        if (!idleAnimation && Object.keys(citizenAnimations).length > 0) {
                            idleAnimation = Object.keys(citizenAnimations)[0];
                        }
                        if (idleAnimation) {
                            const action = citizenData.mixer.clipAction(citizenAnimations[idleAnimation]);
                            action.play();
                            citizenData.currentAction = action;
                        }
                    }
                    
                    resolve(citizenData);
                },
                (progress) => {
                    // Loading progress (optional)
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        console.log(`[Scene] Loading citizen ${citizens.length}: ${percentComplete.toFixed(2)}%`);
                    }
                },
                (error) => {
                    console.error('[Scene] Error loading citizen character:', error);
                    console.error('[Scene] Tried to load from:', citizenPath);
                    resolve(null);
                }
            );
        });
    }

    /**
     * Helper function to get interactive objects for raycasting
     * OPTIMIZATION: Returns only buildings + terrain, not backdrop/lights/etc.
     * Since objects are now in zone groups, we collect them from all zone groups
     */
    function getInteractiveObjects() {
        // Collect all objects from zone groups (they contain buildings + terrain)
        const objects = [];
        zoneGroups.forEach(zoneGroup => {
            zoneGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    objects.push(child);
                }
            });
        });
        return objects.length > 0 ? objects : scene.children;
    }

    /**
     * Helper function to remove an object from scene, interactive group, and zone groups
     * OPTIMIZATION: Ensures objects are properly cleaned up from all groups
     */
    /**
     * Helper function to remove an object from scene and zone groups
     * OPTIMIZATION: Ensures objects are properly cleaned up
     * Objects are now in zone groups (not directly in scene or interactive group)
     */
    function removeInteractiveObject(object) {
        if (!object) return;
        
        // Remove from zone groups (this also removes from scene since zone groups are in scene)
        zoneGroups.forEach(zoneGroup => {
            if (zoneGroup.children.includes(object)) {
                zoneGroup.remove(object);
            }
        });
        
        // Fallback: remove directly from scene if not in any zone group
        if (scene.children.includes(object)) {
            scene.remove(object);
        }
    }

    /**
     * OPTIMIZATION: Update frustum culling for zone groups
     * Disables rendering of zones outside camera frustum
     */
    let lastFrustumUpdateCameraPosition = new THREE.Vector3();
    const FRUSTUM_UPDATE_THRESHOLD = 3; // Only update frustum culling if camera moved > 3 units
    
    function updateFrustumCulling() {
        // Only update if camera moved significantly (performance optimization)
        const currentCameraPos = camera.camera.position.clone();
        const distanceMoved = currentCameraPos.distanceTo(lastFrustumUpdateCameraPosition);
        
        if (distanceMoved < FRUSTUM_UPDATE_THRESHOLD && zoneGroups.length > 0) {
            return; // Skip update if camera hasn't moved much
        }
        
        lastFrustumUpdateCameraPosition.copy(currentCameraPos);
        
        // Create frustum from camera
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4();
        matrix.multiplyMatrices(camera.camera.projectionMatrix, camera.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix);
        
        // Update visibility of each zone group
        let zonesHidden = 0;
        let zonesVisible = 0;
        
        zoneGroups.forEach(zoneGroup => {
            if (zoneGroup.children.length === 0) {
                zoneGroup.visible = false;
                return;
            }
            
            // Calculate bounding box for this zone
            const box = new THREE.Box3();
            zoneGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    box.expandByObject(child);
                }
            });
            
            // Check if zone intersects with frustum
            const isVisible = frustum.intersectsBox(box);
            zoneGroup.visible = isVisible;
            
            if (isVisible) {
                zonesVisible++;
            } else {
                zonesHidden++;
            }
        });
        
        // Removed console.log to reduce JavaScript execution time
        // Uncomment for debugging: console.log(`[Frustum Culling] Visible: ${zonesVisible} zones | Hidden: ${zonesHidden} zones`);
    }
    
    /**
     * OPTIMIZATION: Update shadow casting based on distance from camera
     * Disables shadows for objects far from camera to improve performance
     * @param {number} maxShadowDistance - Maximum distance for shadow casting (default: 50)
     */
    let lastShadowUpdateCameraPosition = new THREE.Vector3();
    const SHADOW_UPDATE_THRESHOLD = 5; // Only update shadows if camera moved > 5 units
    
    function updateShadowCasting(maxShadowDistance = 50) {
        // Only update if camera moved significantly (performance optimization)
        const currentCameraPos = camera.camera.position.clone();
        const distanceMoved = currentCameraPos.distanceTo(lastShadowUpdateCameraPosition);
        
        if (distanceMoved < SHADOW_UPDATE_THRESHOLD) {
            return; // Skip update if camera hasn't moved much
        }
        
        lastShadowUpdateCameraPosition.copy(currentCameraPos);
        
        // OPTIMIZATION: Dynamically adjust shadow map resolution based on camera distance
        // Closer camera = higher resolution, farther camera = lower resolution
        const shadowLight = scene.userData.shadowLight;
        const baseShadowMapSize = scene.userData.shadowMapBaseSize || 512;
        
        if (shadowLight && shadowLight.castShadow) {
            // Calculate average distance to visible buildings
            let totalDistance = 0;
            let buildingCount = 0;
            
            for(let x = 0; x < buildings.length; x++) {
                for(let y = 0; y < buildings[x]?.length; y++) {
                    const building = buildings[x]?.[y];
                    if (building) {
                        const distance = currentCameraPos.distanceTo(building.position);
                        if (distance < maxShadowDistance * 1.5) { // Check slightly beyond threshold
                            totalDistance += distance;
                            buildingCount++;
                        }
                    }
                }
            }
            
            if (buildingCount > 0) {
                const avgDistance = totalDistance / buildingCount;
                // Adjust shadow map resolution: closer = higher res, farther = lower res
                // Range: 256 (far) to baseSize (close)
                let dynamicSize = baseShadowMapSize;
                if (avgDistance > maxShadowDistance * 0.8) {
                    dynamicSize = Math.max(256, Math.floor(baseShadowMapSize * 0.5)); // Far: reduce to 50%
                } else if (avgDistance > maxShadowDistance * 0.5) {
                    dynamicSize = Math.max(256, Math.floor(baseShadowMapSize * 0.75)); // Medium: reduce to 75%
                }
                // Close: use base size (100%)
                
                // Only update if resolution changed significantly (avoid constant updates)
                if (Math.abs(shadowLight.shadow.mapSize.width - dynamicSize) > 64) {
                    shadowLight.shadow.mapSize.width = dynamicSize;
                    shadowLight.shadow.mapSize.height = dynamicSize;
                    shadowLight.shadow.map?.dispose(); // Dispose old map
                    shadowLight.shadow.needsUpdate = true; // Force update
                }
            }
        }
        
        // Update shadows for all buildings
        let shadowUpdates = 0;
        for(let x = 0; x < buildings.length; x++) {
            for(let y = 0; y < buildings[x]?.length; y++) {
                const building = buildings[x]?.[y];
                if (building) {
                    const distance = currentCameraPos.distanceTo(building.position);
                    const shouldCastShadow = distance < maxShadowDistance;
                    
                    building.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.castShadow !== shouldCastShadow) {
                                child.castShadow = shouldCastShadow;
                                child.receiveShadow = shouldCastShadow; // Also disable receiveShadow for consistency
                                shadowUpdates++;
                            }
                        }
                    });
                }
            }
        }
        
        if (shadowUpdates > 0) {
            const shadowRes = shadowLight?.shadow?.mapSize?.width || 'N/A';
            console.log(`[Performance] Updated shadows for ${shadowUpdates} meshes | Shadow map: ${shadowRes}px (distance threshold: ${maxShadowDistance})`);
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
            // DISABLED: Don't change material color on hover/focus
            // Clear previous focus (if object supports it)
            // if (focusedObject && typeof focusedObject.setFocused === 'function') {
            //     focusedObject.setFocused(false);
            // }
            focusedObject = newFocusedObject;
            // DISABLED: Don't change material color on hover/focus
            // Set new focus (if object supports it)
            // if (focusedObject && typeof focusedObject.setFocused === 'function') {
            //     focusedObject.setFocused(true);
            // }
        }
    }

    /**
     * Updates the selected object and calls the selection callback
     * @param {THREE.Object3D} object - The object to select (or null to deselect)
     */
    function updateSelectedObject(object) {
        // Clear previous selection highlight if existed
        // DISABLED: Don't change material color when selecting objects for info panel
        // if (selectedObject && typeof selectedObject.setSelected === 'function') {
        //     selectedObject.setSelected(false);
        // }

        selectedObject = object;

        // Set new selection highlight if exists
        // DISABLED: Don't change material color when selecting objects for info panel
        // if (selectedObject && typeof selectedObject.setSelected === 'function') {
        //     selectedObject.setSelected(true);
        // }

        // Call the selection callback if registered
        if (this.onObjectSelected && object) {
            this.onObjectSelected(object);
        }
    }

    // Performance statistics (optional, can be enabled via localStorage)
    let performanceStats = {
        enabled: localStorage.getItem('show-performance-stats') === 'true',
        frameCount: 0,
        lastLogTime: performance.now()
    };
    
    function logPerformanceStats() {
        if (!performanceStats.enabled) return;
        
        performanceStats.frameCount++;
        const now = performance.now();
        
        // Log stats every second
        if (now - performanceStats.lastLogTime > 1000) {
            const info = renderer.info;
            const fps = performanceStats.frameCount;
            const drawCalls = info.render.calls;
            const triangles = info.render.triangles;
            const geometries = info.memory.geometries;
            const textures = info.memory.textures;
            
            // Removed console.log to reduce JavaScript execution time
            // Uncomment for debugging: console.log(`[Performance] FPS: ~${fps} | Draw Calls: ${drawCalls} | Triangles: ${triangles.toLocaleString()} | Geometries: ${geometries} | Textures: ${textures}`);
            
            performanceStats.frameCount = 0;
            performanceStats.lastLogTime = now;
        }
    }
    
    // Expose function to toggle stats
    window.togglePerformanceStats = function() {
        performanceStats.enabled = !performanceStats.enabled;
        localStorage.setItem('show-performance-stats', performanceStats.enabled.toString());
        console.log(`Performance stats ${performanceStats.enabled ? 'enabled' : 'disabled'}`);
        return performanceStats.enabled;
    };
    
    // Store last frame time for animation delta calculation
    let lastFrameTime = performance.now();
    
    /**
     * Updates a single citizen's movement and animation
     * @param {CitizenData} citizen - The citizen data object to update
     * @param {number} deltaTime - Time delta in seconds
     */
    function updateCitizen(citizen, deltaTime) {
        if (!citizen || !citizen.character || !citizen.character.visible) {
            return;
        }
        
        // Update citizen animation mixer
        if (citizen.mixer) {
            citizen.mixer.update(deltaTime);
        }
        
        const currentPos = citizen.character.position;
        const currentTile = { x: Math.round(currentPos.x), y: Math.round(currentPos.z) };
        
        // Check if waiting for road access
        if (citizen.waitingForRoad) {
            // Check if road access appeared
            const borderRoads = findBorderRoads({ size: currentCitySize });
            if (borderRoads.length > 0) {
                // Road access available - start walking to it
                citizen.waitingForRoad = false;
                const targetRoad = borderRoads[0];
                citizen.targetPosition = new THREE.Vector3(targetRoad.x, 0, targetRoad.y);
                citizen.onRoad = false;
                citizen.isWalking = true;
                
                const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
                let walkAnimation = null;
                for (const name of walkNames) {
                    if (citizenAnimations[name]) {
                        walkAnimation = name;
                        break;
                    }
                }
                if (walkAnimation) {
                    switchCitizenAnimation(citizen, walkAnimation, true, 0.2);
                }
            }
            // Otherwise continue waiting (idle animation already playing)
            return;
        }
        
        // Check if walking to border road (not on road yet)
        if (citizen.isWalking && citizen.targetPosition && !citizen.onRoad) {
            const direction = new THREE.Vector3()
                .subVectors(citizen.targetPosition, currentPos)
                .normalize();
            
            const distance = currentPos.distanceTo(citizen.targetPosition);
            
            if (distance > 0.1) {
                // Still walking - move towards target
                const moveDistance = WALK_SPEED * deltaTime;
                citizen.character.position.add(
                    direction.multiplyScalar(moveDistance)
                );
                
                // Rotate character to face movement direction
                if (direction.length() > 0) {
                    const angle = Math.atan2(direction.x, direction.z);
                    citizen.character.rotation.y = angle;
                }
            } else {
                // Reached border road - now on road, create loop path
                citizen.character.position.copy(citizen.targetPosition);
                citizen.onRoad = true;
                
                // Create road path starting from current position
                citizen.path = createRoadPath(currentTile.x, currentTile.y);
                citizen.currentPathIndex = 0;
                citizen.pathDirection = 1; // Start walking forward
                
                if (citizen.path.length > 1) {
                    // Set next target in path
                    const nextTile = citizen.path[1];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0, nextTile.y);
                } else {
                    // No path found, switch to idle
                    citizen.isWalking = false;
                    citizen.targetPosition = null;
                    const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                    let idleAnimation = null;
                    for (const name of idleNames) {
                        if (citizenAnimations[name]) {
                            idleAnimation = name;
                            break;
                        }
                    }
                    if (idleAnimation) {
                        switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                    }
                }
            }
            return;
        }
        
        // Check if walking on road loop
        if (citizen.isWalking && citizen.onRoad && citizen.path.length > 0 && citizen.targetPosition) {
            // Validate path before using it (safety check)
            if (!validatePath(citizen.path)) {
                // Path is invalid - recalculate immediately
                if (!recalculateCitizenPath(citizen)) {
                    // Recalculation failed - character will be set to idle
                    return;
                }
            }
            
            const direction = new THREE.Vector3()
                .subVectors(citizen.targetPosition, currentPos)
                .normalize();
            
            const distance = currentPos.distanceTo(citizen.targetPosition);
            
            if (distance > 0.1) {
                // Still walking - move towards target
                const moveDistance = WALK_SPEED * deltaTime;
                citizen.character.position.add(
                    direction.multiplyScalar(moveDistance)
                );
                
                // Rotate character to face movement direction
                if (direction.length() > 0) {
                    const angle = Math.atan2(direction.x, direction.z);
                    citizen.character.rotation.y = angle;
                }
                
                // Verify we're still on a road (safety check)
                const tile = worldToTile(citizen.character.position);
                if (!isRoadTile(tile.x, tile.y) || hasBuilding(tile.x, tile.y)) {
                    // Off road or hit building - recalculate path
                    if (!recalculateCitizenPath(citizen)) {
                        // Recalculation failed - character will be set to idle
                        return;
                    }
                }
            } else {
                // Reached current target in path - move to next
                citizen.character.position.copy(citizen.targetPosition);
                citizen.currentPathIndex += citizen.pathDirection;
                
                // Check if we've reached the end of the path
                if (citizen.currentPathIndex >= citizen.path.length) {
                    // Reached end - turn back (reverse direction)
                    citizen.pathDirection = -1;
                    citizen.currentPathIndex = citizen.path.length - 2; // Go to second-to-last tile
                } else if (citizen.currentPathIndex < 0) {
                    // Reached beginning - turn forward (reverse direction)
                    citizen.pathDirection = 1;
                    citizen.currentPathIndex = 1; // Go to second tile
                }
                
                // Validate path before accessing it
                if (!validatePath(citizen.path)) {
                    // Path is invalid - recalculate
                    if (!recalculateCitizenPath(citizen)) {
                        // Recalculation failed - character will be set to idle
                        return;
                    }
                }
                
                if (citizen.path.length > 1 && citizen.currentPathIndex >= 0 && citizen.currentPathIndex < citizen.path.length) {
                    // Get next tile in path based on direction
                    const nextTile = citizen.path[citizen.currentPathIndex];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0, nextTile.y);
                    // Continue walking - no idle pauses
                } else {
                    // Path issue - recalculate
                    if (!recalculateCitizenPath(citizen)) {
                        // Recalculation failed - character will be set to idle
                        return;
                    }
                }
            }
        }
    }
    
    function draw() {
        // Calculate delta time for animations (in seconds)
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
        lastFrameTime = currentTime;
        
        // Update all citizens
        citizens.forEach(citizen => {
            updateCitizen(citizen, deltaTime);
        });
        
        updateFocusedObject(); // Update focused object every frame
        // OPTIMIZATION: Update frustum culling for zone groups (throttled)
        updateFrustumCulling();
        // OPTIMIZATION: Update shadow casting based on camera distance (throttled, not every frame)
        updateShadowCasting(50); // 50 unit distance threshold - objects beyond this won't cast shadows
        renderer.render(scene, camera.camera);
        logPerformanceStats(); // Log performance stats if enabled
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

    /**
     * Immediately update a road tile visually without waiting for full scene update
     * This provides instant feedback when placing roads
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    function updateRoadImmediate(x, y) {
        if (!terrain[x] || !terrain[x][y]) return;
        
        const terrainMesh = terrain[x][y];
        const sharedMaterials = assetManager.getSharedTerrainMaterials();
        
        if (sharedMaterials && sharedMaterials['roads']) {
            // Update terrain mesh material to show road texture immediately
            terrainMesh.material = sharedMaterials['roads'];
            terrainMesh.name = 'roads';
            terrainMesh.userData.id = 'roads';
            terrainMesh.userData.type = 'roads';
            terrainMesh.userData.x = x;
            terrainMesh.userData.y = y;
            terrainMesh.userData.isBuilding = false;
            terrainMesh.userData.isRoad = true;
            
            // Ensure mesh is visible
            terrainMesh.visible = true;
            
            // Force material update
            if (terrainMesh.material) {
                terrainMesh.material.needsUpdate = true;
                if (terrainMesh.material.map) {
                    terrainMesh.material.map.needsUpdate = true;
                }
            }
            
            // Add to buildings array for neighbor detection
            if (!buildings[x][y]) {
                buildings[x][y] = terrainMesh;
            }
        }
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
        suppressInput,
        // Expose pause/resume control for citizen characters
        pauseCitizen,
        resumeCitizen,
        // Expose immediate road update for instant visual feedback
        updateRoadImmediate
    }

    /**
     * Pauses all citizen animations (switches to idle)
     */
    function pauseCitizen() {
        citizens.forEach(citizen => {
            if (!citizen.character || !citizen.character.visible) {
                return;
            }
            
            // Remember if citizen was walking
            citizen.wasWalkingBeforePause = citizen.isWalking;
            
            // Stop walking
            citizen.isWalking = false;
            
            // Switch to idle animation
            const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
            let idleAnimation = null;
            for (const name of idleNames) {
                if (citizenAnimations[name]) {
                    idleAnimation = name;
                    break;
                }
            }
            
            // If no idle found, use first animation
            if (!idleAnimation && Object.keys(citizenAnimations).length > 0) {
                idleAnimation = Object.keys(citizenAnimations)[0];
            }
            
            if (idleAnimation) {
                switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
            }
        });
    }

    /**
     * Resumes all citizen animations (switches back to walk if was walking)
     * This function is called whenever the game resumes, ensuring citizens
     * are in the correct state regardless of how many times pause/resume was called
     */
    function resumeCitizen() {
        citizens.forEach(citizen => {
            if (!citizen.character || !citizen.character.visible) {
                return;
            }
            
            // Determine if citizen should be walking based on current state
            // Check multiple conditions to ensure we resume correctly:
            // 1. Was walking before pause (flag)
            // 2. Is on a road (citizen.onRoad)
            // 3. Has a target position (citizen.targetPosition)
            // 4. Has a valid path (citizen.path.length > 0)
            const shouldBeWalking = 
                (citizen.wasWalkingBeforePause || citizen.onRoad || citizen.targetPosition || citizen.path.length > 0) &&
                !citizen.waitingForRoad; // Don't walk if waiting for road access
            
            if (shouldBeWalking) {
                citizen.isWalking = true;
                
                // Switch to walk animation
                const walkNames = ['walk', 'Walk', 'Walking', 'walking'];
                let walkAnimation = null;
                for (const name of walkNames) {
                    if (citizenAnimations[name]) {
                        walkAnimation = name;
                        break;
                    }
                }
                
                // If no walk animation found, try the second animation (often walk is second after idle)
                if (!walkAnimation && Object.keys(citizenAnimations).length > 1) {
                    const animationKeys = Object.keys(citizenAnimations);
                    walkAnimation = animationKeys[1]; // Use second animation
                }
                
                if (walkAnimation) {
                    switchCitizenAnimation(citizen, walkAnimation, true, 0.3);
                }
            } else {
                // Citizen should be idle (waiting for road or no path available)
                // Ensure idle animation is playing
                const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                let idleAnimation = null;
                for (const name of idleNames) {
                    if (citizenAnimations[name]) {
                        idleAnimation = name;
                        break;
                    }
                }
                
                if (!idleAnimation && Object.keys(citizenAnimations).length > 0) {
                    idleAnimation = Object.keys(citizenAnimations)[0];
                }
                
                if (idleAnimation) {
                    switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                }
            }
        });
    }
}