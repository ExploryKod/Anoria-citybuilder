import * as THREE from 'three';
import {createCamera} from './camera.js';
import { createPerfHud } from './PerfHud.js';
import { adoptHudFabDockChildren } from '../dom/shell/hudFabDock.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import {applyHoverColor, resetHoveredObject, resetObjectColor} from './meshUtils.js';
import { resolveIconAppearance, STATUS_ICON_DEFAULTS } from './meshs/statusIconAnchors.js';
import {  textures  } from './meshs/data.js'
import {
    bulldozeSelected,
    delayBox,
    displayDelayUI,
    gameWindow,
} from '../dom/shell/nodes.js';
import {
    buildingPlacementCatalog,
    buildingsObjects,
    farms,
    palaces,
} from '../../shared/building-catalog/index.js';
import { commerce, houses } from './assets/buildingCategories.js';
import { setupRoadAccessIcons } from '../../contexts/parcels/infrastructure/presentation/roadAccessIcons.js';
import { TimeManager } from '../../shared/time/TimeManager.js';
import { LightingManager } from './managers/LightingManager.js';
import { BackdropManager } from './managers/BackdropManager.js';
import { ResourceManager } from './managers/ResourceManager.js';
import { PerformanceManager } from './managers/PerformanceManager.js';
import { DecorativeVillageManager } from './managers/DecorativeVillageManager.js';
import { ensureNeighborHamletDecoAssets } from '../dom/boot/neighborHamletDecoAssets.js';
import { listUnlockedNeighborHamletIds } from '../../core/persistence/hamlet/hamletAccess.js';
import gameUIDefault from '../dom/shell/GameUI.js';
import { syncPopRailHud } from '../../composition/syncSessionHud.js';
import { CitizenManager } from './managers/CitizenManager.js';
import { CitizenPathfinding } from './managers/CitizenPathfinding.js';
import { createWalkerSpawnController } from './walkers/WalkerSpawnController.js';
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
import { pickTileFromRaycast } from './scene-board/tileRaycast.js';
import { pickEditorTileOnGroundPlane } from './scene-board/editorTileGroundPick.js';
import loaderManager from '../dom/shell/LoaderManager.js';
import { showWarningToast, showInfoToast } from '../dom/shell/ToastNotifier.js';
import { ASSET_CATALOG, resolveAndCreateBuildingMesh } from './meshs/resolveBuildingMesh.js';
import { scenePresentation } from './presentationConfig.js';
import { createSceneFog } from '../../shared/terrain-catalog/terrainAtmosphere.js';
import { isEditorMode } from '../../composition/sessionShell.js';
import { isCustomMapLayoutActive } from '../../shared/gameplay/customMapLayout.js';
import { resolveKenneyGltfPresentationMode } from './adapters/kenney-nature/kenneyGltfPresentation.js';
import { getTerrainZoneCounts, resolveTerrainZoneIndex } from '../../shared/terrain-catalog/terrainZoneLayout.js';
import { spawnIslandShore } from './scene-board/terrain/spawnIslandShore.js';
import {
  restoreGrassMaterialOnTerrainTile,
} from './scene-board/terrain/terrainSceneTileOps.js';
import { createKenneyNatureSceneTile } from './scene-board/nature/createKenneyNatureSceneTile.js';
import { createKenneyTerrainSceneTile } from './scene-board/terrain/createKenneyTerrainSceneTile.js';
import { attachSceneTilePort } from './scene-board/SceneTilePort.js';
import {
  addEditorStackObject,
  getEditorStackObjects,
  removeEditorStackObjectById,
  removeEditorStackObjectsAtTile,
  removeTopEditorStackObjectAt,
  resetEditorNatureLayout,
} from './editor/editorNatureLayout.js';
import {
  resolveEditorPlacementTarget,
  resolveEditorStackPlacement,
  resolveEditorGhostPlacementPreview as computeEditorGhostPlacementPreview,
} from '../../shared/editor-catalog/editorStackPlacement.js';
import { applyKenneyVerticalEdgeMountToObject } from '../../shared/editor-catalog/editorVerticalFaceMount.js';
import { WORLD_PLATFORM_Y } from '../../shared/terrain-catalog/terrainWorldContract.js';
import { EDITOR_SEA_TERRAIN_ID, isEditorSeaTerrain } from '../../shared/terrain-catalog/editorSeaTerrain.js';

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
    try {
        scene.fog = usesEditorLikePresentation() ? null : createSceneFog({ editor: false });
    } catch (_) {}

    const placementGhost = createPlacementGhostController({ scene, assetManager });
    
    // Initialize managers
    const lightingManager = new LightingManager(scene);
    const backdropManager = new BackdropManager(scene);
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

    backdropManager.applyAtmosphere();
    
    // Initialize citizen manager
    citizenManager.initialize();
    
    // PerformanceManager and CitizenPathfinding will be created in initialize() after zoneGroups/buildings/terrain are set up
    let performanceManager = null;
    let citizenPathfinding = null;
    let walkerSpawnController = null;

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
    adoptHudFabDockChildren();
    
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
                await initialize(currentCity, { seedNature: false });
                await update(currentCity, lastSceneUpdateTime);
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

    function isMobileBuildBarOpen() {
        return document.documentElement.classList.contains('mobile-build-bar-open');
    }

    /**
     * True while a dialog / overlay owns the UI — no camera pan, placement nudge, or scene keys.
     * (EventBlocker lets keys through when focus is inside the modal so Tab/fields work;
     * this guard freezes the game world separately.)
     */
    function isGameWorldInputLocked() {
        if (isMobileBuildBarOpen()) return true;
        if (isInfoModalOpen()) return true;
        if ((popupManager?.getActivePopups?.() || []).length > 0) return true;
        if (document.getElementById('parameters-panel')?.classList.contains('visible')) return true;
        if (document.getElementById('tutorial-panel')?.classList.contains('visible')) return true;
        if (document.getElementById('objectives-panel')?.classList.contains('visible')) return true;
        if (loaderManager.isShowing()) return true;
        return false;
    }

    function resetCameraDragState() {
        camera.onMouseUp({ button: 0 });
        camera.onMouseUp({ button: 1 });
        camera.onMouseUp({ button: 2 });
        isLeftPointerDown = false;
    }

    // Selections d'un objet
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedObject = undefined; // Object that is currently selected (clicked)
    let focusedObject = undefined; // Object currently under cursor (hover)
    /** @type {((focused: object | null) => void) | undefined} */
    let onPlacementHoverHandler = undefined;
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
    /** @type {Map<string, import('three').Object3D>} */
    const editorStackMeshes = new Map();
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
    let terrainZonePadding = 0;
    let zoneGroupsInitialized = false;
    let editorStackHydrationEnabled = false;

    function usesEditorLikePresentation() {
        return isEditorMode() || isCustomMapLayoutActive();
    }

    // Variables de gameplay
    let delay = 0;
    const decorativeVillageManager = new DecorativeVillageManager(scene, assetManager);

    async function syncNeighborHamletDeco(city) {
        const citySize = city?.size;
        if (typeof citySize !== 'number' || citySize <= 0) return;
        await ensureNeighborHamletDecoAssets(assetManager);
        const unlockedHamletIds = await listUnlockedNeighborHamletIds();
        decorativeVillageManager.syncUnlockedNeighborHamlets(citySize, unlockedHamletIds);
    }

    async function initialize(city, options = {}) {
        const seedNature = options.seedNature === true;
        editorStackHydrationEnabled = usesEditorLikePresentation() || options.hydrateEditorLayout === true;

        // Store world platform before clearing scene (legacy village ground — optional)
        let worldPlatform = scenePresentation.villageWorldPlatformEnabled
            ? scene.getObjectByName('world-platform')
            : null;
        
        scene.clear();
        zoneGroups.length = 0;
        zoneGroupsInitialized = false;
        // Re-apply fog and flat background after clear
        try {
            scene.fog = usesEditorLikePresentation() ? null : createSceneFog({ editor: false });
        } catch (_) {}
        backdropManager.applyAtmosphere();
        terrain = [];
        buildings = [];
        editorStackMeshes.clear();
        if (isEditorMode()) {
            resetEditorNatureLayout();
        }
        loadingPromises = [];
        
        // Store city object and size for citizen pathfinding and World platform scaling
        currentCity = city;
        const citySize = city && typeof city.size === 'number' ? city.size : 16;
        if (city && typeof city.size === 'number') {
            currentCitySize = city.size;
        }
        
        // Village world platform (legacy) — Kenney terrain tiles replace it when disabled.
        if (scenePresentation.villageWorldPlatformEnabled) {
            if (worldPlatform) {
                const existingScale = worldPlatform.scale.x;
                const expectedScale = (citySize + 2) / (existingScale > 0 ? 1 / existingScale : 1);
                if (Math.abs(existingScale - expectedScale) > 0.1) {
                    scene.remove(worldPlatform);
                    worldPlatform = null;
                } else {
                    scene.add(worldPlatform);
                }
            }

            if (!worldPlatform) {
                try {
                    await assetManager.loadWorldPlatform(scene, citySize);
                } catch (error) {
                    console.warn('[Scene] Could not load world platform:', error);
                }
            }
        } else {
            const stalePlatform = scene.getObjectByName('world-platform');
            if (stalePlatform) {
                scene.remove(stalePlatform);
            }
        }
        
        // Village boundary fences (legacy) — optional while Kenney scene is integrated.
        const existingFenceGroup = scene.getObjectByName('boundary-fences');
        if (existingFenceGroup) {
            scene.remove(existingFenceGroup);
        }

        if (scenePresentation.villageBoundaryFencesEnabled) {
            try {
                await assetManager.loadBoundaryFences(scene, citySize);
            } catch (error) {
                console.warn('[Scene] Could not load boundary fences:', error);
            }
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
            const organicPadding = scenePresentation.islandShoreOrganicPadding
                ?? scenePresentation.islandBeachBorderRingWidth
                ?? 4;
            terrainZonePadding = scenePresentation.islandBeachBorderEnabled
                ? Math.ceil((organicPadding + 1) / ZONE_SIZE)
                : 0;
            const { numZonesX, numZonesY } = getTerrainZoneCounts(
                city.size,
                ZONE_SIZE,
                terrainZonePadding
            );

            for (let zoneX = 0; zoneX < numZonesX; zoneX++) {
                for (let zoneY = 0; zoneY < numZonesY; zoneY++) {
                    const zoneGroup = new THREE.Group();
                    zoneGroup.name = `zone_${zoneX}_${zoneY}`;
                    zoneGroup.userData = {
                        zoneX,
                        zoneY,
                        minX: (zoneX - terrainZonePadding) * ZONE_SIZE,
                        minY: (zoneY - terrainZonePadding) * ZONE_SIZE,
                    };
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
        
        // Create terrain efficiently — editor starts empty (sea tiles, no base meshes).
        for(let x = 0; x < city.size; x++) {
            let column = [];
            for(let y = 0; y < city.size; y++) {
                const terrainId = city.tiles[x][y].terrainId;
                if (usesEditorLikePresentation() || isEditorSeaTerrain(terrainId)) {
                    column.push(null);
                    continue;
                }
                const mesh = assetManager.createAsset(terrainId, x, y);
                mesh.name = terrainId;
                
                // OPTIMIZATION: Add to zone group (zone groups are in scene)
                // This allows frustum culling to work properly
                const zoneIndex = resolveTerrainZoneIndex(
                    x,
                    y,
                    city.size,
                    ZONE_SIZE,
                    terrainZonePadding
                );
                
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

        backdropManager.syncGroundFill(citySize);

        if (scenePresentation.islandBeachBorderEnabled && !usesEditorLikePresentation()) {
            const organicPadding = scenePresentation.islandShoreOrganicPadding
                ?? scenePresentation.islandBeachBorderRingWidth
                ?? 4;
            const beach = spawnIslandShore({
                citySize,
                zoneSize: ZONE_SIZE,
                zonePadding: terrainZonePadding,
                zoneGroups,
                scene,
                padding: organicPadding,
                seed: scenePresentation.islandShoreSeed ?? 42,
            });
            if (beach.tileCount === 0) {
                console.warn('[Scene] Island beach border: no tiles spawned');
            }
        }

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

        await syncEditorStackFromLayout();
        
        // Set camera bounds based on city size (with small margins)
        if (camera.setBounds && city && typeof city.size === 'number') {
            const organicPadding = scenePresentation.islandShoreOrganicPadding
                ?? scenePresentation.islandBeachBorderRingWidth
                ?? 4;
            const beachMargin = scenePresentation.islandBeachBorderEnabled
                ? organicPadding + 1
                : 2;
            camera.setBounds({
                minX: -beachMargin,
                maxX: city.size + beachMargin - 1,
                minZ: -beachMargin,
                maxZ: city.size + beachMargin - 1,
            });
            
            // Center camera on the city (critical for proper raycasting coordinates)
            if (camera.centerOnCity) {
                camera.centerOnCity(city.size);
            }
        }

        // No extra backdrop — syncGroundFill covers the infinite ground aspect.

        // Initialize resources (trees, boulders) only on a virgin hamlet.
        // Returning to a saved hamlet hydrates tiles from Dexie instead.
        if (seedNature) {
            const resourceManager = new ResourceManager();
            await resourceManager.initializeResources(
              city,
              assetManager,
              buildings,
              zoneGroups,
              { placeBuildingRecord: (data) => construction.placeBuildingRecord(data) },
              supply
            );
        }
        
        await syncNeighborHamletDeco(city);
        
        // Initialize PerformanceManager after zoneGroups are set up
        performanceManager = new PerformanceManager(scene, camera, zoneGroups, buildings);
        
        // Initialize CitizenPathfinding after buildings and terrain are created
        citizenPathfinding = new CitizenPathfinding(buildings, terrain);

        // Catalog-driven walkers: spawns a character whenever a placed
        // 'origin' building can reach a placed 'destination' building by
        // road (see buildingEconomy.js `walker` facts). See
        // src/presentation/three/walkers/WalkerSpawnController.js.
        walkerSpawnController = createWalkerSpawnController({
            scene,
            citizenManager,
            citizenPathfinding,
            buildings,
            city: currentCity,
            getCitySize: () => currentCity?.size ?? currentCitySize,
        });
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
                const citySize = city.size || 16;
                const zoneIndex = resolveTerrainZoneIndex(
                    x,
                    y,
                    citySize,
                    ZONE_SIZE,
                    terrainZonePadding
                );
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

            const buildingData = buildingPlacementCatalog[newBuildingId];
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

            const placementRotationStep = city.tiles[x]?.[y]?.placementRotationStep ?? 0;

            if (isOriginTile) {
                const catalogEntry = ASSET_CATALOG[newBuildingId];
                if (!catalogEntry) {
                    throw new Error(`[buildingAssets] No catalog entry for "${newBuildingId}"`);
                }

                if (catalogEntry.source === 'kenneyCityKit') {
                    const kenneyMesh = await resolveAndCreateBuildingMesh({
                        buildingId: newBuildingId,
                        x,
                        y,
                        rotationStep: placementRotationStep,
                        assetManager,
                    });
                    removeInteractiveObject(buildings[x][y]);
                    buildings[x][y] = kenneyMesh;
                    scene.userData.requestShadowRefresh?.();
                    const citySize = city.size || 16;
                    const zoneIndex = resolveTerrainZoneIndex(
                        x,
                        y,
                        citySize,
                        ZONE_SIZE,
                        terrainZonePadding
                    );
                    const interactiveGroupRef =
                        scene.interactiveGroup || scene.getObjectByName('interactive-objects');
                    if (zoneGroups[zoneIndex]) {
                        zoneGroups[zoneIndex].add(kenneyMesh);
                    } else if (interactiveGroupRef) {
                        interactiveGroupRef.add(kenneyMesh);
                    }
                    return;
                }

                const mesh = await resolveAndCreateBuildingMesh({
                    buildingId: newBuildingId,
                    x,
                    y,
                    rotationStep: placementRotationStep,
                    assetManager,
                });
                removeInteractiveObject(buildings[x][y]);
                buildings[x][y] = mesh;
                // Center multi-tile meshes on their footprint (anchor is NW corner).
                if (gridSize > 1) {
                    const centerOffset = (gridSize - 1) / 2;
                    mesh.position.x += centerOffset;
                    mesh.position.z += centerOffset;
                }
                scene.userData.requestShadowRefresh?.();
                const citySize = city.size || 16;
                const zoneIndex = resolveTerrainZoneIndex(
                    x,
                    y,
                    citySize,
                    ZONE_SIZE,
                    terrainZonePadding
                );
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

        // Status icon defaults — shared with /placement.html, see meshs/statusIconAnchors.js
        const statutsIconsMeta = STATUS_ICON_DEFAULTS;

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
                      const terrainNode = terrain[x][y];
                      const sharedMaterials = assetManager.getSharedTerrainMaterials();
                      if (sharedMaterials?.grass) {
                          restoreGrassMaterialOnTerrainTile(
                              terrainNode,
                              sharedMaterials.grass,
                              { x, y }
                          );
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
                            const sharedMaterials = assetManager.getSharedTerrainMaterials();
                            if (sharedMaterials?.grass) {
                                restoreGrassMaterialOnTerrainTile(
                                    terrain[x][y],
                                    sharedMaterials.grass,
                                    { x, y }
                                );
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
                            const sharedMaterials = assetManager.getSharedTerrainMaterials();
                            if (sharedMaterials?.grass) {
                                restoreGrassMaterialOnTerrainTile(
                                    terrain[x][y],
                                    sharedMaterials.grass,
                                    { x, y }
                                );
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
                                const sharedMaterials = assetManager.getSharedTerrainMaterials();
                                if (sharedMaterials?.grass) {
                                    restoreGrassMaterialOnTerrainTile(
                                        terrain[x][y],
                                        sharedMaterials.grass,
                                        { x, y }
                                    );
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
                        const marketRoadIcon = resolveIconAppearance(
                            buildings[x][y], 'road', statutsIconsMeta.road.position, marketRoadScale
                        );
                        await syncRoadAccess({
                            instanceId: currentInstanceId,
                            mesh: buildings[x][y],
                            position: marketRoadIcon.position,
                            scale: marketRoadIcon.scale,
                        });
                    }

                    if (buildings[x][y]) {
                        const marketSupply = await supply.getBuildingSupplyView(currentInstanceId);
                        const isBuying = marketSupply?.isBuying === true;
                        const noFarmsNearby = marketSupply?.noFarmsNearby === true;

                        if (isBuying === true) {
                            const buyingMeta = statutsIconsMeta['isBuying'];
                            const buyingIcon = resolveIconAppearance(
                                buildings[x][y], 'isBuying', buyingMeta.position, buyingMeta.scale
                            );

                            if (!noFarmsNearby) {
                                assetManager.setStatusSprite(
                                    buildings[x][y],
                                    textures['isBuying'],
                                    'isBuying',
                                    buyingIcon.scale,
                                    buyingIcon.position,
                                    productionSpriteVisible(true),
                                    buyingMeta.spriteColor,
                                    buyingMeta.backgroundColor
                                );
                            } else {
                                assetManager.setStatusSprite(
                                    buildings[x][y],
                                    textures['isBuying'],
                                    'isBuying',
                                    buyingIcon.scale,
                                    buyingIcon.position,
                                    productionSpriteVisible(true),
                                    0xFF6600,
                                    0xFFCCCC
                                );
                            }
                        } else {
                            const buyingIcon = resolveIconAppearance(
                                buildings[x][y],
                                'isBuying',
                                statutsIconsMeta['isBuying'].position,
                                statutsIconsMeta['isBuying'].scale
                            );
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isBuying'],
                                'isBuying',
                                buyingIcon.scale,
                                buyingIcon.position,
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

                        const marketNoFoodIcon = resolveIconAppearance(
                            buildings[x][y], 'no-food', statutsIconsMeta['no-food'].position, statutsIconsMeta['no-food'].scale
                        );
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['nofood'],
                            'no-food',
                            marketNoFoodIcon.scale,
                            marketNoFoodIcon.position,
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
                        const windmillRoadIcon = resolveIconAppearance(
                            buildings[x][y], 'road', statutsIconsMeta.road.position, windmillRoadScale
                        );
                        await syncRoadAccess({
                            instanceId: currentInstanceId,
                            mesh: buildings[x][y],
                            position: windmillRoadIcon.position,
                            scale: windmillRoadIcon.scale,
                        });
                    }

                    if (buildings[x][y]) {
                        const windmillSupply = await supply.getBuildingSupplyView(currentInstanceId);
                        const isCollecting = windmillSupply?.isCollecting === true;
                        const collectingMeta = statutsIconsMeta.isCollecting;
                        const collectingIcon = resolveIconAppearance(
                            buildings[x][y], 'isCollecting', collectingMeta.position, collectingMeta.scale
                        );

                        if (isCollecting === true) {
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'isCollecting',
                                collectingIcon.scale,
                                collectingIcon.position,
                                productionSpriteVisible(true),
                                collectingMeta.spriteColor,
                                collectingMeta.backgroundColor
                            );
                        } else {
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'],
                                'isCollecting',
                                collectingIcon.scale,
                                collectingIcon.position,
                                false,
                                null,
                                null
                            );
                        }
                    }
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
                        const seasonIcon = resolveIconAppearance(buildings[x][y], spriteName, spritePosition, spriteScale);
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            spriteTexture,
                            spriteName,
                            seasonIcon.scale,
                            seasonIcon.position,
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
                        const windmillSaleMeta = statutsIconsMeta['sold-to-windmill'];
                        const windmillSaleIcon = resolveIconAppearance(
                            buildings[x][y], 'sold-to-windmill', windmillSaleMeta.position, windmillSaleMeta.scale
                        );
                        if (soldToWindmill === true) {
                            // Show windmill collection sprite (green, similar to windmill's isCollecting)
                            assetManager.setStatusSprite(
                                buildings[x][y],
                                textures['isCollecting'], // Reuse windmill collecting icon
                                'sold-to-windmill',
                                windmillSaleIcon.scale,
                                windmillSaleIcon.position,
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
                                windmillSaleIcon.scale,
                                windmillSaleIcon.position,
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
                        const houseNoFoodIcon = resolveIconAppearance(
                            buildings[x][y], 'no-food', statutsIconsMeta.food.position, statutsIconsMeta.food.scale
                        );
                        assetManager.setStatusSprite(
                            buildings[x][y],
                            textures['nofood'],
                            'no-food',
                            houseNoFoodIcon.scale,
                            houseNoFoodIcon.position,
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

        // Sync residential road icons after neighbors (evolution may have run in ECS)
        for (let nx = 0; nx < city.size; nx++) {
            for (let ny = 0; ny < city.size; ny++) {
                const tileType = city.tiles[nx]?.[ny]?.buildingId;
                const instanceId = city.tiles[nx]?.[ny]?.instanceId;
                if (!instanceId || !tileType) continue;
                const isResidential = houses.includes(tileType) || palaces.includes(tileType);
                if (!isResidential) continue;
                const meshType = buildings[nx]?.[ny]?.userData?.type || buildings[nx]?.[ny]?.userData?.id;
                await syncResidentialHouseMeshFromDb(nx, ny, meshType || tileType);
                const mesh = buildings[nx]?.[ny];
                if (!mesh?.userData) continue;
                const residentialRoadIcon = resolveIconAppearance(mesh, 'road', statutsIconsMeta.road.position, statutsIconsMeta.road.scale);
                await syncRoadAccess({
                    instanceId,
                    mesh,
                    position: residentialRoadIcon.position,
                    scale: residentialRoadIcon.scale,
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
        // Famished / deaths / pop rail — owned by syncPopRailHud (tick + refreshEmploymentPresentation)

        // Catalog-driven walkers: scan for origin buildings that can now
        // reach a destination building, once per turn.
        if (walkerSpawnController) {
            walkerSpawnController.scanForJourneys();
        }
    }

    /**
     * Refresh employment bar + no-work icons from Employment BC read model.
     * Sole source of truth for no-work sprites on workplaces.
     * Call after scene.update; redistribution runs in ECS before the second scene pass.
     * @param {object} city
     */
    async function refreshEmploymentPresentation(city) {
        await syncPopRailHud(gameUI);

        /** @type {string[]} */
        let understaffedBuildingIds = [];

        try {
            const summary = await employment.getCityEmploymentSummary();
            understaffedBuildingIds = summary.understaffedBuildingIds;
        } catch (error) {
            console.warn('[scene.js] Error calculating employment summary:', error);
        }

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

                if (!isMarket && !isFarm && !isWindmill) continue;

                if (understaffed.has(instanceId)) {
                    const noWorkMeta = (isMarket || isWindmill)
                        ? STATUS_ICON_DEFAULTS['no-work-market-windmill']
                        : STATUS_ICON_DEFAULTS['no-work'];
                    const noWorkIcon = resolveIconAppearance(mesh, 'no-work', noWorkMeta.position, noWorkMeta.scale);

                    assetManager.setStatusSprite(
                        mesh,
                        textures['no-work'],
                        'no-work',
                        noWorkIcon.scale,
                        noWorkIcon.position,
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
        const objects = [];
        zoneGroups.forEach((zoneGroup) => {
            zoneGroup.children.forEach((child) => {
                if (child.userData?.isDecorative) return;
                if (child.userData?.nonInteractive) return;
                if (child.name?.startsWith('decorative-')) return;
                objects.push(child);
            });
        });
        if (objects.length === 0) {
            scene.children.forEach((child) => {
                if (child.userData?.isDecorative) return;
                if (child.userData?.nonInteractive) return;
                if (child.name?.startsWith('decorative-')) return;
                if (
                    child.name === 'world-platform'
                    || child.name === 'kenney-ground-fill'
                    || child.name === 'infinite-ground-base'
                    || child.name === 'infinite-ground-large'
                ) {
                    return;
                }
                objects.push(child);
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
    function addMeshToTileZone(mesh, x, y, citySize = currentCitySize) {
        const zoneIndex = resolveTerrainZoneIndex(
            x,
            y,
            citySize,
            ZONE_SIZE,
            terrainZonePadding
        );
        if (zoneGroups[zoneIndex]) {
            zoneGroups[zoneIndex].add(mesh);
            zoneGroups[zoneIndex].visible = true;
        } else {
            scene.add(mesh);
        }
        mesh.updateMatrixWorld(true);
        performanceManager?.invalidateFrustumCache();
    }

    /**
     * Replace the Kenney terrain mesh at (x, y). Updates `terrain[][]` only.
     * @param {object} city
     * @param {number} x
     * @param {number} y
     * @param {string} terrainId
     * @param {number} [rotationStep=0]
     * @returns {boolean}
     */
    function replaceTerrainAt(city, x, y, terrainId, rotationStep = 0) {
        const oldMesh = terrain[x]?.[y];
        if (oldMesh) {
            removeInteractiveObject(oldMesh);
        }

        const mesh = assetManager.createAsset(terrainId, x, y);
        if (!mesh) {
            console.warn('[Scene] replaceTerrainAt: failed to create mesh', { terrainId, x, y });
            return false;
        }

        const normalizedStep = ((rotationStep % 4) + 4) % 4;
        mesh.rotation.y = normalizedStep * (Math.PI / 2);
        mesh.name = terrainId;
        if (!terrain[x]) {
            terrain[x] = [];
        }
        terrain[x][y] = mesh;
        addMeshToTileZone(mesh, x, y, city?.size ?? currentCitySize);
        scene.userData.requestShadowRefresh?.();
        return true;
    }

    /**
     * @param {import('./editor/editorNatureLayout.js').EditorStackObject} entry
     * @returns {Promise<import('three').Object3D | null>}
     */
    async function createEditorStackMesh(entry) {
        const {
            assetId,
            x,
            y,
            rotationY,
            baseLocalY,
            id,
            mountMode,
            faceDirection,
            hostAssetId,
        } = entry;
        const kenneyPresentation = resolveKenneyGltfPresentationMode();

        if (assetId.startsWith('nature-prop:')) {
            const { getKenneyNaturePropAdapter } = await import(
                './adapters/kenney-nature-props/KenneyNaturePropAdapter.js'
            );
            await getKenneyNaturePropAdapter().ensurePropLoaded(assetId, kenneyPresentation);
            const port = createKenneyNatureSceneTile(assetId, x, y, rotationY ?? 0, {
                baseLocalY,
                editorStackId: id,
                presentation: kenneyPresentation,
            });
            attachSceneTilePort(port);
            port.root.traverse((child) => {
                child.frustumCulled = false;
            });
            return port.root;
        }

        const { getKenneyNatureTerrainAdapter } = await import(
            './adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js'
        );
        await getKenneyNatureTerrainAdapter().ensureTerrainTemplate(assetId, kenneyPresentation);
        const port = createKenneyTerrainSceneTile(assetId, x, y, {
            presentation: kenneyPresentation,
            baseLocalY,
            editorStackId: id,
            rotationY: rotationY ?? 0,
        });
        attachSceneTilePort(port);
        port.root.traverse((child) => {
            child.frustumCulled = false;
        });

        if (mountMode === 'verticalFace' && faceDirection) {
            port.root.rotation.set(0, 0, 0);
            applyKenneyVerticalEdgeMountToObject(
                port.root,
                faceDirection,
                assetId,
                x,
                y,
                baseLocalY,
                WORLD_PLATFORM_Y
            );
        }

        return port.root;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {object | null | undefined} pickedObject
     * @param {string} childToolId
     * @returns {number | null}
     */
    function resolveEditorPlacementAnchorLocalY(x, y, pickedObject, childToolId) {
        const terrainId = currentCity?.tiles?.[x]?.[y]?.terrainId ?? 'grass';
        const target = resolveEditorPlacementTarget(
            pickedObject,
            x,
            y,
            terrainId,
            getEditorStackObjects()
        );
        const placement = resolveEditorStackPlacement(target, childToolId, getEditorStackObjects());
        return placement.ok ? placement.baseLocalY : null;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {object | null | undefined} pickedObject
     * @param {string} childToolId
     * @param {number} [rotationStep=0]
     */
    function resolveEditorGhostPlacementPreview(x, y, pickedObject, childToolId, rotationStep = 0) {
        const terrainId = currentCity?.tiles?.[x]?.[y]?.terrainId ?? 'grass';
        const citySize = currentCity?.size ?? 0;
        return computeEditorGhostPlacementPreview(
            pickedObject,
            x,
            y,
            terrainId,
            childToolId,
            getEditorStackObjects(),
            rotationStep,
            citySize,
            (tx, ty) => currentCity?.tiles?.[tx]?.[ty]?.terrainId ?? 'grass'
        );
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {string} assetId
     * @param {number} [rotationY=0]
     * @param {object | null | undefined} [pickedObject]
     * @param {{ mountMode?: import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorAssetMountMode, faceDirection?: import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorVerticalFaceDirection }} [mountOptions]
     * @returns {Promise<boolean>}
     */
    async function placeEditorStackObject(x, y, assetId, rotationY = 0, pickedObject = null, mountOptions = {}) {
        const terrainId = currentCity?.tiles?.[x]?.[y]?.terrainId ?? 'grass';
        const target = resolveEditorPlacementTarget(
            pickedObject,
            x,
            y,
            terrainId,
            getEditorStackObjects()
        );
        const placement = resolveEditorStackPlacement(
            target,
            assetId,
            getEditorStackObjects(),
            {
                ...mountOptions,
                citySize: currentCity?.size ?? 0,
                getTerrainIdAt: (tx, ty) => currentCity?.tiles?.[tx]?.[ty]?.terrainId ?? 'grass',
            }
        );
        if (!placement.ok) {
            return false;
        }

        const placedAssetId = placement.placedAssetId ?? assetId;
        const entry = addEditorStackObject(
            placedAssetId,
            placement.x,
            placement.y,
            rotationY,
            placement
        );
        const mesh = await createEditorStackMesh(entry);
        if (!mesh) {
            removeEditorStackObjectById(entry.id);
            return false;
        }

        editorStackMeshes.set(entry.id, mesh);
        addMeshToTileZone(mesh, placement.x, placement.y);
        scene.userData.requestShadowRefresh?.();
        return true;
    }

    /** @deprecated use placeEditorStackObject */
    async function placeEditorNatureProp(x, y, propId, rotationY = 0) {
        return placeEditorStackObject(x, y, propId, rotationY, null);
    }

    /**
     * Bulldoze tile base terrain to editor sea. Removes all stack pieces on the tile.
     * @param {object} city
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    function clearEditorTileBaseToSea(city, x, y) {
        const terrainId = city?.tiles?.[x]?.[y]?.terrainId;
        if (!terrainId || isEditorSeaTerrain(terrainId)) {
            return false;
        }

        const removedStacks = removeEditorStackObjectsAtTile(x, y);
        for (const obj of removedStacks) {
            const mesh = editorStackMeshes.get(obj.id);
            if (mesh) {
                removeInteractiveObject(mesh);
                editorStackMeshes.delete(obj.id);
            }
        }

        const oldMesh = terrain[x]?.[y];
        if (oldMesh) {
            removeInteractiveObject(oldMesh);
        }
        if (!terrain[x]) {
            terrain[x] = [];
        }
        terrain[x][y] = null;
        city.tiles[x][y].terrainId = EDITOR_SEA_TERRAIN_ID;
        scene.userData.requestShadowRefresh?.();
        return true;
    }

    /**
     * @param {string} stackId
     * @returns {boolean}
     */
    function removeEditorStackById(stackId) {
        const mesh = editorStackMeshes.get(stackId);
        if (mesh) {
            removeInteractiveObject(mesh);
            editorStackMeshes.delete(stackId);
            scene.userData.requestShadowRefresh?.();
        }
        const removed = removeEditorStackObjectById(stackId);
        return Boolean(removed || mesh);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    function removeEditorNaturePropAt(x, y) {
        const top = removeTopEditorStackObjectAt(x, y);
        if (!top) return false;
        return removeEditorStackById(top.id);
    }

    /**
     * Hydrate editor stack meshes from the in-memory layout (after initialize).
     */
    async function syncEditorStackFromLayout() {
        if (!editorStackHydrationEnabled) return;
        for (const obj of getEditorStackObjects()) {
            if (editorStackMeshes.has(obj.id)) continue;
            const mesh = await createEditorStackMesh(obj);
            if (!mesh) continue;
            editorStackMeshes.set(obj.id, mesh);
            addMeshToTileZone(mesh, obj.x, obj.y);
        }
        scene.userData.requestShadowRefresh?.();
    }

    /** @deprecated */
    async function syncEditorNaturePropsFromLayout() {
        return syncEditorStackFromLayout();
    }

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
    function pickInteractiveTile(raycaster) {
        return pickTileFromRaycast(raycaster, getInteractiveObjects())
            ?? (isEditorMode() && currentCity
                ? pickEditorTileOnGroundPlane(raycaster, currentCity.size)
                : null);
    }

    function updateFocusedObject() {
        const inputMouse = (getSessionService('inputManager')?.mouse ?? null);
        if (!inputMouse) {
            return;
        }

        const { x: clientX, y: clientY } = inputMouse;
        mouse.x = (clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(clientY / renderer.domElement.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera.camera);
        
        const newFocusedObject = pickInteractiveTile(raycaster);
        
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
        
        // Legacy border-bounce citizen spawn/update (CitizenManager.updateCitizens /
        // updateAllCitizens) retired — superseded by walkerSpawnController below.

        if (walkerSpawnController && !gameUI.isPaused) {
            walkerSpawnController.update(deltaTime);
        }

        updateFocusedObject(); // Update focused object every frame
        if (typeof onPlacementHoverHandler === 'function') {
            onPlacementHoverHandler(focusedObject ?? null);
        }
        // OPTIMIZATION: Update frustum culling for zone groups (throttled)
        if (performanceManager) {
            performanceManager.updateFrustumCulling(usesEditorLikePresentation());
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

    // Neighbor hamlet outskirts → DecorativeVillageManager.syncUnlockedNeighborHamlets()
    
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
            objectToSelect = pickInteractiveTile(raycaster);
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
        if (isMobileBuildBarOpen()) {
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
        resetCameraDragState();
        return;
    }
    if (isMobileBuildBarOpen()) {
        resetCameraDragState();
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
    focusedObject = pickInteractiveTile(raycaster);
    hoveredObjectName = focusedObject?.name || '';

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


function prefersPlacementTouchDrag() {
    return typeof this.preferPlacementTouchDrag === 'function'
        && this.preferPlacementTouchDrag();
}

function raycastTouchClient(clientX, clientY) {
    mouse.x = (clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera.camera);
    return pickInteractiveTile(raycaster);
}

function emitPlacementHoverFromTouch(object) {
    focusedObject = object;
    hoveredObjectName = object?.name || '';
    if (typeof this.onPlacementHover === 'function') {
        this.onPlacementHover(focusedObject);
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
    if (isMobileBuildBarOpen()) {
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
        touchStartObject = raycastTouchClient(touch.clientX, touch.clientY);

        // Placement tool: show green/red ghost immediately under the finger.
        if (prefersPlacementTouchDrag.call(this)) {
            emitPlacementHoverFromTouch.call(this, touchStartObject);
        }
        
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
    if (isMobileBuildBarOpen()) {
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

        // Build tool active: 1-finger drag drives placement ghost (not camera).
        // Pan / zoom remains available with 2 fingers.
        if (prefersPlacementTouchDrag.call(this)) {
            event.preventDefault();
            if (distance > TAP_THRESHOLD) {
                touchHasMoved = true;
            }
            const object = raycastTouchClient(touch.clientX, touch.clientY);
            emitPlacementHoverFromTouch.call(this, object);
            return;
        }
        
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

    const placementDrag = prefersPlacementTouchDrag.call(this);
    
    // Tap (no pan) — or placement drag release: place / anchor at finger tile.
    if (
        event.changedTouches
        && event.changedTouches.length > 0
        && (placementDrag || !touchHasMoved)
    ) {
        const touch = event.changedTouches[0];
        const objectToSelect = raycastTouchClient(touch.clientX, touch.clientY)
            || (placementDrag ? focusedObject : null);
        
        if (objectToSelect) {
            updateSelectedObject.call(this, objectToSelect);
            event.preventDefault();
            // Touch has no mouseup paint trail — close Cesar road-paint session after each gesture.
            if (placementDrag && typeof this.onRoadPaintEnd === 'function') {
                Promise.resolve(this.onRoadPaintEnd()).catch((error) => {
                    console.error('[scene.js] onRoadPaintEnd (touch) failed:', error);
                });
            }
        } else if (placementDrag) {
            emitPlacementHoverFromTouch.call(this, null);
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
        if (
            event.key === 'Escape'
            && typeof this.shouldEscapeToSelectMode === 'function'
            && this.shouldEscapeToSelectMode()
            && typeof this.onEnterSelectMode === 'function'
        ) {
            this.onEnterSelectMode();
            event.preventDefault?.();
            return;
        }

        if (isGameWorldInputLocked()) {
            return;
        }
        // Build behavior: R rotates the ghost (or is reserved); camera R runs only in select behavior
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

        // Placeable tool: arrows nudge the ghost; Enter confirms placement (keyboard autonomy).
        if (typeof this.onPlacementKeyboard === 'function') {
            const handled = this.onPlacementKeyboard(event);
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
        // Always clear zoom/pan key flags so a modal open mid-hold cannot stick the camera.
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
        if (isMobileBuildBarOpen()) {
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
        replaceTerrainAt,
        placeEditorStackObject,
        placeEditorNatureProp,
        removeEditorNaturePropAt,
        removeEditorStackById,
        clearEditorTileBaseToSea,
        resolveEditorPlacementAnchorLocalY,
        resolveEditorGhostPlacementPreview,
        syncNeighborHamletDeco,
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
        /**
         * Keyboard placement while a build tool is active (arrows nudge, Enter places).
         * @type {((event: KeyboardEvent) => boolean) | undefined}
         */
        onPlacementKeyboard: undefined,
        /** @type {((focused: object | null) => void) | undefined} */
        get onPlacementHover() {
            return onPlacementHoverHandler;
        },
        set onPlacementHover(handler) {
            onPlacementHoverHandler = handler;
        },
        /**
         * When true, single-finger drag updates the placement ghost instead of panning.
         * @type {(() => boolean) | undefined}
         */
        preferPlacementTouchDrag: undefined,
        /**
         * Switch to select behavior (toolbar + activeToolId). Orthogonal to map mode (editor / solo).
         * @type {(() => void) | undefined}
         */
        onEnterSelectMode: undefined,
        /**
         * When true, Escape should switch back to select behavior (from build or erase).
         * @type {(() => boolean) | undefined}
         */
        shouldEscapeToSelectMode: undefined,
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