import * as THREE from 'three';
import {createCamera} from './camera.js';
import { createPerfHud } from './PerfHud.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import {applyHoverColor, resetHoveredObject, resetObjectColor} from './meshUtils.js';
import {  textures  } from './meshs/data.js'
import {
    bulldozeSelected,
    delayBox,
    displayDelayUI,
    gameWindow,
} from '../dom/shell/nodes.js';
import {
    assetsPrices,
    buildingsObjects,
    commerce,
    factories,
    farms,
    houses,
    palaces,
} from '../../shared/building-catalog/index.js';
import { setupRoadAccessIcons } from '../../contexts/parcels/infrastructure/presentation/roadAccessIcons.js';
import { TimeManager } from '../../shared/time/TimeManager.js';
import { LightingManager } from './managers/LightingManager.js';
import { BackdropManager } from './managers/BackdropManager.js';
import { DecorativeVillageManager } from './managers/DecorativeVillageManager.js';
import { ResourceManager } from './managers/ResourceManager.js';
import { PerformanceManager } from './managers/PerformanceManager.js';
import gameUIDefault from '../dom/shell/GameUI.js';
import { getCumulativeDeaths } from '../../composition/gameplayMortalityState.js';
import { CitizenManager } from './managers/CitizenManager.js';
import { CitizenPathfinding } from './managers/CitizenPathfinding.js';
import { TileGridOverlay } from './managers/TileGridOverlay.js';
import {
  MapOverlayVisibility,
  PRODUCTION_STATUS_SPRITE_NAMES,
} from './managers/MapOverlayVisibility.js';
import { syncTileNeighborsPass } from './sync/syncTileNeighborsPass.js';
import { cleanupOrphanedBuildings } from './sync/cleanupOrphanedBuildings.js';
import { registerAppService } from '../../composition/appServices.js';
import {
  getSessionService,
  getSessionGameUI,
} from '../../composition/sessionRuntime.js';
import { createPlacementGhostController } from './placementGhost.js';
import loaderManager from '../dom/shell/LoaderManager.js';
import { showWarningToast, showInfoToast } from '../dom/shell/ToastNotifier.js';

const SKY_URL = '/resources/textures/skies/plain_sky.jpg';

/** Terminaux tactiles / petits écrans — GPU plus souvent limité (mémoire, contexte WebGL). */
function isMobileDevice() {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const smallViewport = window.matchMedia?.('(max-width: 1024px)').matches ?? false;
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    return coarsePointer || smallViewport || mobileUA;
}

/**
 * @param {*} _gameStore
 * @param {object} assetManager
 * @param {object} deps
 * @param {object} deps.parcels
 * @param {object} deps.supply
 * @param {object} deps.housing
 * @param {object} deps.construction
 * @param {object} deps.employment
 * @param {() => void} [deps.resetProcessTurnBudget]
 * @param {object} [deps.gameUI]
 * @param {{ getActivePopups?: () => unknown[] } | null} [deps.popupManager]
 */
export function createScene(_gameStore, assetManager, deps) {
    const {
      parcels,
      supply,
      housing,
      construction,
      employment,
      resetProcessTurnBudget = () => {},
      gameUI = getSessionGameUI() ?? gameUIDefault,
      popupManager = null,
    } = deps;

    const findBuildingAtTile = (params) => construction.findBuildingAtTile(params);
    const getBuildingById = (id) => construction.getBuildingById(id);
    const updateBuildingFields = (id, fields) => construction.updateBuildingFields(id, fields);
    const getBuildingField = (id, key) => construction.getBuildingField(id, key);
    const incrementBuildingField = (params) => construction.incrementBuildingField(params);
    const listAllBuildingRows = () => construction.listAllBuildingRows();
    const ensureBuildingEmployeesSchema = (id, type) =>
      construction.ensureBuildingEmployeesSchema(id, type);

    const scene = new THREE.Scene();
    // Subtle atmospheric fog to blend far terrain and sky (tuned to match background)
    try { scene.fog = new THREE.FogExp2(0xfff3d6, 0.015); } catch(_) {}

    const placementGhost = createPlacementGhostController({ scene, assetManager });
    
    // Initialize managers
    const lightingManager = new LightingManager(scene);
    const backdropManager = new BackdropManager(scene);
    const decorativeVillageManager = new DecorativeVillageManager(scene, assetManager);
    const citizenManager = new CitizenManager(scene, assetManager);
    const tileGridOverlay = new TileGridOverlay();
    const mapOverlayVisibility = new MapOverlayVisibility();
    const syncRoadAccess = setupRoadAccessIcons(parcels, { assetManager, textures });

    /**
     * Gate supply-chain status sprites by the Production filter.
     * @param {boolean} condition
     * @returns {boolean}
     */
    function productionSpriteVisible(condition) {
      return Boolean(condition) && mapOverlayVisibility.isProductionIconsVisible();
    }

    /** Immediately hide production sprites (toggle off) without waiting for scene.update. */
    function hideProductionSpritesNow() {
      if (!buildings) return;
      const names = new Set(PRODUCTION_STATUS_SPRITE_NAMES);
      for (let x = 0; x < buildings.length; x++) {
        const row = buildings[x];
        if (!row) continue;
        for (let y = 0; y < row.length; y++) {
          const mesh = row[y];
          if (!mesh?.children) continue;
          for (const child of mesh.children) {
            if (child?.type === 'Sprite' && names.has(child.name)) {
              child.visible = false;
            }
          }
        }
      }
    }

    // Use simple scene background with sky texture - this ensures sky covers everything
    // The backdrop (distant ground) will be positioned to match World platform exactly
    backdropManager.initializeSky();
    
    // Initialize citizen manager
    citizenManager.initialize();
    
    // PerformanceManager and CitizenPathfinding will be created in initialize() after zoneGroups/buildings/terrain are set up
    let performanceManager = null;
    let citizenPathfinding = null;

    const camera = createCamera(gameWindow);
    const runningOnMobile = isMobileDevice();
    const renderer = new THREE.WebGLRenderer({
        // Sur mobile, on désactive l'antialiasing (coûteux en mémoire GPU) et on
        // évite que le navigateur refuse purement et simplement le contexte WebGL
        // sur un GPU jugé "faible" (failIfMajorPerformanceCaveat bloquerait sinon
        // la création du renderer sur pas mal de terminaux Android d'entrée de gamme).
        antialias: !runningOnMobile,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
    });
    renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight);
    if (runningOnMobile) {
        // Cap le pixel ratio sur mobile pour limiter la pression mémoire GPU
        // (une des causes les plus fréquentes de perte de contexte WebGL).
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    // Overlay perf : FPS + MS + MB, net, ~20% largeur, bas-droite
    // (stats.js en CSS scale était flou et ne montrait qu'un panneau)
    const stats = createPerfHud({ widthRatio: 0.2, bottom: 96, right: 16 });
    document.body.appendChild(stats.dom);
    
    // Add WebGL error handling
    const canvas = renderer.domElement;
    let webglContextLost = false;

    // Handle WebGL context lost — fréquent sur mobile (GPU/mémoire limités).
    // preventDefault() est indispensable : sans lui, le navigateur ne tente
    // jamais de restaurer le contexte et ne déclenche pas 'webglcontextrestored'.
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        webglContextLost = true;
        console.error('[WebGL] Context lost — ressources GPU insuffisantes (fréquent sur mobile).');

        // Le loader peut encore être visible au moment de la perte de contexte
        // (pendant scene.initialize) : on le masque pour éviter qu'il reste bloqué
        // indéfiniment, l'utilisateur reçoit le toast d'erreur à la place.
        loaderManager.hide(0);

        showWarningToast(
            "Le rendu 3D a rencontré un problème (ressources graphiques insuffisantes). Tentative de récupération automatique…",
            { timeout: 6000 }
        );
    });

    // Handle WebGL context restored — reconstruit la scène car toutes les
    // ressources GPU (textures, géométries) ont été perdues avec le contexte.
    canvas.addEventListener('webglcontextrestored', async () => {
        console.warn('[WebGL] Context restored, reconstruction de la scène…');
        webglContextLost = false;
        try {
            if (currentCity) {
                await initialize(currentCity);
            }
            showInfoToast('Affichage 3D restauré.', { timeout: 3000 });
        } catch (error) {
            console.error('[WebGL] Échec de la reconstruction après restauration du contexte:', error);
            showWarningToast(
                'Impossible de restaurer complètement l\'affichage. Merci de recharger la page.',
                { timeout: 8000 }
            );
        }
    });

    renderer.setClearColor(0x000000, 0);
    if (!runningOnMobile) {
        renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    // Ensure canvas allows touch events on mobile
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.pointerEvents = 'auto';
    
    // ORIGINAL ANORIA RENDERER SHADOW SETUP (restored exactly)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Rebuild the shadow map only when requested (placement / throttled), not every frame.
    // Per-frame autoUpdate is what made walking citizens flash the whole board.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    scene.userData.requestShadowRefresh = () => {
        renderer.shadowMap.needsUpdate = true;
    };
    
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
        const mouse = (getSessionService('inputManager')?.mouse ?? null);
        if (mouse) {
            return { x: mouse.x, y: mouse.y };
        }
        return { x: event.clientX, y: event.clientY };
    }

    //  Variables de items
    let terrain = [];
    let buildings = [];
    let loadingPromises = [];
    let currentCitySize = 16; // Store current city size for citizen pathfinding
    let currentCity = null; // Store current city object for citizen updates
    let lastSceneUpdateTime = 0;
    
    // Note: per-turn budget orchestration lives in ProcessTurnBudget (accounting BC) via scene.update
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
        resetProcessTurnBudget();
        
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
        scene.userData.requestShadowRefresh?.();

        // Visual tile grid (indication only — rebuilt after scene.clear())
        tileGridOverlay.rebuild(scene, city.size);
        
        // HUD placeholders — GameUI owns DOM (Barre D)
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => gameUI.resetInitialHud?.(), { timeout: 1000 });
        } else {
            setTimeout(() => gameUI.resetInitialHud?.(), 0);
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
        await resourceManager.initializeResources(
          city,
          assetManager,
          buildings,
          zoneGroups,
          { placeBuildingRecord: (data) => construction.placeBuildingRecord(data) },
          supply
        );
        
        // Create decorative village around the playable area
        decorativeVillageManager.createDecorativeVillage(citySize);
        
        // Initialize PerformanceManager after zoneGroups are set up
        performanceManager = new PerformanceManager(scene, camera, zoneGroups, buildings);
        
        // Initialize CitizenPathfinding after buildings and terrain are created
        citizenPathfinding = new CitizenPathfinding(buildings, terrain);
    }

    /** @type {Promise<void>} */
    let updateQueue = Promise.resolve();

    async function update(city, time = 0, options = {}) {
        // Serialize updates — concurrent scene.update (placement + game loop) raced on Dexie writes
        const run = () => runUpdate(city, time, options);
        const queued = updateQueue.then(run, run);
        updateQueue = queued.then(
            () => undefined,
            () => undefined
        );
        return queued;
    }

    async function runUpdate(city, time = 0, _options = {}) {
        lastSceneUpdateTime = time;

        /**
         * Housing ECS may rename persisted id/type (Blue→Red, etc.) while the mesh
         * still carries the old userData. Resolve by tile before existence checks.
         */
        async function syncResidentialHouseMeshFromDb(x, y, meshBuildingId) {
            if (
                !meshBuildingId ||
                (!houses.includes(meshBuildingId) && !palaces.includes(meshBuildingId))
            ) {
                return { buildingId: meshBuildingId, instanceId: null, synced: false };
            }

            const tileHouse = await housing.getResidentialHouseAt({ x, y });
            if (!tileHouse || !buildings[x]?.[y]) {
                return {
                    buildingId: meshBuildingId,
                    instanceId: city.tiles[x]?.[y]?.instanceId ?? buildings[x]?.[y]?.userData?.instanceId ?? null,
                    synced: false,
                };
            }

            const nextType = tileHouse.type;
            const instanceId = tileHouse.id;

            // city.tiles is placement SoT — do not rewrite a cleared (bulldozed) tile
            if (city.tiles[x]?.[y]?.buildingId) {
                city.tiles[x][y].buildingId = nextType;
                city.tiles[x][y].instanceId = instanceId;
            }

            if (nextType !== meshBuildingId) {
                removeInteractiveObject(buildings[x][y]);
                const nextMesh = assetManager.createAsset(nextType, x, y);
                if (!nextMesh) {
                    return {
                        buildingId: meshBuildingId,
                        instanceId,
                        synced: false,
                    };
                }
                buildings[x][y] = nextMesh;
                scene.userData.requestShadowRefresh?.();
                const zoneX = Math.floor(x / ZONE_SIZE);
                const zoneY = Math.floor(y / ZONE_SIZE);
                const citySize = city.size || 16;
                const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                if (zoneGroups[zoneIndex]) {
                    zoneGroups[zoneIndex].add(nextMesh);
                } else {
                    scene.add(nextMesh);
                }
            }

            if (buildings[x]?.[y]) {
                buildings[x][y].userData.instanceId = instanceId;
                buildings[x][y].userData.type = nextType;
                buildings[x][y].userData.id = nextType;
            }

            return { buildingId: nextType, instanceId, synced: true };
        }


        async function placeTileMeshIfNeeded(x, y, needsMeshPlacement, tileBuildingId) {
            if (!needsMeshPlacement || !tileBuildingId) {
                return;
            }
            const newBuildingId = tileBuildingId;
            if (newBuildingId === 'roads') {
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
                        terrainMesh.updateMatrixWorld(true);
                    }
                }
                if (!buildings[x][y] || buildings[x][y] !== terrain[x][y]) {
                    buildings[x][y] = terrain[x][y];
                }
                const roadInstanceId = city.tiles[x]?.[y]?.instanceId;
                if (roadInstanceId && terrain[x]?.[y]) {
                    terrain[x][y].userData.instanceId = roadInstanceId;
                }
                if (roadInstanceId) {
                    try {
                        await parcels.syncPlacedBuilding({
                            instanceId: roadInstanceId,
                            x,
                            y,
                            type: 'roads',
                        });
                    } catch (err) {
                        console.warn('[Scene] Failed parcels place for road', roadInstanceId, err);
                    }
                }
                return;
            }

            const buildingData = assetsPrices[newBuildingId];
            const gridSize = buildingData?.gridSize || 1;
            const placedInstanceId = city.tiles[x]?.[y]?.instanceId;

            // Origin = min (x,y) of this instance's footprint (not merely same building type).
            let isOriginTile = true;
            if (gridSize > 1) {
                if (placedInstanceId) {
                    if (
                        (x > 0 && city.tiles[x - 1]?.[y]?.instanceId === placedInstanceId) ||
                        (y > 0 && city.tiles[x]?.[y - 1]?.instanceId === placedInstanceId)
                    ) {
                        isOriginTile = false;
                    }
                } else if (
                    (x > 0 && city.tiles[x - 1]?.[y]?.buildingId === newBuildingId) ||
                    (y > 0 && city.tiles[x]?.[y - 1]?.buildingId === newBuildingId)
                ) {
                    isOriginTile = false;
                }
            }

            const assetId = newBuildingId === 'roads' ? 'StonePath-001' : newBuildingId;

            if (isOriginTile) {
                const mesh = assetManager.createAsset(assetId, x, y);
                // Asset pas encore chargé / id inconnu : ne pas écraser ni .add(undefined)
                // (sinon spam THREE à chaque tick via needsMeshPlacement).
                if (!mesh) {
                    return;
                }
                removeInteractiveObject(buildings[x][y]);
                buildings[x][y] = mesh;
                // Center multi-tile meshes on their footprint (anchor is NW corner).
                if (gridSize > 1) {
                    const centerOffset = (gridSize - 1) / 2;
                    mesh.position.x += centerOffset;
                    mesh.position.z += centerOffset;
                }
                scene.userData.requestShadowRefresh?.();
                const zoneX = Math.floor(x / ZONE_SIZE);
                const zoneY = Math.floor(y / ZONE_SIZE);
                const citySize = city.size || 16;
                const zoneIndex = zoneX * Math.ceil(citySize / ZONE_SIZE) + zoneY;
                if (zoneGroups[zoneIndex]) {
                    zoneGroups[zoneIndex].add(mesh);
                } else {
                    scene.add(mesh);
                }

                if (placedInstanceId) {
                    mesh.userData.instanceId = placedInstanceId;
                }

                if (placedInstanceId) {
                    try {
                        await parcels.syncPlacedBuilding({
                            instanceId: placedInstanceId,
                            x,
                            y,
                            type: newBuildingId,
                        });
                    } catch (err) {
                        console.warn('[Scene] Failed parcels place for', placedInstanceId, err);
                    }
                }
            }
        }

        // Population for HUD / citizens (gameplay persist + turn budget owned by game tick)
        const popSummary = await housing.getCityPopulationSummary();
        const totalPop = popSummary.totalPop;

        // --- BOUCLE SUR LA VILLE ----
        parcels.bindSpatialContext({ city, buildings, terrain, time });

        // UUID on meshes so spatial neighbor scans resolve Dexie rows (PlaceBuilding adjacents)
        for (let sx = 0; sx < city.size; sx++) {
            for (let sy = 0; sy < city.size; sy++) {
                const inst = city.tiles[sx]?.[sy]?.instanceId;
                if (!inst) continue;
                const mesh = buildings[sx]?.[sy];
                if (mesh?.userData) {
                    mesh.userData.instanceId = inst;
                }
            }
        }

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
              const tileBuildingId = city.tiles[x][y]?.buildingId;
              const tileInstanceId = city.tiles[x][y]?.instanceId;
              // Mesh may still be grass while city.tiles already holds the placed building
              if ((!currentBuildingId || currentBuildingId === 'grass') && tileBuildingId) {
                  currentBuildingId = tileBuildingId;
              }
              const meshBuildingType =
                  buildings[x][y]?.userData?.type || buildings[x][y]?.userData?.id;
              const effectiveMeshType =
                  meshBuildingType && meshBuildingType !== 'grass' ? meshBuildingType : null;
              const needsMeshPlacement = Boolean(
                  tileBuildingId && tileBuildingId !== effectiveMeshType
              );
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

              // Create/replace mesh before neighbor scans (grass in terrain[] ≠ building in buildings[])
              await placeTileMeshIfNeeded(x, y, needsMeshPlacement, tileBuildingId);

              if (tileInstanceId && buildings[x]?.[y]?.userData) {
                  buildings[x][y].userData.instanceId = tileInstanceId;
              }

              if((currentBuildingId || tileBuildingId) && isInCityLimits) {
                let currentInstanceId =
                    tileInstanceId
                    ?? buildings[x][y]?.userData?.instanceId
                    ?? null;

                // Only resolve/backfill instanceId when the tile still claims a building.
                // After bulldoze, city.tiles is cleared first — looking up Dexie would
                // briefly resurrect buildingId/instanceId and flash a mesh/sprite.
                if (!currentInstanceId && tileBuildingId) {
                    const atTile = await findBuildingAtTile({ x, y });
                    currentInstanceId = atTile?.instanceId ?? atTile?.id ?? null;
                    if (currentInstanceId && city.tiles[x]?.[y]) {
                        city.tiles[x][y].instanceId = currentInstanceId;
                    }
                }

                // Tile claims a building but instanceId not resolved yet — wait for next frame
                if (!currentInstanceId && tileBuildingId) {
                    continue;
                }

                // Bulldozed / ghost road: tile cleared but mesh or terrain material still present.
                // Must run even without instanceId (otherwise roads look uneraseable).
                {
                    const ghostMesh = buildings[x]?.[y];
                    const ghostType =
                        ghostMesh?.userData?.type
                        || ghostMesh?.userData?.id
                        || currentBuildingId;
                    const ghostIsRoad =
                        Boolean(ghostMesh?.userData?.isRoad)
                        || ghostType === 'roads'
                        || ghostType === 'Road'
                        || (typeof ghostType === 'string' && ghostType.startsWith('StonePath-'))
                        || (
                            !tileBuildingId
                            && terrain[x]?.[y]
                            && (terrain[x][y].userData?.isRoad || terrain[x][y].name === 'roads')
                        );
                    if (!tileBuildingId && ghostIsRoad) {
                        if (terrain[x] && terrain[x][y]) {
                            const terrainMesh = terrain[x][y];
                            const sharedMaterials = assetManager.getSharedTerrainMaterials();
                            if (sharedMaterials?.['grass'] && terrainMesh.material) {
                                terrainMesh.material = sharedMaterials['grass'];
                                terrainMesh.name = 'grass';
                                terrainMesh.userData.id = 'grass';
                                terrainMesh.userData.type = 'grass';
                                terrainMesh.userData.isRoad = false;
                                terrainMesh.userData.x = x;
                                terrainMesh.userData.y = y;
                                delete terrainMesh.userData.instanceId;
                            }
                        }
                        if (ghostMesh && ghostMesh !== terrain[x]?.[y]) {
                            removeInteractiveObject(ghostMesh);
                        }
                        buildings[x][y] = undefined;
                        continue;
                    }
                }

                if (!currentInstanceId) {
                    continue;
                }

                // Never sync residential FROM Dexie onto a cleared tile (bulldoze / orphan)
                if (
                    tileBuildingId &&
                    (houses.includes(currentBuildingId) || palaces.includes(currentBuildingId))
                ) {
                    const residentialSync = await syncResidentialHouseMeshFromDb(
                        x,
                        y,
                        currentBuildingId
                    );
                    currentBuildingId = residentialSync.buildingId;
                    if (residentialSync.instanceId) {
                        currentInstanceId = residentialSync.instanceId;
                    }
                }
                
                // Vérifier si le bâtiment existe encore dans la base de données
                // Si non, le supprimer de la scène (cas des événements aléatoires, etc.)
                // IMPORTANT: Ne pas supprimer si un nouveau bâtiment est en cours de création (newBuildingId existe)
                const meshTypeForRoad =
                    buildings[x][y]?.userData?.type
                    || buildings[x][y]?.userData?.id
                    || currentBuildingId;
                const isRoad =
                    Boolean(buildings[x][y]?.userData?.isRoad)
                    || meshTypeForRoad === 'roads'
                    || meshTypeForRoad === 'Road'
                    || (typeof meshTypeForRoad === 'string' && meshTypeForRoad.startsWith('StonePath-'));
                const hasNewBuilding = needsMeshPlacement;
                
                // city.tiles is SoT for roads: clear terrain material + StonePath mesh when tile empty
                // (bulldoze / failed payment). Previously only cleared buildings[] when it === terrain,
                // so StonePath meshes were left behind and looked "uneraseable".
                if (isRoad) {
                    const tileBuilding = city.tiles[x][y]?.buildingId;
                    const tileHasRoad =
                        Boolean(tileBuilding)
                        && (
                            tileBuilding === 'roads'
                            || tileBuilding === 'Road'
                            || tileBuilding.startsWith('StonePath-')
                        );
                    if (!tileHasRoad) {
                        if (terrain[x] && terrain[x][y]) {
                            const terrainMesh = terrain[x][y];
                            const sharedMaterials = assetManager.getSharedTerrainMaterials();
                            if (sharedMaterials && sharedMaterials['grass'] && terrainMesh.material) {
                                terrainMesh.material = sharedMaterials['grass'];
                                terrainMesh.name = 'grass';
                                terrainMesh.userData.id = 'grass';
                                terrainMesh.userData.type = 'grass';
                                terrainMesh.userData.isRoad = false;
                                terrainMesh.userData.x = x;
                                terrainMesh.userData.y = y;
                                delete terrainMesh.userData.instanceId;
                            }
                        }
                        const roadMesh = buildings[x][y];
                        if (roadMesh && roadMesh !== terrain[x]?.[y]) {
                            removeInteractiveObject(roadMesh);
                        }
                        buildings[x][y] = undefined;
                        continue;
                    }
                }
                
                // Ne vérifier la suppression que si aucun nouveau bâtiment n'est en cours de création
                if (!isRoad && !hasNewBuilding) {
                    let buildingExists = await getBuildingById(currentInstanceId);
                    // Resurrect from Housing only when the tile still claims this building
                    if (
                        !buildingExists &&
                        tileBuildingId &&
                        (houses.includes(currentBuildingId) || palaces.includes(currentBuildingId))
                    ) {
                        const tileHouse = await housing.getResidentialHouseAt({ x, y });
                        if (tileHouse) {
                            currentInstanceId = tileHouse.id;
                            currentBuildingId = tileHouse.type;
                            if (city.tiles[x]?.[y]) {
                                city.tiles[x][y].buildingId = tileHouse.type;
                                city.tiles[x][y].instanceId = tileHouse.id;
                            }
                            const meshType =
                                buildings[x][y]?.userData?.type ||
                                buildings[x][y]?.userData?.id;
                            if (tileHouse.type !== meshType) {
                                await syncResidentialHouseMeshFromDb(x, y, meshType);
                            }
                            buildingExists = await getBuildingById(currentInstanceId);
                        }
                    }
                    if (!buildingExists) {
                        const isTerrain = buildings[x][y] === terrain[x][y];
                        if (!isTerrain) {
                            removeInteractiveObject(buildings[x][y]);
                            buildings[x][y] = undefined;
                        }
                        if (city.tiles[x]?.[y]) {
                            city.tiles[x][y].buildingId = undefined;
                            city.tiles[x][y].instanceId = undefined;
                        }
                        continue;
                    }
                }
                
                // Update building data in database
                if (!isRoad) {
                    await updateBuildingFields(currentInstanceId, { worldTime: time });
                    await ensureBuildingEmployeesSchema(currentInstanceId, currentBuildingId);
                } else {
                    try {
                        await updateBuildingFields(currentInstanceId, { worldTime: time });
                        if (buildings[x][y]?.userData) {
                            await updateBuildingFields(currentInstanceId, {});
                        }

                        await ensureBuildingEmployeesSchema(currentInstanceId, currentBuildingId);
                    } catch (_err) {
                        // Route peut ne pas exister encore dans la DB, c'est normal lors de la création
                    }
                }

                // Defer sprites until the building mesh exists (grass in terrain[] is not a building mesh)
                if (!buildings[x][y]?.userData) {
                    continue;
                } else {



                // Processing building: ${currentBuildingId}
                const buildingData = {
                    city,
                    buildings,
                    x,
                    y,
                    currentBuildingId,
                    currentInstanceId,
                    terrain
                };

                // Neighbors persisted in second pass after all meshes exist
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
                        
                        // Handle geometry-based roads ('roads') and StonePath meshes
                        if (
                            currentBuildingId === 'roads'
                            || currentBuildingId === 'Road'
                            || currentBuildingId.startsWith('StonePath-')
                        ) {
                            try {
                                await parcels.syncRemovedBuilding({ instanceId: currentInstanceId });
                            } catch (err) {
                                console.warn('[Scene] Failed parcels remove for road', currentInstanceId, err);
                            }
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
                                    delete terrainMesh.userData.instanceId;
                                }
                            }
                            if (buildings[x][y] && buildings[x][y] !== terrain[x]?.[y]) {
                                removeInteractiveObject(buildings[x][y]);
                            }
                            buildings[x][y] = undefined;
                            if (city.tiles[x] && city.tiles[x][y]) {
                                city.tiles[x][y].buildingId = undefined;
                                city.tiles[x][y].instanceId = undefined;
                            }
                        } else {
                            try {
                                await parcels.syncRemovedBuilding({ instanceId: currentInstanceId });
                            } catch (err) {
                                console.warn('[Scene] Failed parcels remove for', currentInstanceId, err);
                            }
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

                /* Only for commerce buildings */
                if(commerce.includes(currentBuildingId)) {
                    await incrementBuildingField({
                        instanceId: currentInstanceId,
                        field: 'time',
                        increment: 1,
                        condition: false,
                    });

                    // Clean up market supply sprites (no-work → refreshEmploymentPresentation only)
                    if (buildings[x][y]) {
                        const marketSpriteNames = ['isBuying', 'isBuying-bg', 'no-food', 'no-food-bg'];
                        marketSpriteNames.forEach(spriteName => {
                            assetManager.removeStatusSprite(buildings[x][y], spriteName);
                        });
                    }

                    // Accès routier marché (BC Parcels + icône)
                    const marketRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714
                    };

                    if (buildings[x][y]) {
                        await syncRoadAccess({
                            instanceId: currentInstanceId,
                            mesh: buildings[x][y],
                            position: statutsIconsMeta.road.position,
                            scale: marketRoadScale,
                        });
                    }

                    if (buildings[x][y]) {
                        const marketSupply = await supply.getBuildingSupplyView(currentInstanceId);
                        const isBuying = marketSupply?.isBuying === true;
                        const noFarmsNearby = marketSupply?.noFarmsNearby === true;

                        if (isBuying === true) {
                            const buyingMeta = statutsIconsMeta['isBuying'];

                            if (!noFarmsNearby) {
                                assetManager.setStatusSprite(
                                    buildings[x][y],
                                    textures['isBuying'],
                                    'isBuying',
                                    buyingMeta.scale,
                                    buyingMeta.position,
                                    productionSpriteVisible(true),
                                    buyingMeta.spriteColor,
                                    buyingMeta.backgroundColor
                                );
                            } else {
                                assetManager.setStatusSprite(
                                    buildings[x][y],
                                    textures['isBuying'],
                                    'isBuying',
                                    buyingMeta.scale,
                                    buyingMeta.position,
                                    productionSpriteVisible(true),
                                    0xFF6600,
                                    0xFFCCCC
                                );
                            }
                        } else {
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

                        const marketSupplyStocks = marketSupply?.stocks
                            || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                        const hasFoodBaskets = (marketSupplyStocks.wheat || 0) > 0 ||
                            (marketSupplyStocks.carrot || 0) > 0 ||
                            (marketSupplyStocks.cabbage || 0) > 0 ||
                            (marketSupplyStocks.food || 0) > 0;

                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['nofood'],
                            'no-food',
                            statutsIconsMeta['no-food'].scale,
                            statutsIconsMeta['no-food'].position,
                            productionSpriteVisible(!hasFoodBaskets)
                        );
                    }

                    // Market stocks — Supply BC / ECS (legacy updateMarketStocks removed)
                }

                // Process windmills: show road access and collecting status sprites
                if((currentBuildingId.includes('Windmill') || currentBuildingId.includes('windmill')) && buildings[x][y]) {
                    // Clean up windmill supply sprites (no-work → refreshEmploymentPresentation only)
                    const windmillSpriteNames = ['isCollecting', 'isCollecting-bg'];
                    windmillSpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });
                    
                    // Accès routier moulin (BC Parcels + icône)
                    const windmillRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714
                    };

                    if (buildings[x][y]) {
                        await syncRoadAccess({
                            instanceId: currentInstanceId,
                            mesh: buildings[x][y],
                            position: statutsIconsMeta.road.position,
                            scale: windmillRoadScale,
                        });
                    }

                    if (buildings[x][y]) {
                        const windmillSupply = await supply.getBuildingSupplyView(currentInstanceId);
                        const isCollecting = windmillSupply?.isCollecting === true;

                        if (isCollecting === true) {
                            const collectingMeta = {
                                position: {x: -0.5, y: 0.5, z: 0},
                                scale: {x: 0.6, y: 0.6, z: 1},
                                spriteColor: 0x00FF00,
                                backgroundColor: 0xFFFFFF
                            };
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'isCollecting',
                                collectingMeta.scale,
                                collectingMeta.position,
                                productionSpriteVisible(true),
                                collectingMeta.spriteColor,
                                collectingMeta.backgroundColor
                            );
                        } else {
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

                // Accès routier grange (BC Parcels + icône no-road, même mécanisme que maisons / moulin)
                if (
                    (currentBuildingId.includes('Barn') || currentBuildingId === 'Barn-001')
                    && buildings[x][y]
                ) {
                    const barnRoadScale = {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714,
                    };
                    await syncRoadAccess({
                        instanceId: currentInstanceId,
                        mesh: buildings[x][y],
                        position: statutsIconsMeta.road.position,
                        scale: barnRoadScale,
                    });
                }

                // Process farms: season-specific sprites (harvest stocks → Supply BC)
                if(farms.includes(currentBuildingId) && buildings[x][y]) {
                    // First, clean up ALL possible farm sprites to prevent any leftover sprites
                    const allFarmSpriteNames = ['no-food', 'grow-food', 'harvest', 'sell-food',
                                                'no-food-bg', 'grow-food-bg', 'harvest-bg', 'sell-food-bg',
                                                'sold-to-windmill', 'sold-to-windmill-bg'];
                    allFarmSpriteNames.forEach(spriteName => {
                        assetManager.removeStatusSprite(buildings[x][y], spriteName);
                    });

                    const timeInfo = TimeManager.getTimeInfo(time);
                    const season = timeInfo.season;

                    // Season sprites from Supply/time — employment icons via refreshEmploymentPresentation
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
                            productionSpriteVisible(true),
                            spriteColor,
                            backgroundColor
                        );
                    }
                    
                    // In December, show additional sprite if farm sold to windmill
                    // This sprite appears alongside the winter season sprite to indicate windmill collection
                    if (buildings[x][y] && season === 'Hiver' && timeInfo.monthIndex === 11) {
                        const farmSupply = await supply.getBuildingSupplyView(currentInstanceId);
                        const soldToWindmill = farmSupply?.soldToWindmill === true;
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
                                productionSpriteVisible(true),
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
                    // Supply BC updates IndexedDB first (ECS supply.monthlyFood), then we read from it
                    // DO NOT write userData.stocks back to IndexedDB - it would overwrite service updates!
                    
                    // Removed old code that wrote userData.stocks to IndexedDB:
                    // This was causing the service's updates to be overwritten
                    // The service writes: stocks = {wheat: 0, carrot: 1, cabbage: 0, food: 1}
                    // Then this code was reading empty userData.stocks and overwriting IndexedDB with 0s!

                    // Read stocks from Supply BC
                    const houseSupply = await supply.getBuildingSupplyView(currentInstanceId);
                    const houseFoodStocks = houseSupply?.stocks || null;
                    let houseNeighbors = await getBuildingField(currentInstanceId, 'neighbors');
                    const currentPop = await getBuildingField(currentInstanceId, 'pop');
                    const worldTime = await getBuildingField(currentInstanceId, 'worldTime');
                    
                    // Sync Supply stocks to userData for visual display
                    if (houseFoodStocks && buildings[x][y] && buildings[x][y].userData) {
                        buildings[x][y].userData.stocks = {
                            food: houseFoodStocks.food || 0,
                            wheat: houseFoodStocks.wheat || 0,
                            carrot: houseFoodStocks.carrot || 0,
                            cabbage: houseFoodStocks.cabbage || 0
                        };
                    }
                    
                    const houseData = await getBuildingById(currentInstanceId);
                    const foodAffluence = housing.evaluateHouseFoodAffluence({
                        stocks: houseFoodStocks || {},
                        population: currentPop,
                    });
                    const { hasFood, isInsufficient } = foodAffluence;
                    // Road icon refreshed after neighbor pass (see refresh loop below)
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
                            productionSpriteVisible(showNoFoodIcon)
                        );
                    }
                    
                  
                    // DISABLED: Don't change building material color on decay
                    // This was causing unwanted color changes when opening info panel
                    // if(decay) {
                    //     assetManager.changeMeshColor(buildings[x][y],  0X404040)
                    // }


                }


                }

              }

            }

        }

        // Neighbor sync once every tile mesh is up to date this frame
        await syncTileNeighborsPass({
          city,
          buildings,
          terrain,
          time,
          parcels,
          updateBuildingFields,
        });

        // Sync residential + barn road icons after neighbors (evolution may have run in ECS)
        for (let nx = 0; nx < city.size; nx++) {
            for (let ny = 0; ny < city.size; ny++) {
                const tileType = city.tiles[nx]?.[ny]?.buildingId;
                const instanceId = city.tiles[nx]?.[ny]?.instanceId;
                if (!instanceId || !tileType) continue;
                const isResidential = houses.includes(tileType) || palaces.includes(tileType);
                const isBarn = tileType.includes('Barn') || tileType === 'Barn-001';
                if (!isResidential && !isBarn) continue;
                if (isResidential) {
                    const meshType = buildings[nx]?.[ny]?.userData?.type || buildings[nx]?.[ny]?.userData?.id;
                    await syncResidentialHouseMeshFromDb(nx, ny, meshType || tileType);
                }
                const mesh = buildings[nx]?.[ny];
                if (!mesh?.userData) continue;
                const roadScale = isBarn
                    ? {
                        x: statutsIconsMeta.road.scale.x * 0.714,
                        y: statutsIconsMeta.road.scale.y * 0.714,
                        z: statutsIconsMeta.road.scale.z * 0.714,
                      }
                    : statutsIconsMeta.road.scale;
                await syncRoadAccess({
                    instanceId,
                    mesh,
                    position: statutsIconsMeta.road.position,
                    scale: roadScale,
                });
            }
        }

        // Cleanup: Remove orphaned house records from IndexedDB
        try {
            await cleanupOrphanedBuildings({
                city,
                buildings,
                listAllBuildingRows,
                syncRemovedBuilding: (params) => parcels.syncRemovedBuilding(params),
            });
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


        // Display results in UI — population read at start of update (ECS already applied)
        const currentPopulation = totalPop;
        const { famishedPopulation } = await housing.getFamishedPopulation();
        
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
        
        // Famished / deaths counters — funds/employment HUD owned by syncSessionHud / tick
        gameUI.updateFamishedPopulation(famishedPopulation || 0);
        gameUI.updateDeaths?.(getCumulativeDeaths());

    }

    /**
     * Refresh employment bar + no-work icons from Employment BC read model.
     * Sole source of truth for no-work sprites on workplaces.
     * Call after scene.update; redistribution runs in ECS before the second scene pass.
     * @param {object} city
     */
    async function refreshEmploymentPresentation(city) {
        let unemployedCount = 0;
        let unemploymentPercentage = 0;
        let employmentLack = 0;
        let activeCitizenCount = 0;
        let elitePopulation = 0;
        let civilServantCount = 0;
        let activePopulationCount = 0;
        let totalPopulation = 0;
        /** @type {string[]} */
        let understaffedBuildingIds = [];

        try {
            const popSummary = await housing.getCityPopulationSummary();
            totalPopulation = popSummary.totalPop ?? 0;
        } catch (error) {
            console.warn('[scene.js] Error reading city population summary:', error);
        }

        try {
            const summary = await employment.getCityEmploymentSummary();
            unemployedCount = summary.unemployed;
            unemploymentPercentage = summary.unemploymentPercentage;
            employmentLack = summary.lack;
            activeCitizenCount = summary.activeCitizenCount;
            elitePopulation = summary.elitePool;
            civilServantCount = summary.civilServantCount;
            activePopulationCount = summary.activePopulationCount;
            understaffedBuildingIds = summary.understaffedBuildingIds;
        } catch (error) {
            console.warn('[scene.js] Error calculating employment summary:', error);
        }

        gameUI.updatePopulationBreakdown(
            totalPopulation,
            activeCitizenCount,
            elitePopulation,
            civilServantCount,
            activePopulationCount
        );
        gameUI.updateUnemployedPopulation(unemployedCount, unemploymentPercentage);
        gameUI.updateWorkerLack(employmentLack);

        const understaffed = new Set(understaffedBuildingIds);
        const noWorkSpriteColor = 0xFF0000;
        const noWorkBackgroundColor = 0xFFE8E8;

        for (let x = 0; x < city.size; x++) {
            for (let y = 0; y < city.size; y++) {
                const mesh = buildings[x]?.[y];
                if (!mesh?.userData) continue;

                const currentBuildingId = mesh.userData.type || mesh.userData.id;
                if (!currentBuildingId) continue;

                const instanceId =
                    mesh.userData.instanceId
                    ?? city.tiles?.[x]?.[y]?.instanceId
                    ?? null;
                if (!instanceId) continue;

                const isMarket = commerce.includes(currentBuildingId);
                const isFarm = farms.includes(currentBuildingId);
                const isWindmill =
                    currentBuildingId.includes('Windmill') || currentBuildingId.includes('windmill');
                const isFactory = factories.includes(currentBuildingId);

                if (!isMarket && !isFarm && !isWindmill && !isFactory) continue;

                if (understaffed.has(instanceId)) {
                    let position = { x: -0.8, y: 0.5, z: -0.2 };
                    let scale = { x: 0.5, y: 0.5, z: 0.5 };
                    if (isMarket || isWindmill) {
                        position = { x: -0.5, y: 0.5, z: 0 };
                        scale = { x: 0.6, y: 0.6, z: 1 };
                    }

                    assetManager.setStatusSprite(
                        mesh,
                        textures['no-work'],
                        'no-work',
                        scale,
                        position,
                        productionSpriteVisible(true),
                        noWorkSpriteColor,
                        noWorkBackgroundColor
                    );
                } else {
                    assetManager.removeStatusSprite(mesh, 'no-work');
                    assetManager.removeStatusSprite(mesh, 'no-work-bg');
                }
            }
        }
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
        scene.userData.requestShadowRefresh?.();
    }

    // Note: updateFrustumCulling() and updateShadowCasting() moved to PerformanceManager

    /**
     * Updates the focused object (object under cursor) via raycasting
     * Called every frame in the render loop
     * OPTIMIZED: Only raycast against interactive objects (buildings + terrain)
     * instead of all scene children (backdrop, lights, etc.)
     */
    function updateFocusedObject() {
        const inputMouse = (getSessionService('inputManager')?.mouse ?? null);
        if (!inputMouse) {
            return;
        }

        const { x: clientX, y: clientY } = inputMouse;
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
            Promise.resolve(this.onObjectSelected(object)).catch((error) => {
                console.error('[scene.js] onObjectSelected failed:', error);
            });
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
    registerAppService('togglePerformanceStats', function() {
        performanceStats.enabled = !performanceStats.enabled;
        localStorage.setItem('show-performance-stats', performanceStats.enabled.toString());
        return performanceStats.enabled;
    });

    registerAppService('toggleStatsJs', function() {
        return stats.toggle();
    });
    
    // Store last frame time for animation delta calculation
    let lastFrameTime = performance.now();

    // Note: updateCitizen() moved to CitizenManager.updateAllCitizens()
    
    function draw() {
        // Contexte WebGL perdu (mobile) : on suspend le travail (culling, citoyens,
        // pathfinding) le temps que 'webglcontextrestored' reconstruise la scène.
        if (webglContextLost) {
            return;
        }

        stats.begin();

        // Calculate delta time for animations (in seconds)
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
        lastFrameTime = currentTime;
        
        // Update all citizens (skip while game is paused)
        if (citizenPathfinding && currentCity && !gameUI.isPaused) {
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

        stats.end({ drawCalls: renderer.info.render.calls });
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
    let isLeftPointerDown = false;
    let rightPointerDownPos = null;
    let rightPointerHasMoved = false;

    function resolveInteractiveObjectAtEvent(event) {
        let objectToSelect = focusedObject;
        if (!objectToSelect) {
            const p = getPointerClientXY(event);
            mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera.camera);
            const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);
            objectToSelect = intersections.length > 0 ? intersections[0].object : null;
        }
        return objectToSelect;
    }

    function isInspectableBuilding(object) {
        const buildingId = object?.userData?.id;
        return Boolean(buildingId && buildingsObjects.includes(buildingId));
    }

    function onMouseDown(event){
        // Block interaction if a popup is open or info modal is open
        if (popupManager?.getActivePopups?.()?.length > 0) {
            return;
        }
        if (isInfoModalOpen()) {
            return;
        }
        if (performance.now() < suppressInputUntilMs) {
            return;
        }

        if (event.button === 0) {
            isLeftPointerDown = true;
        }

        if (event.button === 2) {
            rightPointerDownPos = getPointerClientXY(event);
            rightPointerHasMoved = false;
        }

        camera.onMouseDown(event);

        // Placement / selection: left click only
        // Right-click: camera pan on drag; short click inspects buildings (see onMouseUp)
        if (event.button !== 0) {
            return;
        }

        const objectToSelect = resolveInteractiveObjectAtEvent(event);

        // Update selected object using unified method
        if (objectToSelect) {
            updateSelectedObject.call(this, objectToSelect);
        }
    }

    function onMouseUp(event){
        // Always clear camera drag flags first (even if UI blocks the rest),
        // otherwise right-pan stays stuck after release.
        camera.onMouseUp(event);

        if (event.button === 0) {
            isLeftPointerDown = false;
            if (
                typeof this.onRoadPaintEnd === 'function'
                && !(popupManager?.getActivePopups?.()?.length > 0)
                && !isInfoModalOpen()
                && performance.now() >= suppressInputUntilMs
            ) {
                Promise.resolve(this.onRoadPaintEnd()).catch((error) => {
                    console.error('[scene.js] onRoadPaintEnd failed:', error);
                });
            }
        }

        if (event.button === 2) {
            const wasRightTap = Boolean(rightPointerDownPos) && !rightPointerHasMoved;
            rightPointerDownPos = null;
            rightPointerHasMoved = false;

            if (
                wasRightTap
                && !(popupManager?.getActivePopups?.()?.length > 0)
                && !isInfoModalOpen()
                && performance.now() >= suppressInputUntilMs
            ) {
                const objectToInspect = resolveInteractiveObjectAtEvent(event);
                if (isInspectableBuilding(objectToInspect)) {
                    // Switch to select tool (toolbar highlight) then open building info
                    if (typeof this.onEnterSelectMode === 'function') {
                        this.onEnterSelectMode();
                    }
                    updateSelectedObject.call(this, objectToInspect);
                }
            }
        }
    }

function onMouseMove(event) {
    // Block interaction if a popup is open or info modal is open
    if (popupManager?.getActivePopups?.()?.length > 0) {
        return;
    }
    if (isInfoModalOpen()) {
        // Reset mouse button states in camera to prevent dragging when modal closes
        camera.onMouseUp({ button: 0 }); // Reset left mouse
        camera.onMouseUp({ button: 1 }); // Reset middle mouse
        camera.onMouseUp({ button: 2 }); // Reset right mouse
        isLeftPointerDown = false;
        return;
    }
    if (performance.now() < suppressInputUntilMs) {
        return;
    }
    
    camera.onMouseMove(event);

    // Track right-drag vs short right-click (inspect)
    if (rightPointerDownPos && (event.buttons & 4) === 4) {
        const p = getPointerClientXY(event);
        const deltaX = Math.abs(p.x - rightPointerDownPos.x);
        const deltaY = Math.abs(p.y - rightPointerDownPos.y);
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > TAP_THRESHOLD) {
            rightPointerHasMoved = true;
        }
    }

    // Update the mouse coordinates for raycasting
    const p = getPointerClientXY(event);
    mouse.x = (p.x / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(p.y / renderer.domElement.clientHeight) * 2 + 1;

    // Perform raycasting (OPTIMIZED: only interactive objects)
    raycaster.setFromCamera(mouse, camera.camera);
    const intersections = raycaster.intersectObjects(getInteractiveObjects(), false);

    if(intersections.length) {
        focusedObject = intersections[0].object;
        hoveredObjectName = intersections[0]?.object?.name || ""
    } else {
        focusedObject = null;
        hoveredObjectName = '';
    }

    if (typeof this.onPlacementHover === 'function') {
        this.onPlacementHover(focusedObject);
    }

    // Cesar III style road paint: while LMB held, paint each hovered tile
    if (
        isLeftPointerDown
        && (event.buttons & 1) === 1
        && focusedObject
        && typeof this.onRoadPaintMove === 'function'
    ) {
        Promise.resolve(this.onRoadPaintMove(focusedObject)).catch((error) => {
            console.error('[scene.js] onRoadPaintMove failed:', error);
        });
    }
}


function onTouchStart(event) {
    // If canvas has pointer-events-disabled, touch events won't reach us at all
    // But if they do, we should still check for blocking popups
    // BUT: panel-layout should not block events (it's configured with shouldBlockEvents: false)
    const activePopups = popupManager?.getActivePopups?.() || [];
    const blockingPopups = activePopups.filter(id => {
        const config = popupManager?.popupConfigs?.get(id);
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
    if (popupManager?.getActivePopups?.()?.length > 0) {
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
    const activePopups = popupManager?.getActivePopups?.() || [];
    const blockingPopups = activePopups.filter(id => {
        const config = popupManager?.popupConfigs?.get(id);
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
        // StonePath tool: R rotates path orientation (Cesar-style), not the camera
        if (
            event.key
            && event.key.toLowerCase() === 'r'
            && !event.ctrlKey
            && !event.altKey
            && !event.metaKey
            && typeof this.onRotateBuildingTool === 'function'
        ) {
            const handled = this.onRotateBuildingTool(event);
            if (handled) {
                event.preventDefault?.();
                return;
            }
        }

        camera.onKeyBoardDown(event);
        // Raycasting need y and x axis as + on the terrain (plan) (y-1,y1,x1,x-1)
        // (number btw 0 and 1) * 2 - 1 > to get the value between -1 and 1
        const p = (getSessionService('inputManager')?.mouse ?? null) ?? { x: undefined, y: undefined };
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
        if (popupManager?.getActivePopups?.()?.length > 0) {
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

    // Note: cleanup toast → ui/compta/tresorerie/CleanupNotificationPresenter.js

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
        /** @type {((object: object) => void | Promise<void>) | undefined} */
        onRoadPaintMove: undefined,
        /** @type {(() => void | Promise<void>) | undefined} */
        onRoadPaintEnd: undefined,
        /** @type {((event?: KeyboardEvent) => boolean) | undefined} */
        onRotateBuildingTool: undefined,
        /** @type {((focused: object | null) => void) | undefined} */
        onPlacementHover: undefined,
        /**
         * Called before a right-click inspect selects a building.
         * Should switch the active tool to select-object and update toolbar UI.
         * @type {(() => void) | undefined}
         */
        onEnterSelectMode: undefined,
        // Expose focused/selected for external access if needed
        get focusedObject() { return focusedObject; },
        get selectedObject() { return selectedObject; },
        get isLeftPointerDown() { return isLeftPointerDown; },
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
        refreshEmploymentPresentation,
        /** Semi-transparent placement preview (StonePath trial). */
        placementGhost,
        /** Live mesh grid for turn-budget maintenance input. */
        get buildings() { return buildings; },
        setTileGridVisible(visible) {
            tileGridOverlay.setVisible(visible);
        },
        isTileGridVisible() {
            return tileGridOverlay.isVisible();
        },
        setProductionIconsVisible(visible) {
            mapOverlayVisibility.setProductionIconsVisible(visible);
            if (!mapOverlayVisibility.isProductionIconsVisible()) {
                hideProductionSpritesNow();
                return;
            }
            if (currentCity) {
                void refreshEmploymentPresentation(currentCity);
                void update(currentCity, lastSceneUpdateTime);
            }
        },
        isProductionIconsVisible() {
            return mapOverlayVisibility.isProductionIconsVisible();
        },
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