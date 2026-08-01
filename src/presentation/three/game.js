import { assetsPrices } from '../../shared/building-catalog/index.js';
import { getDefaultEmployees, getAllSectorPriorities } from '../../js/acl/employment.js';
import { TimeManager } from '../../shared/time/TimeManager.js';
import { getTimeInfo, registerAppService, getMultiplayerManager, invokeStartTutorial } from '../../js/acl/appRuntime.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import {getAssetPrice, isAreaAvailableForBuilding} from '../../js/utils/utils.js';
import { createBuildingInstanceId, getOrCreateParcelsContext } from '../../js/acl/parcels.js';
import { getOrCreateSupplyContext, toSupplySeason, toSupplyMonth, getDefaultFoodDistributionDistance } from '../../js/acl/supply.js';
import { getOrCreateHousingContext } from '../../js/acl/housing.js';
import { syncEmploymentAfterBuildingChange, getOrCreateEmploymentContext, ensureSectorPrioritiesInitialized } from '../../js/acl/employment.js';
import { getOrCreateCommerceContext } from '../../js/acl/commerce.js';
import { getOrCreateGameplayContext } from '../../js/acl/gameplay.js';
import { placeBuildingWithPayment, reclaimStaleBuildingRecordsForPlacement } from '../../js/acl/construction.js';
import { createGameRuntime } from '../../composition/createGameRuntime.js';
import { registerGetTimeInfo } from '../../composition/gameTimeBridge.js';
import { registerCoreRuntimeServices } from '../../composition/registerCoreRuntimeServices.js';
import { DEFAULT_CITY_SIZE, DEFAULT_TICK_MS } from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
    displayTime,
    overOverlay,
    overOverlayMessage,
    infoObjectOverlay,
    infoObjectCloseBtn,
    infoPanelClock,
    infoPanelClockIcon,
    infoPanelNoClockIcon,
    displaySpeed
} from '../../ui/shell/nodes.js';
import {
  forceReinitializeTreasury,
  getTreasurySnapshot,
  updateTreasuryTurn,
  setBudgetReadyPromise,
  awaitBudgetReady,
  readInitialFundsFromImportMeta,
} from '../../js/acl/accountingGame.js';
import loaderManager from '../../js/utils/LoaderManager.js';
import objectivesTracker from '../../ui/onboarding/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI from '../../ui/shell/GameUI.js';
import {
  showInsufficientFundsNotification,
  showGenericErrorNotification,
} from '../../ui/shell/BuildingNotifications.js';
import { presentBuildingInfoSelection } from '../../ui/info/BuildingInfoPanel.js';
import webglDetector from '../../js/utils/WebGLResourceDetector.js';
import { clearCommercePersistence } from '../../js/acl/commerce.js';

// Initialiser le cache de TimeManager au démarrage
TimeManager.initializeCache().catch(err => {
    console.warn('[game.js] Could not initialize TimeManager cache:', err);
});

registerCoreRuntimeServices();
registerGetTimeInfo((turn) => TimeManager.getTimeInfo(turn));

export function createGame(gameStore, assetManager, citySize = null) {
    let activeToolId = '';
    let time = 0;
    let isPause;
    let isOver;
    let infos = {};
    /** @type {GameLoop | null} */
    let gameLoop = null;
    /** @type {ReturnType<typeof createGame> extends infer T ? T : never} */
    let game;

    function getTickIntervalMs() {
        return Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed'), 10) || 4000));
    }
    // Track pending building placements to prevent race conditions from rapid clicks
    const pendingPlacements = new Set();
    // Set initial speed within limits (500ms - 20,000ms)
    localStorage.setItem("speed", String(DEFAULT_TICK_MS));
    
    registerAppService('gameUI', gameUI);
    
    gameUI.updateTimeDisplay(time);
    
    // Initialize budget system - use initial funds from config (can be set via .env)
    const initialFunds = readInitialFundsFromImportMeta();

    setBudgetReadyPromise(
        forceReinitializeTreasury(initialFunds).then(async () => {
            const initialBudget = await getTreasurySnapshot();

            console.log('[game.js] Budget initialized, current budget:', initialBudget);

            gameUI.updateFunds(initialBudget.funds ?? initialFunds);

            return initialBudget;
        })
    );


    /* Scene + ECS runtime */
    const parcels = getOrCreateParcelsContext();
    const supply = getOrCreateSupplyContext();
    const housing = getOrCreateHousingContext();
    const employment = getOrCreateEmploymentContext();
    ensureSectorPrioritiesInitialized();
    const commerce = getOrCreateCommerceContext();
    const gameplay = getOrCreateGameplayContext();
    const runtime = createGameRuntime({
        parcels,
        supply,
        housing,
        employment,
        commerce,
        gameplay,
        getTimeInfo: (turn) => TimeManager.getTimeInfo(turn),
        toSupplySeason,
        toSupplyMonth,
        getSectorPriorities: getAllSectorPriorities,
        foodDistributionDistance: getDefaultFoodDistributionDistance(),
    });
    const scene = createScene(gameStore, assetManager, parcels, supply, housing);

    /* City initialization */
    // Detect WebGL capabilities first
    const webglCapabilities = webglDetector.detectCapabilities();
    const maxSafeCitySize = webglDetector.getMaxSafeCitySize();
    
    // Get city size from parameter, localStorage, config, or default to 16
    // Clamp to valid range (12-24) to prevent WebGL shader/material errors
    let selectedCitySize = citySize ||
                          parseInt(localStorage.getItem('selectedCitySize'), 10) ||
                          DEFAULT_CITY_SIZE ||
                          16;
    
    // Enforce maximum size of 18 to prevent WebGL shader compilation errors
    // Larger sizes cause BackgroundMaterial shader validation failures
    // In test mode, allow larger sizes to test detection
    const testMode = localStorage.getItem('webgl-test-mode');
    const absoluteMaxSize = testMode ? 24 : 18; // Allow up to 24x24 in test mode, 18x18 otherwise
    selectedCitySize = Math.max(12, Math.min(absoluteMaxSize, selectedCitySize));
    
    // City size adjustment is only done during initial selection in the modal
    // No automatic adjustment here - use the size as selected by the user
    
    const city = createCity(selectedCitySize);

    scene.initialize(city).then(() => {
        // Hide Chronos loader modal once scene is initialized with fade-out
        loaderManager.hide(500);
        
        // Ouvrir automatiquement le tutoriel au démarrage du jeu (premier mois)
        // Petit délai pour s'assurer que tout est bien initialisé après le chargement
        setTimeout(() => {
            invokeStartTutorial();
        }, 800); // Délai après le masquage du loader pour une meilleure UX
    });

    /** Employment bar + no-work icons — sole presentation entry (Employment BC read model). */
    async function refreshEmploymentPresentationForCity() {
        await scene.refreshEmploymentPresentation(city);
    }

    /** ECS simulation + scene.update (budget once per tick when not skipped). */
    async function runSimulationPass(time, options = {}) {
        if (isPause || isOver) {
            return;
        }

        try {
            await runtime.runSimulation({ city, time });
        } catch (err) {
            console.error('[game.js] ECS simulation error:', {
                error: err?.message || err,
                time,
            });
        }

        if (isPause || isOver) {
            return;
        }

        await scene.update(city, time, options);
    }

    /** scene.update + employment refresh — player interactions without full simulation tick. */
    async function runScenePresentationPass(time) {
        await scene.update(city, time, { skipBudget: true });
        await refreshEmploymentPresentationForCity();
    }

    // handler function to extract coordinate of an object I click on (data from asset js and using scene js methods)
    scene.onObjectSelected = async (selectedObject) => {
        selectedObject.info = '';
        selectedObject.name = activeToolId !== 'select-object'? activeToolId : selectedObject.name;
        // Object selected


        // Defensive guards: userData/x/y must exist and be in bounds
        if (!selectedObject || !selectedObject.userData) {
            console.warn('[game.onObjectSelected] Missing userData on selected object');
            return;
        }
        let { x, y } = selectedObject.userData;
        if (typeof x !== 'number' || typeof y !== 'number') {
            console.warn('[game.onObjectSelected] Invalid coordinates on selected object', { x, y });
            return;
        }
        if (!city || typeof city.size !== 'number' || x < 0 || y < 0 || x >= city.size || y >= city.size) {
            console.warn('[game.onObjectSelected] Coordinates out of bounds', { x, y, size: city?.size });
            return;
        }
        // location of the tile in the data model
        const tile = (city.tiles && city.tiles[x]) ? city.tiles[x][y] : undefined;
        if (!tile) {
            console.warn('[game.onObjectSelected] Missing tile at coordinates', { x, y });
            return;
        }
        // Object placed on terrain
        if(activeToolId === 'bulldoze') {
            // Debug: Log what we're trying to remove
            console.log('[game.js] Bulldoze click:', {
                selectedObjectName: selectedObject.name,
                selectedObjectUserData: selectedObject.userData,
                tileBuildingId: tile.buildingId,
                x, y
            });
            
            // Find the building at this location and its size
            const buildingId = tile.buildingId;
            const removedInstanceId =
                tile.instanceId
                ?? selectedObject.userData?.instanceId
                ?? null;
            const buildingInfo = buildingId ? assetsPrices[buildingId] : null;
            const gridSize = buildingInfo?.gridSize || 1;
            
            // Debug: Log building info
            console.log('[game.js] Building to remove:', {
                buildingId,
                buildingInfo,
                gridSize,
                removedInstanceId,
            });
            
            // Remove building from all tiles it occupies (SoT before scene.update)
            for (let dx = 0; dx < gridSize; dx++) {
                for (let dy = 0; dy < gridSize; dy++) {
                    const tileX = x + dx;
                    const tileY = y + dy;
                    // Check bounds before accessing tiles (important for edge cases)
                    if (tileX >= 0 && tileX < city.size && tileY >= 0 && tileY < city.size) {
                        if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                            city.tiles[tileX][tileY].buildingId = undefined;
                            city.tiles[tileX][tileY].instanceId = undefined;
                        }
                    }
                }
            }

            // Delete Dexie row immediately so an in-flight scene.update cannot resurrect the mesh
            if (removedInstanceId) {
                try {
                    await parcels.syncRemovedBuilding({ instanceId: removedInstanceId });
                } catch (err) {
                    console.warn('[game.js] Bulldoze Dexie remove failed:', removedInstanceId, err);
                }
            }

            await scene.update(city, time, { skipBudget: true });
            await syncEmploymentAfterBuildingChange(scene, city, buildingId);
        } else if(activeToolId === "select-object") {
            await presentBuildingInfoSelection(selectedObject, {
                city,
                parcels,
                supply,
                housing,
                scene,
                game,
                time,
                runScenePresentationPass,
            });
        } else if(!tile.buildingId || (activeToolId && (activeToolId === 'roads' || activeToolId === 'Road' || activeToolId.startsWith('StonePath-')) && (tile.buildingId === 'roads' || tile.buildingId === 'Road' || (tile.buildingId && tile.buildingId.startsWith('StonePath-'))))) {
            // PLACING A BUILDING - Ensure game is NOT paused
            // Allow placement if tile is empty OR if placing a road on an existing road (replacement)
            // Close info overlay if it's open from a previous selection
            if (infoObjectOverlay.classList.contains('active')) {
                infoObjectOverlay.classList.remove('active');
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                // Ensure game is playing (not paused)
                if (game && typeof game.play === 'function') {
                    game.play();
                }
            }
            
            // Check if building requires multiple tiles
            const buildingInfo = assetsPrices[activeToolId];
            const gridSize = buildingInfo?.gridSize || 1;
            
            // Check if area is available for this building
            const { x, y } = selectedObject.userData;
            // Special rule: roads can be placed on empty or existing road tiles without multi-tile checks
            const isRoadTool = activeToolId === 'roads' || activeToolId === 'Road' || (activeToolId && activeToolId.startsWith('StonePath-'));
            const targetTile = city.tiles?.[x]?.[y];
            const isTargetRoad = targetTile?.buildingId === 'roads' || targetTile?.buildingId === 'Road' || (targetTile?.buildingId && targetTile.buildingId.startsWith('StonePath-'));
            const canPlaceRoad = isRoadTool && (!targetTile?.buildingId || isTargetRoad);
            if (!canPlaceRoad && !isAreaAvailableForBuilding(city, x, y, gridSize)) {
                showGenericErrorNotification(activeToolId, 'area_not_available');
                return;
            }
            
            // Prepare building data for payment validation
            let price = 0
            const placementKey = `${x}-${y}`;
            const instanceId = createBuildingInstanceId();
            
            if (pendingPlacements.has(placementKey)) {
                console.warn('[game.js] Building placement already in progress:', placementKey);
                return;
            }
            
            pendingPlacements.add(placementKey);
            
            setTimeout(() => {
                if (pendingPlacements.has(placementKey)) {
                    console.warn('[game.js] Clearing stuck pending placement for:', placementKey);
                    pendingPlacements.delete(placementKey);
                }
            }, 10000);
            
            try {
                await awaitBudgetReady();

                if (tile.buildingId) {
                    console.warn('[game.js] Tile already occupied in city grid:', placementKey);
                    showGenericErrorNotification(activeToolId, 'building_already_exists');
                    return;
                }

                const reclaimedIds = await reclaimStaleBuildingRecordsForPlacement({
                    city,
                    x,
                    y,
                    gridSize,
                });
                if (reclaimedIds.length > 0) {
                    console.info('[game.js] Reclaimed stale Dexie rows before placement:', reclaimedIds);
                }
            
                price = getAssetPrice(activeToolId, assetsPrices) || 0
                
                const [houseStocks, budgetData] = await Promise.all([
                    Promise.resolve({ food: 0, cabbage: 0, wheat: 0, carrot: 0 }),
                    getTreasurySnapshot().catch(() => ({ funds: 0 }))
                ]);

                const funds = budgetData.funds || 0;
                
                const dbHouseData = {
                    instanceId,
                    type: activeToolId,
                    category: 'construction',
                    neighbors: [],
                    pop: 0,
                    stocks : houseStocks ? houseStocks : {food: 0, cabbage : 0, wheat: 0, carrot: 0},
                    gameTurn: time,
                    time: 0,
                    isBuilding: true,
                    roads: 0,
                    stage : 0,
                    stageName: "",
                    price : price ? price : 0,
                    cityFunds: funds,
                    maintenance: 0,
                    worldTime: 0,
                    x : selectedObject.userData.x,
                    y : selectedObject.userData.y,
                    employees: getDefaultEmployees(activeToolId)
                }

                if (activeToolId && (activeToolId.startsWith('StonePath-') || activeToolId === 'roads' || activeToolId === 'Road')) {
                    console.log('[game.js] Placing road:', { activeToolId, instanceId, dbHouseData });
                }
                const paymentResult = await placeBuildingWithPayment(dbHouseData);
                
                if (activeToolId && (activeToolId.startsWith('StonePath-') || activeToolId === 'roads' || activeToolId === 'Road')) {
                    console.log('[game.js] Road payment result:', paymentResult);
                }
                
                if (!paymentResult.success && paymentResult.reason === 'duplicate') {
                    console.warn('[game.js] Building already exists, skipping placement:', placementKey);
                    showGenericErrorNotification(activeToolId, 'building_already_exists');
                    return;
                }
                
                if (paymentResult.success) {
                const placedInstanceId = paymentResult.instanceId ?? instanceId;
                for (let dx = 0; dx < gridSize; dx++) {
                    for (let dy = 0; dy < gridSize; dy++) {
                        const tileX = x + dx;
                        const tileY = y + dy;
                        if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                            city.tiles[tileX][tileY].buildingId = activeToolId;
                            city.tiles[tileX][tileY].instanceId = placedInstanceId;
                        }
                    }
                }
                
                // Meshes + neighbors, then ECS evolution, then employment refresh
                await scene.update(city, time, { skipBudget: true });
                await runSimulationPass(time, { skipBudget: true });
                await syncEmploymentAfterBuildingChange(scene, city, activeToolId);
                const multiplayerManager = getMultiplayerManager();
                if (multiplayerManager?.isMultiplayer) {
                    try {
                        await multiplayerManager.placeBuilding(activeToolId, x, y);
                    } catch (error) {
                        console.warn('[Multiplayer] Erreur envoi bâtiment:', error);
                        // On continue même si l'envoi échoue (placement local réussi)
                    }
                }
                
                // Resume the game after successful building placement
                if (game) {
                    game.play();
                }
                } else {
                    // Payment failed - show error message
                    // Show beautiful popup notification
                    if (paymentResult.reason === 'insufficient_funds') {
                        showInsufficientFundsNotification(activeToolId, price);
                } else {
                    showGenericErrorNotification(activeToolId, paymentResult.reason);
                }
                
                // Building is not placed visually, so no cleanup needed
                }
            } catch (placementError) {
                console.error('[game.js] Building placement failed:', placementError);
                // ConstraintError is usually a treasury/game-table race, not a tile collision
                showGenericErrorNotification(activeToolId, 'persistence_conflict');
            } finally {
                // Always clear pending placement, even if there was an error
                pendingPlacements.delete(placementKey);
            }
        }
    }

    //    on onMouse we bind the scene object itself to the handler function onObjectSelected to work with the scene object
    // these event listeners are added to the document object, not the scene object itself - they are call by HTML document so we need to bind the scene object 
    // to the handler function
    const canvasEl = scene.domElement || document.querySelector('canvas');
    if (canvasEl) {
        // Mouse events
        canvasEl.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
        canvasEl.addEventListener('mouseup', scene.onMouseUp.bind(scene), false);
        canvasEl.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
        canvasEl.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: false });
        // Touch events for mobile
        canvasEl.addEventListener('touchstart', scene.onTouchStart.bind(scene), { passive: false });
        canvasEl.addEventListener('touchmove', scene.onTouchMove.bind(scene), { passive: false });
        canvasEl.addEventListener('touchend', scene.onTouchEnd.bind(scene), { passive: false });
        // Keyboard events
        document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
        document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);
    } else {
        // Fallback to document if canvas not found
        document.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
        document.addEventListener('mouseup', scene.onMouseUp.bind(scene), false);
        document.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
        document.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: false });
        document.addEventListener('touchstart', scene.onTouchStart.bind(scene), { passive: false });
        document.addEventListener('touchmove', scene.onTouchMove.bind(scene), { passive: false });
        document.addEventListener('touchend', scene.onTouchEnd.bind(scene), { passive: false });
        document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
        document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);
    }

    infoObjectCloseBtn.addEventListener('click', () => {
        if(infoObjectOverlay.classList.contains('active')) {
            infoObjectOverlay.classList.remove('active')
            
            // Re-enable pointer events on 3D scene when info overlay closes
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
            }
            
            // Re-enable OrbitControls when modal closes
            if (scene.controls) {
                scene.controls.enabled = true;
            }
            // Swallow first interactions just after closing modal
            if (scene.suppressInput) {
                scene.suppressInput(200);
            }
            
            game.play()
        }
    })

    // Expose scene and city on game object so it can be accessed from other modules
    game = {
        scene: scene,
        city: city,
        runtime,

        async update(time) {
            if (isPause || isOver) {
                return;
            }

            gameUI.updateTimeDisplay(time);
            city.update();

            // Turn boundary first (balance, carry-forward, cumuls) — survives pause mid-tick
            await updateTreasuryTurn(time);
            if (isPause || isOver) {
                return;
            }

            await scene.update(city, time, { skipBudget: true });
            if (isPause || isOver) {
                return;
            }

            await runSimulationPass(time);
            if (isPause || isOver) {
                return;
            }

            await refreshEmploymentPresentationForCity();

            if (objectivesTracker.enabled) {
                await objectivesTracker.checkObjectives(time);
            }
        },

        refreshEmployment: refreshEmploymentPresentationForCity,
        runSimulationPass,
        runScenePresentationPass,

        pause() {
            isPause = true;
            gameUI.setPaused(true);
            // Pause citizen animation
            if (scene.pauseCitizen) {
                scene.pauseCitizen();
            }
        },

        async play() {
            // Game playing
            isPause = false;
            gameUI.setPaused(false);
            // Resume citizen animation
            if (scene.resumeCitizen) {
                scene.resumeCitizen();
            }
            // Appeler update(0) pour activer l'objectif au tour 0 au démarrage (seulement si activés)
            if (objectivesTracker.enabled) {
                await objectivesTracker.checkObjectives(0);
            }
        },

        replay() {
            isOver = false;
            overOverlay.classList.remove('active');
            
            // Clear localStorage before replay
            try {
                clearCommercePersistence();
                // Also clear other localStorage items that should be reset on replay
                localStorage.removeItem('journal_year_end_balances');
                localStorage.removeItem('citizen_tax_amount');
                localStorage.removeItem('work_salary_per_month');
                localStorage.removeItem('work_salary_tax_rate');
                localStorage.removeItem('show-performance-stats');
                localStorage.removeItem('hasSeenCleanupNotification');
                localStorage.removeItem('speed');
                localStorage.removeItem('selectedCitySize');
                localStorage.removeItem('multiplayer-enabled');
                localStorage.removeItem('multiplayer-pseudo');
                localStorage.removeItem('multiplayer-room-name');
                localStorage.removeItem('activeLoans');
                console.log('[Game] LocalStorage cleared for replay');
            } catch (error) {
                console.warn('[Game] Error clearing localStorage on replay:', error);
            }
            
            window.location.href = '/';
        },

        setInfo(key, info) {
            if(!infos.key) {
                infos.assign(...infos, {key: info})
            }
        },

        getInfo(key) {
            if(infos[key]) {
                return infos[key]
            }
        },

        get activeToolId() {
            return activeToolId;
        },

        setActiveToolId(toolId) {
            activeToolId = toolId;
            gameUI.activeToolId = toolId;
        },

        startInterval() {
            if (!gameLoop) {
                return;
            }
            gameLoop.setIntervalMs(getTickIntervalMs());
        },

        get time() {
            return time;
        },
    };

    gameLoop = new GameLoop({
        intervalMs: getTickIntervalMs(),
        onTick: async () => {
            if (isPause || isOver) {
                return;
            }
            time += 1;
            await game.update(time);
        },
    });
    gameLoop.start();

    scene.start();
    void refreshEmploymentPresentationForCity();

    // Initialize and attach InputManager non-invasively
    try {
        const target = document.getElementById('game-window');
        if (target) {
            const inputManager = new InputManager();
            inputManager.attach(target);
            registerAppService('inputManager', inputManager);
        }
    } catch (_) {}
    
    // Initialize mobile controls for touch devices (if camera is available)
    // Use dynamic import with .then() to avoid making createGame async
    if (scene && scene.camera) {
        import('../../ui/shell/mobile-controls.js')
            .then(({ initMobileControls }) => {
                initMobileControls(scene.camera);
            })
            .catch((error) => {
                console.warn('[Game] Failed to initialize mobile controls:', error);
            });
    }
    
    // Register game instance
    registerAppService('game', game);
    
    return game;
}