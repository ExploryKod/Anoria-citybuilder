import * as THREE from 'three';
import {  assetsPrices } from '../meshs/data.js';
import { checkRoadAccess } from './modules/ModuleHelper.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import {getAssetPrice, makeDbItemId, makeInfoBuildingText, makeInfoKeyValue, makeInfoSection, isAreaAvailableForBuilding} from '../utils/utils.js';
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
import loaderManager from '../utils/LoaderManager.js';
import objectivesTracker from '../ui/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI from './GameUI.js';
import appRegistry from './AppRegistry.js';

// Services (city-wide simulation systems) - optional, non-invasive
let services = [];
// Load services asynchronously (non-blocking)
(async () => {
    try {
        // Load all available services
        const { RoadConnectivityService } = await import('./services/RoadConnectivityService.js');
        const { FoodDistributionService } = await import('./services/FoodDistributionService.js');
        
        services.push(new RoadConnectivityService());
        services.push(new FoodDistributionService()); // Farm > Market > House logic using IndexedDB
        
        console.log('[game.js] Services loaded successfully:', services.length, services.map(s => s.constructor.name));
    } catch (err) {
        console.warn('[game.js] Failed to load services (continuing without them):', {
            error: err?.message || err,
            note: 'Services are optional enhancements and game will function normally'
        });
    }
})();

// Notification system for building placement feedback
function showInsufficientFundsNotification(buildingType, price) {
    const notification = document.createElement('div');
    notification.className = 'building-notification insufficient-funds';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">💰</div>
            <div class="notification-text">
                <div class="notification-title">Fonds Insuffisants</div>
                <div class="notification-message">Impossible de construire ${buildingType}. Coût : ${price}€</div>
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
    const notification = document.createElement('div');
    notification.className = 'building-notification generic-error';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">⚠️</div>
            <div class="notification-text">
                <div class="notification-title">Erreur de Construction</div>
                <div class="notification-message">Impossible de construire ${buildingType}. ${reason}</div>
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

export function createGame(housesStore, gameStore, assetManager) {
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
    gameUI.updateTimeDisplay(time);
    
    // Initialize budget system - force reinitialize to ensure 200€ starting funds
    budgetManager.forceReinitialize(200).then(() => {
        // BudgetManager registered above - available via window.app.budgetManager or window.budgetManager
    });


    /* Scene initialization */
    const scene = createScene(housesStore, gameStore, assetManager);

    /* City initialization */
    const city = createCity(16);

    scene.initialize(city).then(() => {
        // Hide Chronos loader modal once scene is initialized with fade-out
        loaderManager.hide(500);
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
            await scene.update(city);
        } else if(activeToolId === "select-object") {
            // Object selection
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
                // If it's already open from a previous selection, leave its state unchanged here
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

                if(selectedObject.userData.id.includes('Farm') && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoSection('Production ferme');
                    if(selectedObject.userData.id.includes('Farm-Wheat')) {
                        makeInfoKeyValue('Blé', `${houseStocks.wheat} paniers produits`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Carrot')) {
                        makeInfoKeyValue('Carottes', `${houseStocks.carrot} paniers produits`);
                    }
                    if(selectedObject.userData.id.includes('Farm-Cabbage')) {
                        makeInfoKeyValue('Légumes verts', `${houseStocks.cabbage} paniers produits`);
                    }
                    makeInfoKeyValue('Total', `${houseStocks.food} unités produites`);
                }
            }
           
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
            await scene.update(city)
        } else if(!tile.buildingId) {
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
                await scene.update(city);
                
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
        canvasEl.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: true });
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
        document.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: true });
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

    // Expose scene on game object so it can be accessed from other modules
    const game = {
        scene: scene,

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
            
            // Vérifier les objectifs à chaque tour
            if (window.objectivesTracker) {
                await objectivesTracker.checkObjectives(time);
            }
        },

        pause() {
            isPause = true;
            gameUI.setPaused(true);
        },

        async play() {
            // Game playing
            isPause = false;
            gameUI.setPaused(false);
            // Appeler update(0) pour activer l'objectif au tour 0 au démarrage
            if (window.objectivesTracker) {
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
    
    // Register game instance
    appRegistry.register('game', game);
    
    return game;
}