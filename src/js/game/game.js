import * as THREE from 'three';
import {  assetsPrices } from '../meshs/data.js';
import { getDefaultEmployees, getSectorPriority, getSectorName, getAllSectorPriorities } from './modules/EmployeeHelper.js';
import { TimeManager } from './utils/TimeManager.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import {getAssetPrice, makeInfoBuildingText, makeInfoKeyValue, makeInfoSection, isAreaAvailableForBuilding} from '../utils/utils.js';
import { toBuildingIdString, createBuildingInstanceId, getOrCreateParcelsContext } from '../acl/parcels.js';
import { getOrCreateSupplyContext, toSupplySeason, toSupplyMonth } from '../acl/supply.js';
import { getOrCreateHousingContext } from '../acl/housing.js';
import { syncEmploymentAfterBuildingChange, getOrCreateEmploymentContext } from '../acl/employment.js';
import { findBuildingAtTile, placeBuildingWithPayment, getBuildingById, getBuildingField } from '../acl/construction.js';
import { createGameRuntime } from '../../composition/createGameRuntime.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import config from './config.js';
import {
    displayTime,
    overOverlay,
    overOverlayMessage,
    infoObjectOverlay,
    infoObjectCloseBtn,
    buildingsObjects,
    infoPanelClock,
    infoPanelClockIcon,
    infoPanelNoClockIcon,
    displaySpeed
} from '../ui/nodes.js';
import budgetManager from '../stores/BudgetManager.js';
import journalManager from '../stores/JournalManager.js';
import FoodTraceabilityService from '../stores/FoodTraceabilityService.js';
import loaderManager from '../utils/LoaderManager.js';
import objectivesTracker from '../ui/ObjectivesTracker.js';

/**
 * Info panel: workplace staffing section (workers in aggregates; elites display-only).
 */
function renderWorkplaceEmployeesInfo(buildingData, messages) {
    if (!buildingData?.employees) return;

    const roadCount = buildingData.roads ?? 0;
    const buildingType = buildingData.type || '';
    const farmExemptFromRoad = buildingType.includes('Farm') || buildingType.includes('farm');
    const employees = buildingData.employees;
    const workerNeed = employees.worker_need || 0;
    const eliteNeed = employees.elite_need || 0;
    const workers = employees.worker || 0;
    const elites = employees.elite || 0;
    const sector = employees.sector || 0;
    const priority = getSectorPriority(sector);

    makeInfoSection('Employés');

    if (roadCount <= 0 && !farmExemptFromRoad) {
        makeInfoBuildingText('🚧 Route nécessaire pour embaucher', false, 'warning-message');
        return;
    }

    const hasEnoughWorkers = workers >= workerNeed;
    const hasNoWorkers = workers === 0 && workerNeed > 0;
    const hasPartialWorkers = workers > 0 && workers < workerNeed;

    makeInfoKeyValue('Secteur', `${sector} : ${getSectorName(sector)}`);
    makeInfoKeyValue('Priorité', `${priority}`);
    makeInfoKeyValue('Ouvriers', `${workers}/${workerNeed}`);
    makeInfoKeyValue('Élites', `${elites}/${eliteNeed}`);

    if (hasEnoughWorkers) {
        makeInfoBuildingText(messages.fullyStaffed, false, 'success-message');
    } else if (hasNoWorkers) {
        makeInfoBuildingText(messages.noWorkers, false, 'error-message');
    } else if (hasPartialWorkers) {
        makeInfoBuildingText(messages.partialWorkers, false, 'warning-message');
    }
}
import InputManager from './InputManager.js';
import gameUI from './GameUI.js';
import appRegistry from './AppRegistry.js';
import webglDetector from '../utils/WebGLResourceDetector.js';
import commerceStore from '../stores/CommerceStore.js';

// Initialiser le cache de TimeManager au démarrage
TimeManager.initializeCache().catch(err => {
    console.warn('[game.js] Could not initialize TimeManager cache:', err);
});

// Services (city-wide simulation systems) - optional, non-invasive
let services = [];
// Load services asynchronously (non-blocking)
(async () => {
    try {
        // Load city-wide simulation services (food chain → ECS supply.monthlyFood)
        const { RandomEventsService } = await import('./services/RandomEventsService.js');
        const { EmploymentPriorityService } = await import('./services/EmploymentPriorityService.js');
        const { CommerceService } = await import('./services/CommerceService.js');
        
        services.push(new RandomEventsService()); // Événements aléatoires (ouragan, inondation)
        services.push(new CommerceService()); // Gestion des imports/exports
        
        // Employment Priority Service - manages sector priorities in localStorage
        // Priority is stored in localStorage (not IndexedDB) for instant updates
        const employmentPriorityService = new EmploymentPriorityService();
        services.push(employmentPriorityService);
        
        console.log('[game.js] Employment services registered (priority from localStorage, sector from IndexedDB)');
        
        // Note: Initial simulation will run on first game.update() call
        // The service is now synchronized with the game loop
        
        // Make service available to work section manager
        if (window.workSectionManager) {
            window.workSectionManager.setPriorityService(employmentPriorityService);
        } else {
            // If work section manager isn't initialized yet, set it when it becomes available
            const checkWorkSection = setInterval(() => {
                if (window.workSectionManager) {
                    window.workSectionManager.setPriorityService(employmentPriorityService);
                    clearInterval(checkWorkSection);
                }
            }, 100);
            // Stop checking after 5 seconds
            setTimeout(() => clearInterval(checkWorkSection), 5000);
        }
        
        console.log('[game.js] Services loaded successfully:', services.length, services.map(s => s.constructor.name));
    } catch (err) {
        console.warn('[game.js] Failed to load services (continuing without them):', {
            error: err?.message || err,
            note: 'Services are optional enhancements and game will function normally'
        });
    }
})();

// Translation object for building IDs to French names
const BUILDING_TRANSLATIONS = {
    // Zones
    'grass': 'Herbe',
    'roads': 'Route',
    'Road': 'Route',
    
    // Houses
    'House-Blue': 'Maison Bleue',
    'House-Red': 'Maison Rouge',
    'House-Purple': 'Maison Violette',
    
    // Palaces
    'House-2Story': 'Palais',
    
    // Tombs
    'Tombstone-1': 'Tombe',
    'Tombstone-2': 'Tombe',
    'Tombstone-3': 'Tombe',
    
    // Farms
    'Farm-Wheat': 'Ferme',
    'Farm-Carrot': 'Ferme',
    'Farm-Cabbage': 'Ferme',
    
    // Industry
    'Windmill-001': 'Moulin',
    'Barn-001': 'Grange',
    
    // Markets
    'Market-Stall': 'Marché',
    
    // Infrastructure
    'Well-001': 'Puits',
    'Fountain-001': 'Fontaine',
    'Streetlight-001': 'Réverbère',
    
    // Public Buildings
    'Church-002': 'Église'
};

// Helper function to translate building IDs to French names
function getBuildingDisplayName(buildingId) {
    if (!buildingId) return buildingId;
    
    // Direct lookup in translation object (most common case)
    if (BUILDING_TRANSLATIONS[buildingId]) {
        return BUILDING_TRANSLATIONS[buildingId];
    }
    
    // Fallback: try to match by checking if buildingId starts with a known key
    // This handles cases where the ID might have additional suffixes
    for (const [key, value] of Object.entries(BUILDING_TRANSLATIONS)) {
        // Check if buildingId starts with the key (handles variations like "House-2Story_Purple001")
        if (buildingId.startsWith(key)) {
            return value;
        }
    }
    
    // If no translation found, return the ID as-is
    return buildingId;
}

// Helper function to translate error reasons to French
function translateErrorReason(reason) {
    const translations = {
        'area_not_available': 'Espace non disponible',
        'insufficient_funds': 'Fonds insuffisants',
        'building_already_exists': 'Un bâtiment existe déjà à cet emplacement'
    };
    return translations[reason] || reason;
}

// Notification system for building placement feedback
function showInsufficientFundsNotification(buildingType, price) {
    const displayName = getBuildingDisplayName(buildingType);
    const notification = document.createElement('div');
    notification.className = 'building-notification insufficient-funds';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">💰</div>
            <div class="notification-text">
                <div class="notification-title">Fonds Insuffisants</div>
                <div class="notification-message">Impossible de construire ${displayName}. Coût : ${price}€</div>
            </div>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 350px;
        animation: slideDown 0.3s ease-out;
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        @keyframes slideUp {
            from {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            to {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
        .building-notification .notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .building-notification .notification-icon {
            font-size: 20px;
            flex-shrink: 0;
        }
        .building-notification .notification-text {
            flex: 1;
        }
        .building-notification .notification-title {
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 4px;
        }
        .building-notification .notification-message {
            font-size: 13px;
            opacity: 0.9;
        }
    `;
    
    if (!document.querySelector('#building-notification-styles')) {
        style.id = 'building-notification-styles';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function showGenericErrorNotification(buildingType, reason) {
    const displayName = getBuildingDisplayName(buildingType);
    const translatedReason = translateErrorReason(reason);
    const notification = document.createElement('div');
    notification.className = 'building-notification generic-error';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">⚠️</div>
            <div class="notification-text">
                <div class="notification-title">Erreur de Construction</div>
                <div class="notification-message">Impossible de construire ${displayName}. ${translatedReason}</div>
            </div>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ffa726 0%, #ff9800 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(255, 167, 38, 0.3);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 350px;
        animation: slideDown 0.3s ease-out;
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

/**
 * Show WebGL resource limitation warning
 * @param {Object} capabilities - WebGL capabilities object
 * @param {number} requestedSize - City size that was requested
 * @param {number} maxSafeSize - Maximum safe city size for this system
 */
function showWebGLResourceWarning(capabilities, requestedSize, maxSafeSize) {
    // Check if user has already dismissed this warning
    const warningKey = `webgl-warning-dismissed-${maxSafeSize}`;
    if (localStorage.getItem(warningKey) === 'true') {
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'building-notification webgl-resource-warning';
    
    // Message simplifié
    let simpleMessage = '';
    if (requestedSize > maxSafeSize) {
        simpleMessage = `Taille réduite à ${maxSafeSize}×${maxSafeSize} (limite système)`;
    } else {
        simpleMessage = `Taille maximale recommandée: ${maxSafeSize}×${maxSafeSize}`;
    }

    notification.innerHTML = `
        <div class="notification-content" style="display: flex; align-items: flex-start; gap: 12px; position: relative; padding-right: 30px;">
            <div class="notification-icon" style="font-size: 24px; flex-shrink: 0; margin-top: 2px;">⚠️</div>
            <div class="notification-text" style="flex: 1;">
                <div class="notification-message" style="color: #000; font-size: 14px; line-height: 1.4;">${simpleMessage}</div>
            </div>
            <button class="notification-close" style="
                position: absolute;
                top: 4px;
                right: 4px;
                background: none;
                border: none;
                color: #666;
                font-size: 22px;
                line-height: 1;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
                transition: opacity 0.2s;
            " 
            onmouseover="this.style.opacity='1'" 
            onmouseout="this.style.opacity='0.6'"
            onclick="this.closest('.webgl-resource-warning').remove(); localStorage.setItem('${warningKey}', 'true');">×</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ffffff;
        color: #000000;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        max-width: 400px;
        animation: slideDown 0.3s ease-out;
        border: 2px solid #ff9800;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 6000);
}

export function createGame(gameStore, assetManager, citySize = null) {
    let activeToolId = '';
    let time = 0;
    let isPause;
    let isOver;
    let infos = {};
    /** @type {GameLoop | null} */
    let gameLoop = null;

    function getTickIntervalMs() {
        return Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed'), 10) || 4000));
    }
    // Track pending building placements to prevent race conditions from rapid clicks
    const pendingPlacements = new Set();
    // Set initial speed within limits (500ms - 20,000ms)
    localStorage.setItem("speed", "4000");
    
    // Register with AppRegistry (centralized namespace)
    appRegistry.register('gameUI', gameUI);
    appRegistry.register('budgetManager', budgetManager);
    appRegistry.register('journalManager', journalManager);
    
    // Initialize FoodTraceabilityService
    const foodTraceabilityService = new FoodTraceabilityService();
    appRegistry.register('foodTraceabilityService', foodTraceabilityService);
    window.foodTraceabilityService = foodTraceabilityService; // Make globally available
    
    gameUI.updateTimeDisplay(time);
    
    // Initialize budget system - use initial funds from config (can be set via .env)
    const initialFunds = config?.budget?.initialFunds || 200;
    
    console.log('[game.js] Initializing budget with:', {
        initialFunds,
        configValue: config?.budget?.initialFunds,
        envValue: import.meta.env.VITE_INITIAL_FUNDS,
        configObject: config
    });
    
    budgetManager.forceReinitialize(initialFunds).then(async () => {
        // BudgetManager registered above - available via window.app.budgetManager or window.budgetManager
        // Update funds display in navigation bar immediately after initialization
        const initialBudget = await budgetManager.getCurrentBudget();
        
        console.log('[game.js] Budget initialized, current budget:', initialBudget);
        
        if (window.gameUI) {
            window.gameUI.updateFunds(initialBudget.funds || initialFunds);
        } else {
            const displayFunds = document.querySelector('.display-funds');
            if (displayFunds) {
                displayFunds.textContent = (initialBudget.funds || initialFunds).toString();
            }
        }
    });


    /* Scene + ECS runtime */
    const parcels = getOrCreateParcelsContext();
    const supply = getOrCreateSupplyContext();
    const housing = getOrCreateHousingContext();
    const employment = getOrCreateEmploymentContext();
    const runtime = createGameRuntime({
        parcels,
        supply,
        housing,
        employment,
        timeManager: TimeManager,
        toSupplySeason,
        toSupplyMonth,
        getSectorPriorities: getAllSectorPriorities,
        foodDistributionDistance: config?.simulation?.foodDistributionDistance || 5,
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
                          config?.simulation?.citySize || 
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
            if (window.startTutorial && typeof window.startTutorial === 'function') {
                window.startTutorial();
            } else if (window.tutorialManager && typeof window.tutorialManager.showTutorial === 'function') {
                window.tutorialManager.showTutorial();
            }
        }, 800); // Délai après le masquage du loader pour une meilleure UX
    });

    /** Employment bar + no-work icons — sole presentation entry (Employment BC read model). */
    async function refreshEmploymentPresentationForCity() {
        await scene.refreshEmploymentPresentation(city);
    }

    /** ECS + services + second scene.update (budget once per tick when not skipped). */
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

        if (services.length > 0) {
            try {
                await Promise.allSettled(
                    services.map((service) => service.simulate(city, time))
                );
            } catch (err) {
                console.error('[game.js] Service simulation error:', {
                    error: err?.message || err,
                    time,
                });
            }
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
            const buildingInfo = buildingId ? assetsPrices[buildingId] : null;
            const gridSize = buildingInfo?.gridSize || 1;
            
            // Debug: Log building info
            console.log('[game.js] Building to remove:', {
                buildingId,
                buildingInfo,
                gridSize
            });
            
            // Remove building from all tiles it occupies
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
            await scene.update(city, time, { skipBudget: true });
            await syncEmploymentAfterBuildingChange(scene, city, buildingId);
        } else if(activeToolId === "select-object") {
            // Object selection - ONLY open info modal when using select tool
            // Only open the info modal if we actually have info to show (i.e., on building objects)
            let shouldOpenInfo = false;

            // Reset content first
            makeInfoBuildingText("", true);

            if(buildingsObjects.includes(selectedObject.userData.id)) {
                shouldOpenInfo = true;
            }

            // Open/close modal strictly based on whether we have info
            if (shouldOpenInfo) {
                if (!infoObjectOverlay.classList.contains('active')) {
                    infoObjectOverlay.classList.add('active');
                }
                // Manage pointer events on 3D scene when info overlay is active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                if (scene.controls) {
                    scene.controls.enabled = false;
                }
            } else {
                // Do not open the modal at all for non-building objects (e.g., grass)
                // If it's already open from a previous selection, close it
                if (infoObjectOverlay.classList.contains('active')) {
                    infoObjectOverlay.classList.remove('active');
                    const canvas = document.querySelector('canvas');
                    if (canvas) {
                        canvas.classList.remove('pointer-events-disabled');
                    }
                }
            }


            if(buildingsObjects.includes(selectedObject.userData.id)) {
                const { x: selX, y: selY } = selectedObject.userData;
                const uniqueId =
                    selectedObject.userData.instanceId
                    ?? city.tiles?.[selX]?.[selY]?.instanceId
                    ?? (await findBuildingAtTile({ x: selX, y: selY }))?.instanceId
                    ?? null;
                
                const buildingRow = uniqueId ? await getBuildingById(uniqueId) : null;
                const buildingPop = buildingRow?.pop ?? 0;
                const roadAccess = await parcels.getRoadAccess(uniqueId);
                const neighbors = uniqueId ? await parcels.getNeighbors(uniqueId) : [];
                const supplyView = uniqueId
                    ? await supply.getBuildingSupplyView(uniqueId)
                    : null;
                // Food stocks for Supply buildings come from the BC query (not raw Dexie)
                let houseStocks = supplyView?.stocks ?? null;
                
                // Debug: Log retrieved data
                console.log('[game.js] Retrieved data from DB:', {
                    uniqueId,
                    pop: buildingPop,
                    roads: roadAccess.roadCount,
                    neighborsCount: neighbors.length,
                    hasStocks: !!houseStocks,
                    supplyKind: supplyView?.kind ?? null,
                });
                
                console.log('[game.js] Full house record:', {
                    uniqueId,
                    type: buildingRow?.type,
                    roads: buildingRow?.roads,
                    neighborsCount: buildingRow?.neighbors?.length || 0,
                    hasNeighbors: !!buildingRow?.neighbors
                });

                // Vérifier si c'est un item nature (tree ou boulder)
                const isNatureItem = buildingRow?.category === 'nature';
                
                if (isNatureItem) {
                    // Affichage pour les items nature
                    makeInfoSection('Ressource naturelle');
                    makeInfoKeyValue('Type', `${selectedObject.userData.id}`);
                    makeInfoKeyValue('Adresse', `x: ${selectedObject.userData.x} | y: ${selectedObject.userData.y}`);
                    
                    // Nature stocks are not Supply — read building row for wood/rock/etc.
                    houseStocks = buildingRow?.stocks ?? (await getBuildingField(uniqueId, 'stocks'));
                    const maxStocks = buildingRow?.maxStocks || {};
                    if (houseStocks && Object.keys(houseStocks).length > 0) {
                        makeInfoSection('Stocks disponibles');
                        
                        // Trees: afficher wood
                        if (selectedObject.userData.id.includes('Tree')) {
                            const wood = houseStocks.wood || 0;
                            const maxWood = maxStocks.wood || 0;
                            makeInfoKeyValue('Bois', `${wood} / ${maxWood}`);
                        }
                        
                        // Boulders: afficher rock, gold, iron
                        if (selectedObject.userData.id.includes('Boulder')) {
                            const rock = houseStocks.rock || 0;
                            const maxRock = maxStocks.rock || 0;
                            if (maxRock > 0) {
                                makeInfoKeyValue('Pierre', `${rock} / ${maxRock}`);
                            }
                            
                            const gold = houseStocks.gold || 0;
                            const maxGold = maxStocks.gold || 0;
                            if (maxGold > 0) {
                                makeInfoKeyValue('Or', `${gold} / ${maxGold}`);
                            }
                            
                            const iron = houseStocks.iron || 0;
                            const maxIron = maxStocks.iron || 0;
                            if (maxIron > 0) {
                                makeInfoKeyValue('Fer', `${iron} / ${maxIron}`);
                            }
                        }
                    }
                } else {
                    // Affichage normal pour les autres bâtiments
                    makeInfoSection('Bâtiment');
                    makeInfoKeyValue('Type', `${selectedObject.userData.id}`);
                    makeInfoKeyValue('Adresse', `x: ${selectedObject.userData.x} | y: ${selectedObject.userData.y}`);
                    makeInfoKeyValue(`Habitants`, buildingPop);
                    makeInfoKeyValue('Routes desservies', roadAccess.roadCount);
                }

                if(neighbors.length > 0) {
                    makeInfoSection('Voisins immédiats');
                    neighbors
                        .filter((neigh) => neigh.x != null && neigh.y != null)
                        .forEach((neighbor) => {
                            const label = neighbor.type || neighbor.instanceId;
                            makeInfoKeyValue(label, `x: ${neighbor.x} | y: ${neighbor.y}`);
                        });
                } else {
                    makeInfoKeyValue('Voisinage', 'Maison isolée');
                }

                if(supplyView?.kind === 'house' && Object.hasOwn(houseStocks || {}, 'food')) {
                    makeInfoSection('Stocks nourriture');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers`);
                    
                    // Evolution section - show conditions for next evolution step
                    const buildingType = selectedObject.userData.id;
                    const hasRoadAccess = roadAccess.hasAccess;
                    const { totalFood, meetsFoodGoal } = housing.evaluateHouseFoodAffluence({
                        stocks: houseStocks || {},
                        population: buildingPop || 0,
                    });
                    const evolutionPreview = housing.previewHouseEvolution({
                        stocks: houseStocks || {},
                        population: buildingPop || 0,
                        buildingType,
                        hasRoadAccess,
                    });
                    
                    makeInfoSection('Évolution');
                    
                    // House-Blue: Show conditions to become House-Red
                    if (buildingType === 'House-Blue') {
                        makeInfoKeyValue('→ Maison Rouge', '');
                        const isInhabited = (buildingPop || 0) > 0;
                        const roadStatus = hasRoadAccess ? '✅' : '❌';
                        const popStatus = isInhabited ? '✅' : '❌';
                        makeInfoKeyValue('  • Accès routier', `${roadStatus} ${hasRoadAccess ? 'Oui' : 'Non'}`);
                        makeInfoKeyValue('  • Habitée', `${popStatus} ${isInhabited ? 'Oui' : 'Non'}`);
                        makeInfoKeyValue('  • Nourriture de base', `${totalFood > 0 ? '✅' : '❌'} ${totalFood} panier${totalFood !== 1 ? 's' : ''}`);
                    }
                    
                    // House-Red: Show conditions to become House-Purple (only Purple-specific conditions)
                    else if (buildingType === 'House-Red') {
                        makeInfoKeyValue('→ Maison Violette', '');
                        const purpleCheck = evolutionPreview.toPurple;
                        // Show Purple-specific conditions
                        makeInfoKeyValue('  • Population > 5', `${(buildingPop || 0) > 5 ? '✅' : '❌'} ${buildingPop || 0}`);
                        const foodStatus = totalFood >= (buildingPop || 0) ? '✅' : '❌';
                        makeInfoKeyValue('  • Nourriture ≥ Population', `${foodStatus} ${totalFood}/${buildingPop || 0}`);
                        
                        if (!purpleCheck.canEvolve) {
                            if (purpleCheck.reason === 'hunger_present') {
                                const needed = Math.max(0, (buildingPop || 0) - totalFood);
                                makeInfoKeyValue('  • Manque', `${needed} panier${needed > 1 ? 's' : ''}`);
                            } else if (purpleCheck.reason === 'population_too_low') {
                                const needed = Math.max(0, 6 - (buildingPop || 0));
                                makeInfoKeyValue('  • Manque', `${needed} habitant${needed > 1 ? 's' : ''}`);
                            }
                        }
                    }
                    
                    // House-Purple: Show conditions to become Palace (only Palace-specific conditions)
                    else if (buildingType === 'House-Purple') {
                        makeInfoKeyValue('→ Palais', '');
                        const palaceCheck = evolutionPreview.toPalace;
                        
                        // Palace-specific conditions (food goal, not basic conditions)
                        const foodGoalStatus = meetsFoodGoal ? '✅' : '❌';
                        const foodGoalText = meetsFoodGoal 
                            ? `Oui (${totalFood} > ${(buildingPop || 0) * 2})`
                            : `Non (${totalFood} ≤ ${(buildingPop || 0) * 2})`;
                        
                        // Check food variety (at least 2 types of food)
                        const foodTypes = {
                            wheat: (houseStocks?.wheat || 0) > 0,
                            carrot: (houseStocks?.carrot || 0) > 0,
                            cabbage: (houseStocks?.cabbage || 0) > 0,
                        };
                        const availableFoodTypesCount = evolutionPreview.availableCropTypesCount;
                        const foodVarietyStatus = availableFoodTypesCount >= 2 ? '✅' : '❌';
                        const foodVarietyText = availableFoodTypesCount >= 2 
                            ? `Oui (${availableFoodTypesCount} types: ${Object.entries(foodTypes).filter(([_, available]) => available).map(([type]) => type).join(', ')})`
                            : `Non (${availableFoodTypesCount} type${availableFoodTypesCount !== 1 ? 's' : ''} disponible)`;
                        
                        makeInfoKeyValue('  • Population > 5', `${(buildingPop || 0) > 5 ? '✅' : '❌'} ${buildingPop || 0}`);
                        makeInfoKeyValue('  • Nourriture > Pop × 2', `${foodGoalStatus} ${foodGoalText}`);
                        makeInfoKeyValue('  • 2 types de nourriture', `${foodVarietyStatus} ${foodVarietyText}`);
                    }
                    
                    // Palace: No further evolution
                    else if (buildingType === 'House-2Story') {
                        makeInfoKeyValue('→ Palais', '✅ Niveau maximum atteint');
                    }
                }

                // Display market food stocks (similar to houses)
                if(supplyView?.kind === 'market' && Object.hasOwn(houseStocks || {}, 'food')) {
                    const maxStock = supplyView.maxStock || 500;
                    
                    makeInfoSection('Stock marché');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0}/${maxStock} paniers disponibles`);
                    
                    const noFarmsNearby = supplyView.noFarmsNearby === true;
                    const noHousesNearby = !supplyView.hasHousesNearby;
                    const isBuying = supplyView.isBuying === true;

                    const marketData = buildingRow;
                    const hasNoWorkersForState = (marketData?.roads ?? 0) > 0
                        && (marketData?.employees?.worker || 0) === 0
                        && (marketData?.employees?.worker_need || 0) > 0;
                    
                    const buyingPeriodName = 'Automne';
                    
                    makeInfoSection('État du marché');
                    if (hasNoWorkersForState) {
                        makeInfoKeyValue('État', '🔴 Inactif : pas d\'employés');
                    } else if (isBuying) {
                        makeInfoKeyValue('État', '🟢 Achats en cours : c\'est le mois des affaires !');
                    } else {
                        makeInfoKeyValue('État', `⏸️ En attente : le marché n'achète qu'en ${buyingPeriodName}`);
                    }
                    
                    makeInfoSection('Approvisionnement');
                    if (noFarmsNearby) {
                        makeInfoKeyValue('Fermes', '❌ Aucune ferme à proximité');
                    } else {
                        makeInfoKeyValue('Fermes', '✅ Fermes accessibles');
                    }
                    if (noHousesNearby) {
                        makeInfoKeyValue('Distribution', '❌ Aucune maison à portée');
                    } else {
                        makeInfoKeyValue('Distribution', '✅ Maisons à portée');
                    }
                    
                    renderWorkplaceEmployeesInfo(marketData, {
                        fullyStaffed: '✅ Le marché marche à plein régime',
                        noWorkers: '❌ Le marché manque de bras, il ne peut fonctionner',
                        partialWorkers: '⚠️ Le marché tente de vendre avec peine car trop peu d\'employés',
                    });
                }

                if(supplyView?.kind === 'farm') {
                    if (!houseStocks) {
                        houseStocks = { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    }
                    makeInfoSection('Stocks ferme');
                    if(selectedObject.userData.id.includes('Farm-Wheat')) {
                        makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Carrot')) {
                        makeInfoKeyValue('Carottes', `${houseStocks.carrot || 0} paniers`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Cabbage')) {
                        makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    }
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers`);
                    
                    const salesToMarket = supplyView.salesToMarket || [];
                    const salesToWindmill = supplyView.salesToWindmill || [];
                    
                    let currentYear = 0;
                    if (window.budgetManager) {
                        const budget = await window.budgetManager.getCurrentBudget();
                        if (budget && budget.turn !== undefined && window.TimeManager) {
                            const timeInfo = window.TimeManager.getTimeInfo(budget.turn);
                            currentYear = timeInfo ? timeInfo.year : 0;
                        }
                    }
                    
                    const currentYearMarketSales = salesToMarket.filter(sale => sale.year === currentYear);
                    const currentYearWindmillSales = salesToWindmill.filter(sale => sale.year === currentYear);
                    
                    if (currentYearMarketSales.length > 0 || currentYearWindmillSales.length > 0) {
                        makeInfoSection('Ventes de l\'année');
                        
                        if (currentYearMarketSales.length > 0) {
                            makeInfoKeyValue('Ventes au marché', `${currentYearMarketSales.length} vente(s)`);
                            currentYearMarketSales.forEach(sale => {
                                const productName = sale.productType === 'wheat' ? 'Blé' : 
                                                   sale.productType === 'carrot' ? 'Carotte' : 
                                                   sale.productType === 'cabbage' ? 'Chou' : sale.productType;
                                const subtext = `${sale.monthName || `Mois ${sale.month + 1}`} - Tour ${sale.turn}: ${sale.quantity} paniers`;
                                makeInfoKeyValue(`  → ${productName}`, `${sale.quantity} paniers`, subtext);
                            });
                        }
                        
                        if (currentYearWindmillSales.length > 0) {
                            makeInfoKeyValue('Ventes au moulin', `${currentYearWindmillSales.length} type(s) de produit`);
                            currentYearWindmillSales.forEach(sale => {
                                const productName = sale.productType === 'wheat' ? 'Blé' : 
                                                   sale.productType === 'carrot' ? 'Carotte' : 
                                                   sale.productType === 'cabbage' ? 'Chou' : sale.productType;
                                const subtext = `${sale.count || 1} collecte(s) cette année`;
                                makeInfoKeyValue(`  → ${productName}`, `${sale.quantity} paniers`, subtext);
                            });
                        }
                    }
                    
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ La ferme a tout ce qu\'il faut pour fonctionner',
                        noWorkers: '❌ La ferme n\'a aucun employé et ne peut pas fonctionner',
                        partialWorkers: '⚠️ La ferme ne peut fonctionner à sa pleine capacité',
                    });
                }

                // Display windmill food stocks (collected from all farms in December)
                if(supplyView?.kind === 'windmill' && Object.hasOwn(houseStocks || {}, 'food')) {
                    const hasRoadAccess = roadAccess.hasAccess;
                    const isCollecting = supplyView.isCollecting === true;
                    const lastCollection = supplyView.lastCollection;
                    const lastImport = supplyView.lastImport;
                    const lastImportDetails = supplyView.lastImportDetails;
                    const maxStock = supplyView.maxStock || 1000;
                    
                    makeInfoSection('Stock moulin');
                    
                    const wheatCollectionAmount = lastCollection?.wheat || 0;
                    const wheatCollectionText = `+${wheatCollectionAmount} dernière collecte`;
                    const wheatImportAmount = lastImport?.wheat !== undefined ? lastImport.wheat : 0;
                    const wheatImportText = `+${wheatImportAmount} paniers importés`;
                    const wheatSubtext = `${wheatCollectionText}, ${wheatImportText}`;

                    const cabbageCollectionAmount = lastCollection?.cabbage || 0;
                    const cabbageCollectionText = `+${cabbageCollectionAmount} dernière collecte`;
                    const cabbageImportAmount = lastImport?.cabbage !== undefined ? lastImport.cabbage : 0;
                    const cabbageImportText = `+${cabbageImportAmount} paniers importés`;
                    const cabbageSubtext = `${cabbageCollectionText}, ${cabbageImportText}`;

                    const carrotCollectionAmount = lastCollection?.carrot || 0;
                    const carrotCollectionText = `+${carrotCollectionAmount} dernière collecte`;
                    const carrotImportAmount = lastImport?.carrot !== undefined ? lastImport.carrot : 0;
                    const carrotImportText = `+${carrotImportAmount} paniers importés`;
                    const carrotSubtext = `${carrotCollectionText}, ${carrotImportText}`;

                    const dattesCollectionAmount = lastCollection?.dattes || 0;
                    const dattesCollectionText = `+${dattesCollectionAmount} dernière collecte`;
                    const dattesImportAmount = lastImport?.dattes !== undefined ? lastImport.dattes : 0;
                    const dattesImportText = `+${dattesImportAmount} paniers importés`;
                    const dattesSubtext = `${dattesCollectionText}, ${dattesImportText}`;

                    const totalCollectionAmount = lastCollection?.total || 0;
                    const totalCollectionText = `+${totalCollectionAmount} dernière collecte`;
                    const totalImportAmount = lastImport?.total !== undefined ? lastImport.total : 0;
                    const totalImportText = `+${totalImportAmount} paniers importés`;
                    const totalSubtext = `${totalCollectionText}, ${totalImportText}`;

                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0}/${maxStock} paniers`, wheatSubtext);
                    makeInfoKeyValue('Chou', `${houseStocks.cabbage || 0}/${maxStock} paniers`, cabbageSubtext);
                    makeInfoKeyValue('Carotte', `${houseStocks.carrot || 0}/${maxStock} paniers`, carrotSubtext);
                    makeInfoKeyValue('Dattes', `${houseStocks.dattes || 0}/${maxStock} paniers`, dattesSubtext);
                    makeInfoKeyValue('Bois', `${houseStocks.wood || 0}/${maxStock} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0}/${maxStock} paniers collectés`, totalSubtext);

                    if (lastImportDetails && Object.keys(lastImportDetails).length > 0) {
                        makeInfoSection('Imports par partenaire');

                        const productNames = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou', dattes: 'Dattes', wood: 'Bois' };

                        for (const [productId, partners] of Object.entries(lastImportDetails)) {
                            if (partners && partners.length > 0) {
                                const productName = productNames[productId] || productId;
                                partners.forEach(partnerInfo => {
                                    makeInfoKeyValue(
                                        `${productName}`,
                                        `${partnerInfo.quantity} paniers`,
                                        `depuis ${partnerInfo.partnerName}`
                                    );
                                });
                            }
                        }
                    }

                    makeInfoSection('Approvisionnement');
                    if (hasRoadAccess) {
                        makeInfoKeyValue('Routes', '✅ Accès routier');
                    } else {
                        makeInfoKeyValue('Routes', '❌ Pas d\'accès routier');
                    }
                    makeInfoKeyValue('Source', 'Toutes les fermes du jeu');
                    if (isCollecting) {
                        makeInfoKeyValue('État', '🟢 En collecte (décembre)');
                    } else {
                        makeInfoKeyValue('État', '⏸️ En attente (collecte en décembre)');
                    }
                    
                    if (!hasRoadAccess) {
                        makeInfoBuildingText('⚠️ Sans route le moulin ne peut stocker', false, 'warning-message');
                    }
                    
                    renderWorkplaceEmployeesInfo(buildingRow, {
                        fullyStaffed: '✅ Le moulin tourne à plein régime',
                        noWorkers: '❌ Le moulin manque de bras, il ne peut fonctionner',
                        partialWorkers: '⚠️ Le moulin tourne avec peine car trop peu d\'employés',
                    });
                }
            }
           
            // Only pause/resume when using select-object tool
            // When placing buildings, we don't want to pause the game
            if(infoObjectOverlay.classList.contains('active')) {
                // Disable pointer events on 3D scene when info overlay is active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                window.game.pause()
            } else {
                // Re-enable pointer events on 3D scene when info overlay is not active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                window.game.play()
            }
            await runScenePresentationPass(time);
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
                if (window.game && typeof window.game.play === 'function') {
                    window.game.play();
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
                const existingHouse = await findBuildingAtTile({ x, y });
                if (existingHouse) {
                    console.warn('[game.js] Building already exists at this location:', placementKey);
                    showGenericErrorNotification(activeToolId, 'building_already_exists');
                    return;
                }
            
                price = getAssetPrice(activeToolId, assetsPrices) || 0
                
                const [houseStocks, budgetData] = await Promise.all([
                    Promise.resolve({ food: 0, cabbage: 0, wheat: 0, carrot: 0 }),
                    window.budgetManager ? window.budgetManager.getCurrentBudget() : Promise.resolve({ funds: 0 })
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
                for (let dx = 0; dx < gridSize; dx++) {
                    for (let dy = 0; dy < gridSize; dy++) {
                        const tileX = x + dx;
                        const tileY = y + dy;
                        if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                            city.tiles[tileX][tileY].buildingId = activeToolId;
                            city.tiles[tileX][tileY].instanceId = instanceId;
                        }
                    }
                }
                
                // Meshes + neighbors, then ECS evolution, then employment refresh
                await scene.update(city, time, { skipBudget: true });
                await runSimulationPass(time, { skipBudget: true });
                await syncEmploymentAfterBuildingChange(scene, city, activeToolId);
                if (window.multiplayerManager && window.multiplayerManager.isMultiplayer) {
                    try {
                        await window.multiplayerManager.placeBuilding(activeToolId, x, y);
                    } catch (error) {
                        console.warn('[Multiplayer] Erreur envoi bâtiment:', error);
                        // On continue même si l'envoi échoue (placement local réussi)
                    }
                }
                
                // Resume the game after successful building placement
                if (window.game) {
                    window.game.play();
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
            
            window.game.play()
        }
    })

    // Expose scene and city on game object so it can be accessed from other modules
    const game = {
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
            if (window.budgetManager) {
                await window.budgetManager.updateTurn(time);
            }
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

            if (window.objectivesTracker && objectivesTracker.enabled) {
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
            if (window.objectivesTracker && objectivesTracker.enabled) {
                await objectivesTracker.checkObjectives(0);
            }
        },

        replay() {
            isOver = false;
            overOverlay.classList.remove('active');
            
            // Clear localStorage before replay
            try {
                commerceStore.clear();
                // Also clear other localStorage items that should be reset on replay
                localStorage.removeItem('journal_year_end_balances');
                localStorage.removeItem('citizen_tax_amount');
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
            appRegistry.register('inputManager', inputManager);
        }
    } catch (_) {}
    
    // Initialize mobile controls for touch devices (if camera is available)
    // Use dynamic import with .then() to avoid making createGame async
    if (scene && scene.camera) {
        import('../ui/mobile-controls.js')
            .then(({ initMobileControls }) => {
                initMobileControls(scene.camera);
            })
            .catch((error) => {
                console.warn('[Game] Failed to initialize mobile controls:', error);
            });
    }
    
    // Register game instance
    appRegistry.register('game', game);
    
    return game;
}