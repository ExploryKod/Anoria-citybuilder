import * as THREE from 'three';
import {  assetsPrices } from '../meshs/data.js';
import { checkRoadAccess } from './modules/ModuleHelper.js';
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
import FoodTraceabilityService from '../stores/FoodTraceabilityService.js';
import loaderManager from '../utils/LoaderManager.js';
import objectivesTracker from '../ui/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI from './GameUI.js';
import appRegistry from './AppRegistry.js';
import webglDetector from '../utils/WebGLResourceDetector.js';
import { TimeManager } from './utils/TimeManager.js';

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
        const { RandomEventsService } = await import('./services/RandomEventsService.js');
        
        services.push(new RoadConnectivityService());
        services.push(new FoodDistributionService()); // Farm > Market > House logic using IndexedDB
        services.push(new RandomEventsService()); // Événements aléatoires (ouragan, inondation)
        
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
        'insufficient_funds': 'Fonds insuffisants'
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
    // Set initial speed within limits (500ms - 20,000ms)
    localStorage.setItem("speed", "4000");
    
    // Register with AppRegistry (centralized namespace)
    appRegistry.register('gameUI', gameUI);
    appRegistry.register('budgetManager', budgetManager);
    
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
                const buildingPop = await housesStore.getHouseItem(uniqueId, 'pop')
                const houseRoads = await housesStore.getHouseItem(uniqueId, 'roads');
                const houseStocks = await housesStore.getHouseItem(uniqueId, 'stocks');

                /* Check if neighbor */
                let neighbors = [];
                if(selectedObject.userData.neighbors) {
                    neighbors = selectedObject.userData.neighbors
                        .filter(neighbor => neighbor.buildingId && neighbor.buildingId !== "");
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
                    makeInfoKeyValue('Blé', `${houseStocks.wheat} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food} paniers`);
                }

                // Display market food stocks (similar to houses)
                if((selectedObject.userData.id.includes('Market') || selectedObject.userData.id.includes('market')) && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoSection('Stock marché');
                    makeInfoKeyValue('Blé', `${houseStocks.wheat || 0} paniers`);
                    makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage || 0} paniers`);
                    makeInfoKeyValue('Autres légumes', `${houseStocks.carrot || 0} paniers`);
                    makeInfoKeyValue('Total', `${houseStocks.food || 0} paniers disponibles`);
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
            }

            // Validate payment BEFORE placing building
            const paymentResult = await housesStore.addHouseAndPay(dbHouseData);
            
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