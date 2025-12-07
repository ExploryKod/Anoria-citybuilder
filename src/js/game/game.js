import * as THREE from 'three';
import {  assetsPrices } from '../meshs/data.js';
import { checkRoadAccess, canHouseEvolveToPurple, canHouseEvolveToPalace, checkFoodAvailability } from './modules/ModuleHelper.js';
import { getDefaultEmployees, getSectorPriority, getSectorName } from './modules/EmployeeHelper.js';
import { firstHouses } from '../ui/nodes.js';
import { TimeManager } from './utils/TimeManager.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import {getAssetPrice, makeDbItemId, makeInfoBuildingText, makeInfoKeyValue, makeInfoSection, isAreaAvailableForBuilding} from '../utils/utils.js';
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
import InputManager from './InputManager.js';
import gameUI from './GameUI.js';
import appRegistry from './AppRegistry.js';
import webglDetector from '../utils/WebGLResourceDetector.js';

// Initialiser le cache de TimeManager au démarrage
TimeManager.initializeCache().catch(err => {
    console.warn('[game.js] Could not initialize TimeManager cache:', err);
});

// Services (city-wide simulation systems) - optional, non-invasive
let services = [];
// Load services asynchronously (non-blocking)
(async () => {
    try {
        // Load all available services
        const { RoadConnectivityService } = await import('./services/RoadConnectivityService.js');
        const { FoodDistributionService } = await import('./services/FoodDistributionService.js');
        const { WindmillService } = await import('./services/WindmillService.js');
        const { RandomEventsService } = await import('./services/RandomEventsService.js');
        const { EmploymentPriorityService } = await import('./services/EmploymentPriorityService.js');
        const { EmploymentDistributionService } = await import('./services/EmploymentDistributionService.js');
        
        services.push(new RoadConnectivityService());
        services.push(new FoodDistributionService()); // Farm > Market > House logic using IndexedDB
        services.push(new WindmillService()); // Windmill collects from all farms in October
        services.push(new RandomEventsService()); // Événements aléatoires (ouragan, inondation)
        
        // Employment Priority Service - manages sector priorities in localStorage
        // Priority is stored in localStorage (not IndexedDB) for instant updates
        const employmentPriorityService = new EmploymentPriorityService();
        services.push(employmentPriorityService);
        
        // Employment Distribution Service - distributes workers from houses to buildings
        // Reads sector from IndexedDB, looks up priority from localStorage at runtime
        // Lower priority number = higher importance (1 = first to get workers)
        services.push(new EmploymentDistributionService());
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

export function createGame(housesStore, gameStore, assetManager, citySize = null) {
    let activeToolId = '';
    let time = 0;
    let isPause;
    let isOver;
    let infos = {};
    let intervalId = null;
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


    /* Scene initialization */
    const scene = createScene(housesStore, gameStore, assetManager);

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
    
    // Enforce maximum size of 24 to prevent WebGL shader compilation errors
    // Larger sizes cause BackgroundMaterial shader validation failures
    // In test mode, allow larger sizes to test detection
    const testMode = localStorage.getItem('webgl-test-mode');
    const absoluteMaxSize = testMode ? 32 : 24; // Allow up to 32x32 in test mode
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
            // Find the building at this location and its size
            const buildingId = tile.buildingId;
            const buildingInfo = buildingId ? assetsPrices[buildingId] : null;
            const gridSize = buildingInfo?.gridSize || 1;
            
            // Remove building from all tiles it occupies
            for (let dx = 0; dx < gridSize; dx++) {
                for (let dy = 0; dy < gridSize; dy++) {
                    const tileX = x + dx;
                    const tileY = y + dy;
                    // Check bounds before accessing tiles (important for edge cases)
                    if (tileX >= 0 && tileX < city.size && tileY >= 0 && tileY < city.size) {
                        if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                            city.tiles[tileX][tileY].buildingId = undefined;
                        }
                    }
                }
            }
            await scene.update(city, time);
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
                // Building selection
                const uniqueId = makeDbItemId(selectedObject.userData.id, selectedObject.userData.x, selectedObject.userData.y)
                
                // Debug: Log the ID construction and retrieved data
                console.log('[game.js] Building info popup:', {
                    userDataId: selectedObject.userData.id,
                    x: selectedObject.userData.x,
                    y: selectedObject.userData.y,
                    constructedId: uniqueId
                });
                
                const buildingPop = await housesStore.getHouseItem(uniqueId, 'pop')
                const houseRoads = await housesStore.getHouseItem(uniqueId, 'roads');
                const houseStocks = await housesStore.getHouseItem(uniqueId, 'stocks');
                
                // Debug: Log retrieved data
                console.log('[game.js] Retrieved data from DB:', {
                    uniqueId,
                    pop: buildingPop,
                    roads: houseRoads,
                    hasStocks: !!houseStocks
                });
                
                // Also try to get the full house record to see what's actually stored
                const fullHouse = await housesStore.getHouse(uniqueId);
                console.log('[game.js] Full house record:', {
                    uniqueId,
                    type: fullHouse?.type,
                    roads: fullHouse?.roads,
                    neighborsCount: fullHouse?.neighbors?.length || 0,
                    hasNeighbors: !!fullHouse?.neighbors
                });

                /* Check if neighbor */
                let neighbors = [];
                if(selectedObject.userData.neighbors) {
                    neighbors = selectedObject.userData.neighbors
                        .filter(neighbor => neighbor && neighbor.buildingId && neighbor.buildingId !== "");
                }

                makeInfoSection('Bâtiment');
                makeInfoKeyValue('Type', `${selectedObject.userData.id}`);
                makeInfoKeyValue('Adresse', `x: ${selectedObject.userData.x} | y: ${selectedObject.userData.y}`);
                makeInfoKeyValue(`Habitants`, buildingPop);
                makeInfoKeyValue('Routes desservies', houseRoads ? houseRoads : 0);

                if(neighbors.length > 0) {
                    makeInfoSection('Voisins immédiats');
                    neighbors.filter(neigh => neigh.x && neigh.y).forEach(neighbor => {
                        makeInfoKeyValue(neighbor.buildingId, `x: ${neighbor.x} | y: ${neighbor.y}`);
                    })
                } else {
                    makeInfoKeyValue('Voisinage', 'Maison isolée');
                }

                if(selectedObject.userData.id.includes('House') && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoSection('Stocks nourriture');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers`);
                    
                    // Evolution section - show conditions for next evolution step
                    const buildingType = selectedObject.userData.id;
                    const { hasAccess: hasRoadAccess } = checkRoadAccess(neighbors || []);
                    const { totalFood } = checkFoodAvailability(houseStocks || {}, buildingPop || 0);
                    
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
                        const purpleCheck = canHouseEvolveToPurple({
                            stocks: houseStocks || {},
                            population: buildingPop || 0,
                            buildingType: buildingType,
                            hasRoadAccess: hasRoadAccess
                        });
                        
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
                        const palaceCheck = canHouseEvolveToPalace({
                            stocks: houseStocks || {},
                            population: buildingPop || 0,
                            buildingType: buildingType,
                            firstHouses: firstHouses
                        });
                        
                        // Palace-specific conditions (food goal, not basic conditions)
                        const { meetsFoodGoal } = checkFoodAvailability(houseStocks || {}, buildingPop || 0);
                        const foodGoalStatus = meetsFoodGoal ? '✅' : '❌';
                        const foodGoalText = meetsFoodGoal 
                            ? `Oui (${totalFood} > ${(buildingPop || 0) * 2})`
                            : `Non (${totalFood} ≤ ${(buildingPop || 0) * 2})`;
                        
                        // Check food variety (at least 2 types of food)
                        const foodTypes = {
                            wheat: (houseStocks?.wheat || 0) > 0,
                            carrot: (houseStocks?.carrot || 0) > 0,
                            cabbage: (houseStocks?.cabbage || 0) > 0
                        };
                        const availableFoodTypesCount = Object.values(foodTypes).filter(Boolean).length;
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
                if((selectedObject.userData.id.includes('Market') || selectedObject.userData.id.includes('market')) && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoSection('Stock marché');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers disponibles`);
                    
                    // Display employee information for markets
                    const marketData = await housesStore.getHouse(uniqueId);
                    if (marketData) {
                        // Check supply chain status (farms and houses)
                        const noFarmsNearby = marketData.noFarmsNearby === true;
                        
                        // Check if there are houses within distribution range
                        // Houses in range are determined by FoodDistributionService.findHousesInRange()
                        // For now, we check neighbors for houses
                        const marketNeighbors = marketData.neighbors || [];
                        const housesNearby = marketNeighbors.filter(neighbor => {
                            if (!neighbor) return false;
                            const name = neighbor.name || neighbor.buildingId || neighbor.type || '';
                            return name.includes('House') || name.includes('house');
                        });
                        const noHousesNearby = housesNearby.length === 0;
                        
                        // Check buying status and show market state
                        const isBuying = marketData.isBuying === true;
                        const hasNoWorkersForState = (marketData.employees?.worker || 0) === 0 && (marketData.employees?.worker_need || 0) > 0;
                        
                        // Buying period configuration (easy to change)
                        const buyingPeriodName = 'Automne'; // Season when markets buy from farms
                        
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
                        
                        if (marketData.employees) {
                            const employees = marketData.employees;
                            const workerNeed = employees.worker_need || 0;
                            const eliteNeed = employees.elite_need || 0;
                            const workers = employees.worker || 0;
                            const elites = employees.elite || 0;
                            // Get priority from localStorage based on sector (not from IndexedDB)
                            const sector = employees.sector || 0;
                            const priority = getSectorPriority(sector);
                            
                            const hasEnoughWorkers = workers >= workerNeed;
                            const hasEnoughElites = elites >= eliteNeed;
                            const hasNoWorkers = workers === 0 && workerNeed > 0;
                            const hasPartialWorkers = workers > 0 && workers < workerNeed;
                            const isFullyStaffed = hasEnoughWorkers && hasEnoughElites;
                            
                            makeInfoSection('Employés');
                            makeInfoKeyValue('Secteur', `${sector} : ${getSectorName(sector)}`);
                            makeInfoKeyValue('Priorité', `${priority}`);
                            makeInfoKeyValue('Ouvriers', `${workers}/${workerNeed}`);
                            makeInfoKeyValue('Élites', `${elites}/${eliteNeed}`);
                            
                            // Show status message based on employee status
                            if (isFullyStaffed) {
                                makeInfoBuildingText('✅ Le marché marche à plein régime', false, 'success-message');
                            } else if (hasNoWorkers) {
                                makeInfoBuildingText('❌ Le marché manque de bras, il ne peut fonctionner', false, 'error-message');
                            } else if (hasPartialWorkers) {
                                makeInfoBuildingText('⚠️ Le marché tente de vendre avec peine car trop peu d\'employés', false, 'warning-message');
                            }
                        }
                    }
                }

                if(selectedObject.userData.id.includes('Farm')) {
                    // Initialize stocks if not present
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
                    
                    // Display employee information for farms
                    const farmData = await housesStore.getHouse(uniqueId);
                    if (farmData && farmData.employees) {
                        const employees = farmData.employees;
                        const workerNeed = employees.worker_need || 0;
                        const eliteNeed = employees.elite_need || 0;
                        const workers = employees.worker || 0;
                        const elites = employees.elite || 0;
                        // Get priority from localStorage based on sector (not from IndexedDB)
                        const sector = employees.sector || 0;
                        const priority = getSectorPriority(sector);
                        
                        const hasEnoughWorkers = workers >= workerNeed;
                        const hasEnoughElites = elites >= eliteNeed;
                        const hasNoWorkers = workers === 0 && workerNeed > 0;
                        const hasPartialWorkers = workers > 0 && workers < workerNeed;
                        const isFullyStaffed = hasEnoughWorkers && hasEnoughElites;
                        
                        makeInfoSection('Employés');
                        makeInfoKeyValue('Secteur', `${sector} : ${getSectorName(sector)}`);
                        makeInfoKeyValue('Priorité', `${priority}`);
                        makeInfoKeyValue('Ouvriers', `${workers}/${workerNeed}`);
                        makeInfoKeyValue('Élites', `${elites}/${eliteNeed}`);
                        
                        // Show status message based on employee status
                        if (isFullyStaffed) {
                            makeInfoBuildingText('✅ La ferme a tout ce qu\'il faut pour fonctionner', false, 'success-message');
                        } else if (hasNoWorkers) {
                            makeInfoBuildingText('❌ La ferme n\'a aucun employé et ne peut pas fonctionner', false, 'error-message');
                        } else if (hasPartialWorkers) {
                            makeInfoBuildingText('⚠️ La ferme ne peut fonctionner à sa pleine capacité', false, 'warning-message');
                        }
                    }
                }

                // Display windmill food stocks (collected from all farms in October)
                if((selectedObject.userData.id.includes('Windmill') || selectedObject.userData.id.includes('windmill')) && Object.hasOwn(houseStocks, 'food')) {
                    // Get windmill data for status checks
                    const windmillData = await housesStore.getHouse(uniqueId);
                    
                    // Check if windmill has road access
                    const windmillRoads = houseRoads || 0;
                    const hasRoadAccess = windmillRoads > 0;
                    
                    // Check if windmill is currently collecting (set by WindmillService in October)
                    const isCollecting = windmillData?.isCollecting === true;
                    
                    // Get last collection data
                    const lastCollection = await housesStore.getHouseItem(uniqueId, 'lastCollection');
                    
                    makeInfoSection('Stock moulin');
                    
                    // Show stocks with last collection amounts
                    const wheatSubtext = lastCollection?.wheat ? `+${lastCollection.wheat} dernière collecte` : null;
                    const cabbageSubtext = lastCollection?.cabbage ? `+${lastCollection.cabbage} dernière collecte` : null;
                    const carrotSubtext = lastCollection?.carrot ? `+${lastCollection.carrot} dernière collecte` : null;
                    const totalSubtext = lastCollection?.total ? `+${lastCollection.total} dernière collecte` : null;
                    
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`, wheatSubtext);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`, cabbageSubtext);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`, carrotSubtext);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers collectés`, totalSubtext);
                    
                    makeInfoSection('Approvisionnement');
                    if (hasRoadAccess) {
                        makeInfoKeyValue('Routes', '✅ Accès routier');
                    } else {
                        makeInfoKeyValue('Routes', '❌ Pas d\'accès routier');
                    }
                    makeInfoKeyValue('Source', 'Toutes les fermes du jeu');
                    if (isCollecting) {
                        makeInfoKeyValue('État', '🟢 En collecte (octobre)');
                    } else {
                        makeInfoKeyValue('État', '⏸️ En attente (collecte en octobre)');
                    }
                    
                    // Show warning if no road access
                    if (!hasRoadAccess) {
                        makeInfoBuildingText('⚠️ Sans route le moulin ne peut stocker', false, 'warning-message');
                    }
                    
                    // Display employee information
                    if (windmillData && windmillData.employees) {
                        const employees = windmillData.employees;
                        const workerNeed = employees.worker_need || 0;
                        const eliteNeed = employees.elite_need || 0;
                        const workers = employees.worker || 0;
                        const elites = employees.elite || 0;
                        // Get priority from localStorage based on sector (not from IndexedDB)
                        const sector = employees.sector || 0;
                        const priority = getSectorPriority(sector);
                        
                        const hasEnoughWorkers = workers >= workerNeed;
                        const hasEnoughElites = elites >= eliteNeed;
                        const hasNoWorkers = workers === 0 && workerNeed > 0;
                        const hasPartialWorkers = workers > 0 && workers < workerNeed;
                        const isFullyStaffed = hasEnoughWorkers && hasEnoughElites;
                        
                        makeInfoSection('Employés');
                        makeInfoKeyValue('Secteur', `${sector} : ${getSectorName(sector)}`);
                        makeInfoKeyValue('Priorité', `${priority}`);
                        makeInfoKeyValue('Ouvriers', `${workers}/${workerNeed}`);
                        makeInfoKeyValue('Élites', `${elites}/${eliteNeed}`);
                        
                        // Show status message based on employee status
                        if (isFullyStaffed) {
                            makeInfoBuildingText('✅ Le moulin tourne à plein régime', false, 'success-message');
                        } else if (hasNoWorkers) {
                            makeInfoBuildingText('❌ Le moulin manque de bras, il ne peut fonctionner', false, 'error-message');
                        } else if (hasPartialWorkers) {
                            makeInfoBuildingText('⚠️ Le moulin tourne avec peine car trop peu d\'employés', false, 'warning-message');
                        }
                    }
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
            await scene.update(city, time)
        } else if(!tile.buildingId) {
            // PLACING A BUILDING - Ensure game is NOT paused
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
            const isRoadTool = activeToolId === 'roads' || activeToolId === 'Road' || (activeToolId && activeToolId.toLowerCase() === 'roads');
            const targetTile = city.tiles?.[x]?.[y];
            const canPlaceRoad = isRoadTool && (!targetTile?.buildingId || targetTile.buildingId === 'roads' || targetTile.buildingId === 'Road');
            if (!canPlaceRoad && !isAreaAvailableForBuilding(city, x, y, gridSize)) {
                showGenericErrorNotification(activeToolId, 'area_not_available');
                return;
            }
            
            // Prepare building data for payment validation
            let price = 0
            const houseID = activeToolId + '-' + selectedObject.userData.x + '-' + selectedObject.userData.y
            
            // Check if this building is already being placed (prevent rapid duplicate clicks)
            if (pendingPlacements.has(houseID)) {
                console.warn('[game.js] Building placement already in progress:', houseID);
                return;
            }
            
            // Mark as pending
            pendingPlacements.add(houseID);
            
            // Set timeout to clear pending (safety mechanism - 10 seconds)
            setTimeout(() => {
                if (pendingPlacements.has(houseID)) {
                    console.warn('[game.js] Clearing stuck pending placement for:', houseID);
                    pendingPlacements.delete(houseID);
                }
            }, 10000);
            
            try {
                // Check if building already exists in database
                const existingHouse = await housesStore.getHouse(houseID);
                if (existingHouse) {
                    console.warn('[game.js] Building already exists at this location:', houseID);
                    showGenericErrorNotification(activeToolId, 'building_already_exists');
                    return;
                }
            
                const houseStocks = await housesStore.getHouseItem(houseID, 'stocks');
                const houseNeighbors = await housesStore.getHouseItem(houseID, 'neighbors');
                const { roadCount } = checkRoadAccess(houseNeighbors || []);
                const HouseRoads  = { roads: roadCount };
                price = getAssetPrice(activeToolId, assetsPrices) || 0
                
                // Get funds from BudgetManager instead of game table
                let funds = 0;
                if (window.budgetManager) {
                    const budgetData = await window.budgetManager.getCurrentBudget();
                    funds = budgetData.funds;
                }
                
                const dbHouseData = {
                    name: houseID,
                    type: activeToolId,
                    neighbors: [],
                    pop: 0,
                    stocks : houseStocks ? houseStocks : {food: 0, cabbage : 0, wheat: 0, carrot: 0},
                    gameTurn: time,
                    time: 0,
                    isBuilding: true,
                    roads:  HouseRoads.roads ?? 0,
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

                // Validate payment BEFORE placing building
                const paymentResult = await housesStore.addHouseAndPay(dbHouseData);
                
                // Handle duplicate building error gracefully
                if (!paymentResult.success && paymentResult.reason === 'duplicate') {
                    console.warn('[game.js] Building already exists, skipping placement:', houseID);
                    showGenericErrorNotification(activeToolId, 'building_already_exists');
                    return;
                }
                
                if (paymentResult.success) {
                // Payment successful - place building visually
                // Mark all tiles as occupied by this building
                for (let dx = 0; dx < gridSize; dx++) {
                    for (let dy = 0; dy < gridSize; dy++) {
                        const tileX = x + dx;
                        const tileY = y + dy;
                        if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                            city.tiles[tileX][tileY].buildingId = activeToolId;
                        }
                    }
                }
                
                // FIX: For roads, update visually immediately for instant feedback
                // Then do full scene update asynchronously
                const isRoadTool = activeToolId === 'roads' || activeToolId === 'Road' || (activeToolId && activeToolId.toLowerCase() === 'roads');
                if (isRoadTool && scene.updateRoadImmediate) {
                    // Update road visually immediately
                    scene.updateRoadImmediate(x, y);
                    // Do full scene update asynchronously (don't await - let it run in background)
                    scene.update(city, time).catch(err => {
                        console.warn('[game.js] Scene update error after road placement:', err);
                    });
                } else {
                    // For other buildings, do normal update
                    await scene.update(city, time);
                }
                
                // Envoyer au serveur multijoueur si activé
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
                pendingPlacements.delete(houseID);
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

        async update(time) {
            gameUI.updateTimeDisplay(time);
            city.update();
            
            // Run city-wide services before individual building simulation (services read/write to IndexedDB)
            if (services.length > 0) {
                try {
                    await Promise.allSettled(
                        services.map(service => service.simulate(city, housesStore, time))
                    );
                } catch (err) {
                    console.error('[game.js > update] Service simulation error:', {
                        error: err?.message || err,
                        time
                    });
                }
            }
            
            await scene.update(city, time);
            
            // Vérifier les objectifs à chaque tour (seulement si activés)
            if (window.objectivesTracker && objectivesTracker.enabled) {
                await objectivesTracker.checkObjectives(time);
            }
        },

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
            overOverlay.classList.remove('active')
            window.location.href = '/'
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
            const speed = Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed')) || 4000));
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(() => {
                if (!isPause && !isOver) {
                    time += 1;
                    game.update(time);
                }
            }, speed);
        }
    }; 

    setInterval(() => {
        if(!isPause) {
            if(!isOver) {
                time += 1;
                game.update(time);
            }
        }
    }, Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed')) || 4000)));

    scene.start();

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