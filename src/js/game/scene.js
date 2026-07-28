import * as THREE from 'three';
import {createCamera} from './camera.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import {applyHoverColor, resetHoveredObject, resetObjectColor} from '../utils/meshUtils.js';
import {  textures  } from '../meshs/data.js'
import {
    getBuildingsNamesInZone,
    updateBuildingNeighbors,
} from "../utils/utils.js";
import { toBuildingIdString } from '../../contexts/urban/domain/value-objects/BuildingId.js';
import {
    bulldozeSelected,
    commerce,
    delayBox,
    displayDelayUI,
    factories,
    farms,
    firstHouses,
    gameWindow,
    houses,
    palaces
} from '../ui/nodes.js';
import {assetsPrices} from "../meshs/data.js";
import { checkFoodAvailability, canHouseEvolveToPalace, canHouseEvolveToPurple } from './modules/ModuleHelper.js';
import { getOrCreateUrbanContext } from '../../composition/createUrbanContext.js';
import { setupRoadAccessIcons } from '../../infrastructure/roadAccessIcons.js';
import { getDefaultEmployees } from './modules/EmployeeHelper.js';
import { TimeManager } from './utils/TimeManager.js';
import config from './config.js';
import { LightingManager } from './managers/LightingManager.js';
import { BackdropManager } from './managers/BackdropManager.js';
import { DecorativeVillageManager } from './managers/DecorativeVillageManager.js';
import { ResourceManager } from './managers/ResourceManager.js';
import { PerformanceManager } from './managers/PerformanceManager.js';
import { BudgetProcessor } from './managers/BudgetProcessor.js';
import { CitizenManager } from './managers/CitizenManager.js';
import { CitizenPathfinding } from './managers/CitizenPathfinding.js';

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

/**
 * Get the maximum population capacity for a house type
 * @param {string} houseType - The house type (e.g., 'House-Blue', 'House-2Story')
 * @returns {number} Maximum population capacity
 */
function getHouseMaxPopulation(houseType) {
    if (!houseType) return 0;
    
    // All houses (Blue, Red, Purple, 2Story) can hold 6 people
    if (houseType.includes('House-Blue') || 
        houseType.includes('House-Red') || 
        houseType.includes('House-Purple') ||
        houseType.includes('House-2Story') || 
        houseType.includes('House_2Story')) {
        return 6;
    }
    
    // Default: no population for non-house buildings
    return 0;
}

export function createScene(housesStore, gameStore, assetManager, urbanOption) {
    // BudgetManager will be set by the game initialization

    const scene = new THREE.Scene();
    // Subtle atmospheric fog to blend far terrain and sky (tuned to match background)
    try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}
    
    // Initialize managers
    const lightingManager = new LightingManager(scene);
    const backdropManager = new BackdropManager(scene);
    const decorativeVillageManager = new DecorativeVillageManager(scene, assetManager);
    const budgetProcessor = new BudgetProcessor();
    const citizenManager = new CitizenManager(scene, assetManager);
    const urban = urbanOption ?? getOrCreateUrbanContext(housesStore);
    const syncRoadAccess = setupRoadAccessIcons(urban, { assetManager, textures });

    // Use simple scene background with sky texture - this ensures sky covers everything
    // The backdrop (distant ground) will be positioned to match World platform exactly
    backdropManager.initializeSky();
    
    // Initialize citizen manager
    citizenManager.initialize();
    
    // PerformanceManager and CitizenPathfinding will be created in initialize() after zoneGroups/buildings/terrain are set up
    let performanceManager = null;
    let citizenPathfinding = null;

    const camera = createCamera(gameWindow);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight);
    
    // Add WebGL error handling
    const canvas = renderer.domElement;
    
    // Handle WebGL context lost (indicates insufficient GPU resources)
    /*
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
    });
    */
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
    let currentCity = null; // Store current city object for citizen updates
    
    // Note: lastMaintenanceMonth and lastSalaryMonth moved to BudgetProcessor
    // Note: Citizen-related variables and CitizenData class moved to CitizenManager
    
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
        // Store world platform before clearing scene
        let worldPlatform = scene.getObjectByName('world-platform');
        
        // Remove skybox sphere if it exists
        const skySphere = scene.getObjectByName('sky-sphere');
        if (skySphere) {
            scene.remove(skySphere);
            if (skySphere.geometry) skySphere.geometry.dispose();
            if (skySphere.material) skySphere.material.dispose();
        }
        
        scene.clear();
        // Re-apply fog after clear
        try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}
        
        // Re-apply sky background
        backdropManager.initializeSky();
        terrain = [];
        buildings = [];
        loadingPromises = [];
        
        // Store city object and size for citizen pathfinding and World platform scaling
        currentCity = city;
        const citySize = city && typeof city.size === 'number' ? city.size : 16;
        if (city && typeof city.size === 'number') {
            currentCitySize = city.size;
        }
        
        // Re-add world platform if it existed, otherwise load it
        // If it exists but city size changed, remove and reload with new size
        if (worldPlatform) {
            // Check if we need to rescale (city size might have changed)
            const existingScale = worldPlatform.scale.x;
            const expectedScale = (citySize + 2) / (existingScale > 0 ? 1 / existingScale : 1);
            if (Math.abs(existingScale - expectedScale) > 0.1) {
                // City size changed, remove old and reload
                scene.remove(worldPlatform);
                worldPlatform = null;
            } else {
                scene.add(worldPlatform);
            }
        }
        
        if (!worldPlatform) {
            // Load world platform (base ground) first, before other assets
            // Pass city size to scale the World platform accordingly
            try {
                await assetManager.loadWorldPlatform(scene, citySize);
            } catch (error) {
                console.warn('[Scene] Could not load world platform:', error);
            }
        }
        
        // Load boundary fences at north, south, east, west limits
        // Remove existing fences if they exist (in case of scene reset)
        const existingFenceGroup = scene.getObjectByName('boundary-fences');
        if (existingFenceGroup) {
            scene.remove(existingFenceGroup);
        }
        
        try {
            await assetManager.loadBoundaryFences(scene, citySize);
        } catch (error) {
            console.warn('[Scene] Could not load boundary fences:', error);
        }
        
        // Reset citizen state
        citizenManager.reset();
        citizenManager.setCitySize(citySize);
        
        // Reset budget processor tracking
        budgetProcessor.reset();
        
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
                
                // For roads, ensure they are properly positioned above World platform
                // and force matrix update to ensure visibility
                if (terrainId === 'roads' && mesh.userData?.isRoad) {
                    mesh.updateMatrixWorld(true);
                }
                
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
        lightingManager.setUpLights(city.size);
        
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

        // No backdrop needed - World platform provides sharp cutoff with sky background
        // addBackdrop(citySize); // Disabled to prevent visible edges at horizon
        
        // Initialize resources (trees, boulders, clay, iron, gold) before decorative village
        const resourceManager = new ResourceManager();
        await resourceManager.initializeResources(city, housesStore, assetManager, buildings, zoneGroups);
        
        // Create decorative village around the playable area
        decorativeVillageManager.createDecorativeVillage(citySize);
        
        // Initialize PerformanceManager after zoneGroups are set up
        performanceManager = new PerformanceManager(scene, camera, zoneGroups, buildings);
        
        // Initialize CitizenPathfinding after buildings and terrain are created
        citizenPathfinding = new CitizenPathfinding(buildings, terrain);
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
            },
            // No worker sprite (red) - shown when farm has no employees
            'no-work': {
                position : {x: -0.8, y: 0.5, z: -0.2},
                scale : {x: 0.5, y: 0.5, z: 0.5},
                spriteColor: 0xFF0000, // Red color
                backgroundColor: 0xFFE8E8 // Light red background
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
                let currentUniqueID =  toBuildingIdString(currentBuildingId, x, y)
                // Skip if toBuildingIdString returned null (invalid building ID or coordinates)
                if(!currentUniqueID) {
                    continue;
                }
                
                // Vérifier si le bâtiment existe encore dans la base de données
                // Si non, le supprimer de la scène (cas des événements aléatoires, etc.)
                // IMPORTANT: Ne pas supprimer si un nouveau bâtiment est en cours de création (newBuildingId existe)
                const isRoad = buildings[x][y]?.userData?.isRoad || (currentBuildingId && currentBuildingId.startsWith('StonePath-'));
                const hasNewBuilding = newBuildingId && newBuildingId !== currentBuildingId;
                
                // FIX BUG 1: For roads, use city.tiles as source of truth
                // If city.tiles doesn't have a road but terrain shows road material, restore to grass
                // This prevents "ghost" roads from terrain material when payment failed
                if (isRoad) {
                    const tileHasRoad = city.tiles[x][y]?.buildingId && 
                                       (city.tiles[x][y].buildingId.startsWith('StonePath-') || 
                                        city.tiles[x][y].buildingId === 'roads');
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
                    
                    // Migration: Add employees object to existing buildings if missing, or migrate old structure
                    const buildingData = await housesStore.getHouse(currentUniqueID);
                    if (buildingData) {
                        if (!buildingData.employees) {
                            // No employees object - create new one
                            const defaultEmployees = getDefaultEmployees(currentBuildingId);
                            await housesStore.updateHouseFields(currentUniqueID, { employees: defaultEmployees });
                        } else {
                            // Migrate old structure to new structure
                            const employees = buildingData.employees;
                            const needsUpdate = 
                                employees.category !== undefined || // Old: category -> new: sector
                                employees.worker_need === undefined || // Missing worker_need
                                employees.elite_need === undefined; // Missing elite_need
                            
                            if (needsUpdate) {
                                const defaultEmployees = getDefaultEmployees(currentBuildingId);
                                const migratedEmployees = {
                                    priority: employees.priority !== undefined ? employees.priority : defaultEmployees.priority,
                                    worker_need: defaultEmployees.worker_need, // From config
                                    elite_need: defaultEmployees.elite_need, // From config
                                    worker: employees.worker || 0,
                                    elite: employees.elite || 0,
                                    sector: employees.category !== undefined ? employees.category : (employees.sector || defaultEmployees.sector),
                                    salary: employees.salary || 0
                                };
                                await housesStore.updateHouseFields(currentUniqueID, { employees: migratedEmployees });
                            }
                        }
                    }
                } else {
                    // Pour les routes, on essaie de mettre à jour mais on ne bloque pas si ça échoue
                    try {
                        await housesStore.updateHouseFields(currentUniqueID, {worldTime: time})
                        const currentUserData = buildings[x][y].userData
                        await housesStore.updateHouseFields(currentUniqueID, {})
                        
                        // Migration: Add employees object to roads if missing, or migrate old structure
                        const roadData = await housesStore.getHouse(currentUniqueID);
                        if (roadData) {
                            if (!roadData.employees) {
                                const defaultEmployees = getDefaultEmployees(currentBuildingId);
                                await housesStore.updateHouseFields(currentUniqueID, { employees: defaultEmployees });
                            } else {
                                // Migrate old structure to new structure
                                const employees = roadData.employees;
                                const needsUpdate = 
                                    employees.category !== undefined ||
                                    employees.worker_need === undefined ||
                                    employees.elite_need === undefined;
                                
                                if (needsUpdate) {
                                    const defaultEmployees = getDefaultEmployees(currentBuildingId);
                                    const migratedEmployees = {
                                        priority: employees.priority !== undefined ? employees.priority : defaultEmployees.priority,
                                        worker_need: defaultEmployees.worker_need,
                                        elite_need: defaultEmployees.elite_need,
                                        worker: employees.worker || 0,
                                        elite: employees.elite || 0,
                                        sector: employees.category !== undefined ? employees.category : (employees.sector || defaultEmployees.sector),
                                        salary: employees.salary || 0
                                    };
                                    await housesStore.updateHouseFields(currentUniqueID, { employees: migratedEmployees });
                                }
                            }
                        }
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
                  // Wrap in try-catch to prevent errors from blocking removal
                  try {
                      const allNeighborsWithinZone = getBuildingsNamesInZone(buildingData, time, {buildingTarget: "", zones:[1,2]})
                      const allMarketsInZone = getBuildingsNamesInZone(buildingData, time, {buildingTarget: "Market-Stall", zones:[1,2]})
                      await housesStore.updateHouseFields(currentUniqueID, {neighbors: allNeighborsWithinZone})
                      await housesStore.updateHouseFields(currentUniqueID, {markets: allMarketsInZone})
                  } catch (err) {
                      // Building might not exist in DB yet (e.g., newly placed StonePath road)
                      // Don't block removal or other processing if this fails
                      console.warn('[Scene] Failed to update neighbors/markets for', currentBuildingId, err);
                  }

                //  Remove a building from the scene if a player remove a building
                if(!newBuildingId && currentBuildingId) {
                    if(bulldozeSelected.classList.contains('selected') && currentBuildingId) {
                        // Debug: Verify building exists at coordinates
                        if (!buildings[x] || !buildings[x][y]) {
                            console.warn('[scene.js] Building not found in buildings array at removal:', {
                                x, y,
                                currentBuildingId,
                                buildingsExists: !!buildings[x],
                                buildingAtXY: !!buildings[x]?.[y]
                            });
                        }
                        
                        // Handle geometry-based roads ('roads') - restore terrain to grass
                        if (currentBuildingId === 'roads') {
                            const uniqueBuildingId = toBuildingIdString(currentBuildingId, x, y);
                            await housesStore.deleteOneHouse(uniqueBuildingId);
                            // Restore terrain mesh to grass
                            if (terrain[x] && terrain[x][y]) {
                                const terrainMesh = terrain[x][y];
                                const sharedMaterials = assetManager.getSharedTerrainMaterials();
                                if (sharedMaterials && sharedMaterials['grass']) {
                                    terrainMesh.material = sharedMaterials['grass'];
                                    terrainMesh.name = 'grass';
                                    terrainMesh.userData.id = 'grass';
                                    terrainMesh.userData.type = 'grass';
                                    terrainMesh.userData.isRoad = false;
                                    terrainMesh.userData.x = x;
                                    terrainMesh.userData.y = y;
                                }
                            }
                            // Clear from buildings array
                            if (buildings[x][y] === terrain[x][y]) {
                                buildings[x][y] = undefined;
                            }
                            // Clear buildingId from city.tiles
                            if (city.tiles[x] && city.tiles[x][y]) {
                                city.tiles[x][y].buildingId = undefined;
                            }
                        } else {
                            // Remove buildings (houses, StonePath roads, farms, markets, etc.) - all follow the same pattern
                            const uniqueBuildingId = toBuildingIdString(currentBuildingId, x, y);
                            await housesStore.deleteOneHouse(uniqueBuildingId);
                            removeInteractiveObject(buildings[x][y]);
                            buildings[x][y] = undefined;
                        }
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

                    // Clean up market sprites (including no-work)
                    if (buildings[x][y]) {
                        const marketSpriteNames = ['isBuying', 'isBuying-bg', 'no-work', 'no-work-bg'];
                        marketSpriteNames.forEach(spriteName => {
                            assetManager.removeStatusSprite(buildings[x][y], spriteName);
                        });
                    }

                    // Accès routier marché (BC Urban + icône)
                    const marketRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714
                    };

                    if (buildings[x][y]) {
                        await syncRoadAccess({
                            buildingId: currentUniqueID,
                            mesh: buildings[x][y],
                            position: statutsIconsMeta.road.position,
                            scale: marketRoadScale,
                        });
                    }

                    // Check if market has workers (required to operate)
                    const marketDataForWorkers = await housesStore.getHouse(currentUniqueID);
                    const marketEmployees = marketDataForWorkers?.employees || { worker: 0, worker_need: 0 };
                    const marketWorkers = marketEmployees.worker || 0;
                    const marketWorkerNeed = marketEmployees.worker_need || 0;
                    const marketHasNoWorkers = marketWorkers === 0 && marketWorkerNeed > 0;

                    // If no workers, show no-work sprite (red) and skip buying functionality
                    if (marketHasNoWorkers && buildings[x][y]) {
                        const noWorkMeta = statutsIconsMeta['no-work'];
                        // Use market-specific position (similar to isBuying position)
                        const marketNoWorkPosition = { x: -0.5, y: 0.5, z: 0 };
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['no-work'],
                            'no-work',
                            { x: 0.6, y: 0.6, z: 1 }, // Same scale as isBuying
                            marketNoWorkPosition,
                            true, // visible
                            0xFF0000, // Red color
                            0xFFE8E8 // Light red background
                        );
                        // Skip buying icon display - market cannot operate without workers
                    } else if (buildings[x][y]) {
                    // Display buying icon during autumn (when markets buy from farms)
                    // Show green buying icon if market is in buying period (isBuying === true)
                    // isBuying indicates that conditions are met to buy food from nearest farms
                        const isBuying = await housesStore.getHouseItem(currentUniqueID, 'isBuying');
                        
                        // Check if farms are too far (using same rule as FoodDistributionService)
                        // noFarmsNearby is set by FoodDistributionService based on neighbors
                        const noFarmsNearby = marketDataForWorkers?.noFarmsNearby === true;
                        
                        // Show/hide buying icon based on buying status
                        // isBuying means market can buy food from farms (conditions are met)
                        if (isBuying === true) {
                            // Market is in buying period
                            const buyingMeta = statutsIconsMeta['isBuying'];
                            
                            if (!noFarmsNearby) {
                                // Farms nearby - show green buying icon with white background
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
                                // No farms nearby - show buying icon with RED background
                                assetManager.setStatusSprite(
                                    buildings[x][y],
                                    textures['isBuying'],
                                    'isBuying',
                                    buyingMeta.scale,
                                    buyingMeta.position,
                                    true,
                                    0xFF6600, // Orange/red color to indicate problem
                                    0xFFCCCC // Light red background - farms too far
                                );
                            }
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

                // Process windmills: show road access and collecting status sprites
                if((currentBuildingId.includes('Windmill') || currentBuildingId.includes('windmill')) && buildings[x][y]) {
                    // Clean up windmill sprites (including no-work)
                    const windmillSpriteNames = ['isCollecting', 'isCollecting-bg', 'no-work', 'no-work-bg'];
                    windmillSpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });
                    
                    // Accès routier moulin (BC Urban + icône)
                    const windmillRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714
                    };

                    if (buildings[x][y]) {
                        await syncRoadAccess({
                            buildingId: currentUniqueID,
                            mesh: buildings[x][y],
                            position: statutsIconsMeta.road.position,
                            scale: windmillRoadScale,
                        });
                    }

                    // Check if windmill has workers (required to operate)
                    const windmillDataForWorkers = await housesStore.getHouse(currentUniqueID);
                    const windmillEmployees = windmillDataForWorkers?.employees || { worker: 0, worker_need: 0 };
                    const windmillWorkers = windmillEmployees.worker || 0;
                    const windmillWorkerNeed = windmillEmployees.worker_need || 0;
                    const windmillHasNoWorkers = windmillWorkers === 0 && windmillWorkerNeed > 0;

                    // If no workers, show no-work sprite (red) and skip collecting functionality
                    if (windmillHasNoWorkers && buildings[x][y]) {
                        // Use windmill-specific position (similar to isCollecting position)
                        const windmillNoWorkPosition = { x: -0.5, y: 0.5, z: 0 };
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['no-work'],
                            'no-work',
                            { x: 0.6, y: 0.6, z: 1 }, // Same scale as isCollecting
                            windmillNoWorkPosition,
                            true, // visible
                            0xFF0000, // Red color
                            0xFFE8E8 // Light red background
                        );
                        // Skip collecting icon display - windmill cannot operate without workers
                    } else if (buildings[x][y]) {
                    // Display collecting icon during October (when windmills collect from farms)
                    // Show green collecting icon if windmill is collecting (isCollecting === true)
                        const isCollecting = await housesStore.getHouseItem(currentUniqueID, 'isCollecting');
                        
                        // Show/hide collecting icon based on collecting status
                        if (isCollecting === true) {
                            // Windmill is collecting food - show green collecting icon
                            const collectingMeta = {
                                position: {x: -0.5, y: 0.5, z: 0},
                                scale: {x: 0.6, y: 0.6, z: 1},
                                spriteColor: 0x00FF00, // Green color
                                backgroundColor: 0xFFFFFF // White background
                            };
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'isCollecting',
                                collectingMeta.scale,
                                collectingMeta.position,
                                true,
                                collectingMeta.spriteColor,
                                collectingMeta.backgroundColor
                            );
                        } else {
                            // Not collecting - hide collecting icon
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'isCollecting',
                                {x: 0.6, y: 0.6, z: 1},
                                {x: -0.5, y: 0.5, z: 0},
                                false,
                                null,
                                null
                            );
                        }
                    }
                }

                // Process farms: show season-specific sprites and manage harvest stocks
                if(farms.includes(currentBuildingId) && buildings[x][y]) {
                    // First, clean up ALL possible farm sprites to prevent any leftover sprites
                    const allFarmSpriteNames = ['no-food', 'grow-food', 'harvest', 'sell-food', 
                                                'no-food-bg', 'grow-food-bg', 'harvest-bg', 'sell-food-bg',
                                                'no-work', 'no-work-bg', 'sold-to-windmill', 'sold-to-windmill-bg'];
                    allFarmSpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });
                    
                    // Get current time info to determine season
                    const timeInfo = TimeManager.getTimeInfo(time);
                    const season = timeInfo.season;
                    
                    // Check if farm has workers (required to operate)
                    const farmDataForWorkers = await housesStore.getHouse(currentUniqueID);
                    const farmEmployees = farmDataForWorkers?.employees || { worker: 0, worker_need: 0 };
                    const farmWorkers = farmEmployees.worker || 0;
                    const farmWorkerNeed = farmEmployees.worker_need || 0;
                    const hasNoWorkers = farmWorkers === 0 && farmWorkerNeed > 0;
                    
                    // If no workers, show no-work sprite (red) and skip all production
                    if (hasNoWorkers) {
                        const noWorkMeta = statutsIconsMeta['no-work'];
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['no-work'],
                            'no-work',
                            noWorkMeta.scale,
                            noWorkMeta.position,
                            true, // visible
                            noWorkMeta.spriteColor,
                            noWorkMeta.backgroundColor
                        );
                        // Skip all production and season sprites - farm cannot operate without workers
                        continue;
                    }
                    
                    // Initialize farm stocks in IndexedDB if not present
                    const farmStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                    if (!farmStocks) {
                        await housesStore.updateHouseFields(currentUniqueID, {
                            stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 }
                        });
                    }
                    
                    // Harvest season (Automne): produce 78 paniers once per year (enough to feed 6 citizens for 1 year + buffer)
                    // 1 citizen consumes 1 panier per month = 12 paniers per year
                    // 6 citizens × 12 paniers/year = 72 paniers/year for consumption
                    // + 6 paniers buffer needed during the time market is buying a new load for one year
                    // Total: 72 + 6 = 78 paniers/year
                    // Only produce once per year - track the last year when production happened
                    // NOTE: Production only happens if farm has workers (checked above)
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
                            
                            // Determine farm type and add 78 paniers of that type (enough to feed 6 citizens for 1 year + buffer)
                            let farmType = currentBuildingId;
                            let newStocks = { ...currentFarmStocks };
                            
                            // Production: 78 paniers = enough to feed 6 citizens for 1 year + 6 paniers buffer
                            // 1 citizen consumes 1 panier/month = 12 paniers/year
                            // 6 citizens × 12 paniers/year = 72 paniers/year for consumption
                            // + 6 paniers buffer needed during the time market is buying a new load
                            // Total: (1×12×6) + (1×6) = 72 + 6 = 78 paniers/year
                            const productionAmount = 78;
                            
                            if (farmType.includes('Farm-Wheat') || farmType.includes('Wheat')) {
                                // Add 78 wheat paniers (enough to feed 6 citizens for 1 year + buffer)
                                newStocks.wheat = (currentFarmStocks.wheat || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            } else if (farmType.includes('Farm-Carrot') || farmType.includes('Carrot')) {
                                // Add 78 carrot paniers (enough to feed 6 citizens for 1 year + buffer)
                                newStocks.carrot = (currentFarmStocks.carrot || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            } else if (farmType.includes('Farm-Cabbage') || farmType.includes('Cabbage')) {
                                // Add 78 cabbage paniers (enough to feed 6 citizens for 1 year + buffer)
                                newStocks.cabbage = (currentFarmStocks.cabbage || 0) + productionAmount;
                                newStocks.food = (newStocks.food || 0) + productionAmount;
                            }
                            
                            // Update stocks and track production year in IndexedDB
                            await housesStore.updateHouseFields(currentUniqueID, { 
                                stocks: newStocks,
                                lastProductionYear: currentYear,
                                lastProductionMonth: currentMonthIndex // Keep for compatibility
                            });
                        }
                    }
                    
                    // Determine which sprite to show based on season (only if farm has workers)
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
                    
                    // In December, show additional sprite if farm sold to windmill
                    // This sprite appears alongside the winter season sprite to indicate windmill collection
                    if (buildings[x][y] && season === 'Hiver' && timeInfo.monthIndex === 11) {
                        const soldToWindmill = await housesStore.getHouseItem(currentUniqueID, 'soldToWindmill');
                        if (soldToWindmill === true) {
                            // Show windmill collection sprite (green, similar to windmill's isCollecting)
                            // Position it differently from the season sprite to avoid overlap
                            const windmillSaleMeta = {
                                position: {x: 0.5, y: 0.5, z: 0}, // Different position from season sprite (top-right)
                                scale: {x: 0.5, y: 0.5, z: 1},
                                spriteColor: 0x00FF00, // Green color
                                backgroundColor: 0xFFFFFF // White background
                            };
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'], // Reuse windmill collecting icon
                                'sold-to-windmill',
                                windmillSaleMeta.scale,
                                windmillSaleMeta.position,
                                true,
                                windmillSaleMeta.spriteColor,
                                windmillSaleMeta.backgroundColor
                            );
                        } else {
                            // Hide the sprite if not sold to windmill
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'sold-to-windmill',
                                {x: 0.5, y: 0.5, z: 1},
                                {x: 0.5, y: 0.5, z: 0},
                                false,
                                null,
                                null
                            );
                        }
                    }
                }

                // Process factories: show no-work sprite if no employees
                if(factories.includes(currentBuildingId) && buildings[x][y]) {
                    // Clean up factory sprites (including no-work)
                    const factorySpriteNames = ['no-work', 'no-work-bg'];
                    factorySpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });

                    // Check if factory has workers (required to operate)
                    const factoryDataForWorkers = await housesStore.getHouse(currentUniqueID);
                    const factoryEmployees = factoryDataForWorkers?.employees || { worker: 0, worker_need: 0 };
                    const factoryWorkers = factoryEmployees.worker || 0;
                    const factoryWorkerNeed = factoryEmployees.worker_need || 0;
                    const factoryHasNoWorkers = factoryWorkers === 0 && factoryWorkerNeed > 0;

                    // If no workers, show no-work sprite (red)
                    if (factoryHasNoWorkers && buildings[x][y]) {
                        const noWorkMeta = statutsIconsMeta['no-work'];
                        const factoryNoWorkPosition = { x: -0.8, y: 0.5, z: -0.2 };
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['no-work'],
                            'no-work',
                            noWorkMeta.scale,
                            factoryNoWorkPosition,
                            true, // visible
                            noWorkMeta.spriteColor,
                            noWorkMeta.backgroundColor
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
                    let houseNeighbors = await housesStore.getHouseItem(currentUniqueID, 'neighbors');
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
                        
                        // Get updated stocks after consumption for further processing
                        const updatedStocks = await housesStore.getHouseItem(currentUniqueID, 'stocks');
                        if (updatedStocks) {
                            Object.assign(houseFoodStocks, updatedStocks);
                        }
                    }
                    
                    const { hasFood, totalFood } = checkFoodAvailability(houseFoodStocks || {}, currentPop);
                    const { hasAccess: hasRoadAccess } = await syncRoadAccess({
                        buildingId: currentUniqueID,
                        mesh: buildings[x][y] || null,
                        position: statutsIconsMeta.road.position,
                        scale: statutsIconsMeta.road.scale,
                    });
                    
                    // Get house type to determine max population capacity (reuse houseData from above)
                    const houseType = houseData?.type || currentBuildingId;
                    const maxPopulation = getHouseMaxPopulation(houseType);
                    
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
                            }
                        } else if (currentPop >= maxPopulation) {
                            // House is at capacity - ensure it doesn't exceed max
                            if (currentPop > maxPopulation) {
                                targetPopulation = maxPopulation;
                                await housesStore.updateHouseFields(currentUniqueID, { pop: targetPopulation });
                            }
                        }
                    } else {
                        // No road access OR not a house - reset population to 0
                        if (currentPop > 0) {
                            await housesStore.updateHouseFields(currentUniqueID, { pop: 0 });
                        }
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
                        const newUniqueBuildingId = toBuildingIdString('House-Red', x, y);
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
                    }
                    // House-Red becomes House-Blue when uninhabited (pop === 0)
                    else if (currentBuildingId === 'House-Red' && currentPop === 0) {
                        removeInteractiveObject(buildings[x][y]);
                        const newUniqueBuildingId = toBuildingIdString('House-Blue', x, y);
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
                            const newUniqueBuildingId = toBuildingIdString('House-Purple', x, y);
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
                            const newUniqueBuildingId = toBuildingIdString('House-Red', x, y);
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
                        const newUniqueBuildingId = toBuildingIdString('House-2Story', x, y);
                        const keys = { type : "House-2Story", price: assetsPrices["House-2Story"].price}
                        
                        // Preserve neighbors and roads data before evolution
                        const houseNeighborsBeforeEvolution = houseNeighbors || [];
                        const roadsBeforeEvolution = (await housesStore.getHouseItem(currentUniqueID, 'roads')) || 0;
                        
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
                    }

                    /* house regression: 2Story → Purple/Red/Blue if conditions no longer met */
                    // House-2Story regresses when palace conditions are no longer met
                    else if (currentBuildingId === 'House-2Story') {
                        // Check if palace conditions are still met
                        const palaceEvolutionCheck = canHouseEvolveToPalace({
                            stocks: houseFoodStocks,
                            population: currentPop,
                            buildingType: 'House-Purple', // Check if it would qualify from House-Purple
                            firstHouses: firstHouses
                        });
                        
                        // If palace conditions are no longer met, regress
                        if (!palaceEvolutionCheck.canEvolve) {
                            let targetType = 'House-Red'; // Default regression target
                            
                            // Determine regression target based on current conditions
                            if (currentPop === 0) {
                                // No population -> regress to House-Blue
                                targetType = 'House-Blue';
                            } else {
                                // Check if House-Purple conditions are met
                                const purpleEvolutionCheck = canHouseEvolveToPurple({
                                    stocks: houseFoodStocks,
                                    population: currentPop,
                                    buildingType: 'House-Red',
                                    hasRoadAccess: hasRoadAccess
                                });
                                
                                if (purpleEvolutionCheck.canEvolve) {
                                    // Can maintain House-Purple level
                                    targetType = 'House-Purple';
                                } else {
                                    // Can only maintain House-Red level
                                    targetType = 'House-Red';
                                }
                            }
                            
                            removeInteractiveObject(buildings[x][y]);
                            const newUniqueBuildingId = toBuildingIdString(targetType, x, y);
                            const keys = { type: targetType, price: assetsPrices[targetType].price };
                            
                            // Preserve neighbors and roads data before regression
                            const houseNeighborsBeforeRegression = houseNeighbors || [];
                            const roadsBeforeRegression = (await housesStore.getHouseItem(currentUniqueID, 'roads')) || 0;
                            
                            // Update house name in database
                            const updateResult = await housesStore.updateHouseName(currentUniqueID, newUniqueBuildingId, keys);
                            
                            // If updateHouseName failed (house not found), create the house entry
                            if (!updateResult || !updateResult.success) {
                                const newHouseData = {
                                    name: newUniqueBuildingId,
                                    type: keys.type,
                                    price: keys.price,
                                    x: x,
                                    y: y,
                                    neighbors: houseNeighborsBeforeRegression,
                                    pop: currentPop,
                                    stocks: houseFoodStocks || { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
                                    roads: roadsBeforeRegression,
                                    worldTime: worldTime || time
                                };
                                await housesStore.addHouse(newHouseData);
                            } else {
                                // Ensure neighbors and roads are preserved
                                await housesStore.updateHouseFields(newUniqueBuildingId, {
                                    neighbors: houseNeighborsBeforeRegression,
                                    roads: roadsBeforeRegression
                                });
                            }
                            
                            buildings[x][y] = assetManager.createAsset(targetType, x, y);
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
                            
                            // Update currentBuildingId and currentUniqueID to reflect the regression
                            currentBuildingId = targetType;
                            const oldUniqueID = currentUniqueID;
                            currentUniqueID = newUniqueBuildingId;
                            
                            // Update buildingData to reflect the regression
                            if (buildingData) {
                                buildingData.currentBuildingId = currentBuildingId;
                                buildingData.currentUniqueID = currentUniqueID;
                            }
                            
                            // Force neighbor recalculation
                            houseNeighbors = null;
                        }
                    }

                }
          
              }

                  // if data model has changed as user add a new building, update the mesh 
            if(newBuildingId && (newBuildingId !== currentBuildingId)) {
                // Handle geometry-based roads ('roads') - update terrain mesh, don't create building
                if (newBuildingId === 'roads') {
                    // Update terrain mesh to show road material
                    if (terrain[x] && terrain[x][y]) {
                        const terrainMesh = terrain[x][y];
                        const sharedMaterials = assetManager.getSharedTerrainMaterials();
                        if (sharedMaterials && sharedMaterials['roads']) {
                            terrainMesh.material = sharedMaterials['roads'];
                            terrainMesh.name = 'roads';
                            terrainMesh.userData.id = 'roads';
                            terrainMesh.userData.type = 'roads';
                            terrainMesh.userData.isRoad = true;
                            terrainMesh.userData.x = x;
                            terrainMesh.userData.y = y;
                            // Ensure road is visible and properly positioned
                            terrainMesh.updateMatrixWorld(true);
                        }
                    }
                    // Also add to buildings array for neighbor detection
                    if (!buildings[x][y] || buildings[x][y] !== terrain[x][y]) {
                        buildings[x][y] = terrain[x][y];
                    }
                    continue; // Skip building creation code for geometry roads
                }
                
                // Roads are now 3D meshes (StonePath-001), they are created as buildings below
                // Old terrain-based road code has been completely removed
                
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
                
                // Roads are now 3D meshes (StonePath-001), treat them like buildings
                // Map 'roads' to 'StonePath-001' for asset creation
                const assetId = (newBuildingId === 'roads') ? 'StonePath-001' : newBuildingId;
                
                // Only create the mesh if this is the origin tile
                if (isOriginTile) {
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
                        // Use assetId (which maps roads to StonePath-001)
                        buildings[x][y] = assetManager.createAsset(assetId, x, y);
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
                
                // Skip if house.type is invalid (toBuildingIdString will return null)
                if (!house.type || typeof house.type !== 'string') {
                    continue;
                }
                
                // Check if building exists in scene at this position
                if (x >= 0 && x < city.size && y >= 0 && y < city.size) {
                    const buildingInScene = buildings[x] && buildings[x][y];
                    const buildingType = buildingInScene?.userData?.type;
                    const buildingId = buildingInScene?.userData?.id;
                    const expectedId = toBuildingIdString(house.type, x, y);
                    
                    // Skip if toBuildingIdString returned null (invalid building type)
                    if (!expectedId) {
                        continue;
                    }
                    
                    // For roads: check both userData.type ('roads') and userData.id (exact name like 'StonePath-001')
                    // For other buildings: check if buildingType matches house.type
                    const isRoad = house.type === 'roads' || house.type === 'Road' || (house.type && house.type.startsWith('StonePath-'));
                    const typeMatches = isRoad 
                        ? (buildingType === 'roads' && buildingId === house.type) || buildingType === house.type
                        : buildingType === house.type;
                    
                    // If no building in scene, or building type doesn't match, it's orphaned
                    if (!buildingInScene || !typeMatches) {
                        orphanedHouses.push(expectedId);
                    }
                } else {
                    // Invalid coordinates - definitely orphaned
                    const expectedId = toBuildingIdString(house.type, x, y);
                    // Only add if expectedId is valid (not false)
                    if (expectedId) {
                        orphanedHouses.push(expectedId);
                    }
                }
            }
            
            // Delete orphaned houses
            if (orphanedHouses.length > 0) {
                for (const houseId of orphanedHouses) {
                    // Double-check that houseId is valid before deletion
                    if (houseId && typeof houseId === 'string') {
                        try {
                            await housesStore.deleteOneHouse(houseId);
                        } catch (error) {
                            console.warn(`[Scene] Failed to delete orphaned house ${houseId}:`, error);
                        }
                    }
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
        const { buildingCounts, maintenanceBreakdown } = budgetProcessor.calculateBuildingCounts(city, buildings);

        // Process budget operations (taxes, salaries, maintenance, loans, etc.)
        await budgetProcessor.processBudget(time, totalPop, buildingCounts, maintenanceBreakdown);

        //  Display results in UI - Use IndexedDB as source of truth
        // Get population from housesStore (IndexedDB) instead of gameStore
        const currentPopulation = await housesStore.getGlobalPopulation();
        const famishedPopulation = await housesStore.getFamishedPopulation();
        
        // Calculate unemployment (same logic as work-section.js)
        let unemployedCount = 0;
        let unemploymentPercentage = 0;
        try {
            // Get all buildings from IndexedDB
            const allBuildings = await housesStore.listAllHouses();
            
            // Calculate available employees from houses (same logic as work-section.js)
            let workerPopulation = 0;
            let elitePopulation = 0;
            for (const house of allBuildings) {
                const type = house.type || '';
                const pop = house.pop || 0;
                
                if (type.includes('House')) {
                    // House-2Story (Palace): 1/6 becomes elite, 5/6 remain workers
                    if (type.includes('2Story') || type.includes('2-Story')) {
                        const elitesFromThisHouse = Math.floor(pop / 6);
                        const workersFromThisHouse = pop - elitesFromThisHouse;
                        elitePopulation += elitesFromThisHouse;
                        workerPopulation += workersFromThisHouse;
                    }
                    // Other houses (Blue, Red, Purple): all population are workers
                    else if (type.includes('Blue') || type.includes('Red') || type.includes('Purple')) {
                        workerPopulation += pop;
                    }
                }
            }
            
            // Calculate total assigned workers from all buildings
            let totalAssignedWorkers = 0;
            for (const building of allBuildings) {
                if (!building.employees) continue;
                const sector = building.employees.sector || 0;
                // Skip residential (sector 0)
                if (sector === 0) continue;
                totalAssignedWorkers += building.employees.worker || 0;
            }
            
            // Unemployed = available but not assigned
            unemployedCount = Math.max(0, workerPopulation - totalAssignedWorkers);
            
            // Calculate unemployment percentage
            if (workerPopulation > 0) {
                unemploymentPercentage = Math.round((unemployedCount / workerPopulation) * 100);
            } else {
                unemploymentPercentage = 0;
            }
        } catch (error) {
            console.warn('[scene.js] Error calculating unemployment:', error);
            unemployedCount = 0;
            unemploymentPercentage = 0;
        }
        
        // Manage multiple citizens based on current population state (from IndexedDB)
        // Only update if citizenPathfinding is initialized
        if (citizenPathfinding) {
            await citizenManager.updateCitizens(
                currentPopulation,
                city,
                citizenPathfinding.findBorderRoads.bind(citizenPathfinding),
                citizenPathfinding.createRoadPath.bind(citizenPathfinding),
                (citizen) => citizenPathfinding.recalculateCitizenPath(citizen, citizenManager),
                citizenPathfinding.validatePath.bind(citizenPathfinding)
            );
        }
        
        // Get budget data from BudgetManager
        let funds = 0;
        if (window.budgetManager) {
            const budgetData = await window.budgetManager.getCurrentBudget();
            funds = budgetData.funds;
        }

        // Update population, famished population, unemployed population and funds display in general bar using GameUI
        // This ensures consistent UI updates (IndexedDB is source of truth)
        if (window.gameUI) {
            window.gameUI.updatePopulation(currentPopulation || 0);
            window.gameUI.updateFamishedPopulation(famishedPopulation || 0);
            window.gameUI.updateUnemployedPopulation(unemployedCount, unemploymentPercentage);
            window.gameUI.updateFunds(funds);
        } else {
            // Fallback to direct DOM update if GameUI not available
            const displayPop = document.querySelector('.display-pop');
            const displayHungerPop = document.querySelector('.display-hunger-pop');
            const displayUnemployedPop = document.querySelector('.display-unemployed-pop');
            const displayFunds = document.querySelector('.display-funds');
            if (displayPop) {
                displayPop.textContent = (currentPopulation || 0).toString();
            }
            if (displayHungerPop) {
                displayHungerPop.textContent = (famishedPopulation || 0).toString();
            }
            if (displayUnemployedPop) {
                displayUnemployedPop.textContent = `${unemployedCount} (${unemploymentPercentage}%)`;
            }
            if (displayFunds) {
                displayFunds.textContent = funds.toString();
            }
        }

        // End turn processing

    }

    // Note: setUpLights() moved to LightingManager

    // Note: All citizen-related functions moved to CitizenManager and CitizenPathfinding

    /**
     * Helper function to get interactive objects for raycasting
     * OPTIMIZATION: Returns only buildings + terrain, not backdrop/lights/etc.
     * Since objects are now in zone groups, we collect them from all zone groups
     */
    function getInteractiveObjects() {
        // Collect all objects from zone groups (they contain buildings + terrain)
        // Exclude decorative elements (non-interactive)
        const objects = [];
        zoneGroups.forEach(zoneGroup => {
            zoneGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh && 
                    !child.userData.isDecorative && 
                    !child.userData.nonInteractive &&
                    child.name && !child.name.startsWith('decorative-')) {
                    objects.push(child);
                }
            });
        });
        // Fallback: filter scene children to exclude decorative elements
        if (objects.length === 0) {
            scene.children.forEach(child => {
                if (child instanceof THREE.Mesh && 
                    !child.userData.isDecorative && 
                    !child.userData.nonInteractive &&
                    child.name && !child.name.startsWith('decorative-') &&
                    child.name !== 'world-platform' &&
                    child.name !== 'infinite-ground-base' &&
                    child.name !== 'infinite-ground-large') {
                    objects.push(child);
                }
            });
        }
        return objects;
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

    // Note: updateFrustumCulling() and updateShadowCasting() moved to PerformanceManager

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
            
            performanceStats.frameCount = 0;
            performanceStats.lastLogTime = now;
        }
    }
    
    // Expose function to toggle stats
    window.togglePerformanceStats = function() {
        performanceStats.enabled = !performanceStats.enabled;
        localStorage.setItem('show-performance-stats', performanceStats.enabled.toString());
        return performanceStats.enabled;
    };
    
    // Store last frame time for animation delta calculation
    let lastFrameTime = performance.now();
    
    // Note: updateCitizen() moved to CitizenManager.updateAllCitizens()
    
    function draw() {
        // Calculate delta time for animations (in seconds)
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
        lastFrameTime = currentTime;
        
        // Update all citizens
        if (citizenPathfinding && currentCity) {
            citizenManager.updateAllCitizens(
                deltaTime,
                currentCity,
                citizenPathfinding.isRoadTile.bind(citizenPathfinding),
                citizenPathfinding.hasBuilding.bind(citizenPathfinding),
                citizenPathfinding.worldToTile.bind(citizenPathfinding),
                citizenPathfinding.getAdjacentRoads.bind(citizenPathfinding),
                citizenPathfinding.createRoadPath.bind(citizenPathfinding),
                (citizen) => citizenPathfinding.recalculateCitizenPath(citizen, citizenManager),
                citizenPathfinding.validatePath.bind(citizenPathfinding),
                citizenPathfinding.findBorderRoads.bind(citizenPathfinding)
            );
        }
        
        updateFocusedObject(); // Update focused object every frame
        // OPTIMIZATION: Update frustum culling for zone groups (throttled)
        if (performanceManager) {
            performanceManager.updateFrustumCulling();
            // OPTIMIZATION: Update shadow casting based on camera distance (throttled, not every frame)
            performanceManager.updateShadowCasting(50); // 50 unit distance threshold - objects beyond this won't cast shadows
        }
        renderer.render(scene, camera.camera);
        logPerformanceStats(); // Log performance stats if enabled
    }

    function start() {
        renderer.setAnimationLoop(draw);
    }

    function stop(){
        renderer.setAnimationLoop(null);
    }

    // Note: createDecorativeVillage() moved to DecorativeVillageManager
    
    // Note: addBackdrop() moved to BackdropManager

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

    // Note: showCleanupNotification() and showCleanupNotificationOnce() moved to BudgetProcessor

    /**
     * Immediately update a road tile visually without waiting for full scene update
     * This provides instant feedback when placing roads
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    // updateRoadImmediate removed - roads are now 3D meshes created like other buildings

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
        // updateRoadImmediate removed - roads are now 3D meshes
    }

    /**
     * Pauses all citizen animations (switches to idle)
     */
    function pauseCitizen() {
        citizenManager.pauseCitizens();
    }

    /**
     * Resumes all citizen animations (switches back to walk if was walking)
     */
    function resumeCitizen() {
        citizenManager.resumeCitizens();
    }
}