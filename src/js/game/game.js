import * as THREE from 'three';
import {  assetsPrices } from '../meshs/data.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import {getAssetPrice, makeDbItemId, makeInfoBuildingText, isAreaAvailableForBuilding} from '../utils/utils.js';
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
    displayTime.textContent = time.toString() + ' jours';
    
    // Initialize budget system - force reinitialize to ensure 200€ starting funds
    budgetManager.forceReinitialize(200).then(() => {
        // Make budgetManager available globally for scene.js
        window.budgetManager = budgetManager;
    });


    /* Scene initialization */
    const scene = createScene(housesStore, gameStore, assetManager);

    /* City initialization */
    const city = createCity(16);

    scene.initialize(city);

    // handler function to extract coordinate of an object I click on (data from asset js and using scene js methods)
    scene.onObjectSelected = async (selectedObject) => {
        selectedObject.info = '';
        selectedObject.name = activeToolId !== 'select-object'? activeToolId : selectedObject.name;
        // Object selected


        let { x, y } = selectedObject.userData;
        // location of the tile in the data model
        const tile = city.tiles[x][y];
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
                    if (city.tiles[tileX] && city.tiles[tileX][tileY]) {
                        city.tiles[tileX][tileY].buildingId = undefined;
                    }
                }
            }
            await scene.update(city);
        } else if(activeToolId === "select-object") {
            // Object selection
            infoObjectOverlay.classList.toggle('active');
            
            // Manage pointer events on 3D scene when info overlay toggles
            const canvas = document.querySelector('canvas');
            if (canvas) {
                if (infoObjectOverlay.classList.contains('active')) {
                    canvas.classList.add('pointer-events-disabled');
                } else {
                    canvas.classList.remove('pointer-events-disabled');
                }
            }
            
            makeInfoBuildingText("", true)

            if(!buildingsObjects.includes(selectedObject.userData.id)) {
                // Not a building object
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

                makeInfoBuildingText(`Bâtiment: ${selectedObject.userData.id} x: ${selectedObject.userData.x} y: ${selectedObject.userData.y}`, false)
                makeInfoBuildingText(`Nombre d'habitants: ${buildingPop}`, false)
                makeInfoBuildingText(`Desservie par ${houseRoads ? houseRoads : 0 } route(s).`, false)

                if(neighbors.length > 0) {
                    makeInfoBuildingText(`Voisin immédiats: `, false)
                    neighbors.filter(neigh => neigh.x && neigh.y).forEach(neighbor => {
                        makeInfoBuildingText(`- ${neighbor.buildingId} | adresse: x: ${neighbor.x} et y: ${neighbor.y}`, false)
                    })
                } else {
                    makeInfoBuildingText(`Maison isolée`, false)
                }

                if(selectedObject.userData.id.includes('House') && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoBuildingText(`Nourriture disponible: `, false)
                    makeInfoBuildingText(`- Blé : ${houseStocks.wheat} paniers`, false)
                    makeInfoBuildingText(`- Légumes verts : ${houseStocks.cabbage} paniers`, false)
                    makeInfoBuildingText(`- Autres légumes : ${houseStocks.carrot} paniers`, false)
                    makeInfoBuildingText(`------------------------------------`, false)
                    makeInfoBuildingText(`- Total : ${houseStocks.food} paniers`, false)
                } else {
                    makeInfoBuildingText(`Maison isolée`, false)
                }

                if(selectedObject.userData.id.includes('Farm') && Object.hasOwn(houseStocks, 'food')) {
                    makeInfoBuildingText(`Nourriture disponible: `, false)
                    if(selectedObject.userData.id.includes('Farm-Wheat')) {
                        makeInfoBuildingText(`- Blé : ${houseStocks.wheat} paniers produits`, false)
                    }

                    if(selectedObject.userData.id.includes('Farm-Carrot')) {
                        makeInfoBuildingText(`- Carrotes : ${houseStocks.carrot} paniers produits`, false)
                    }

                    if(selectedObject.userData.id.includes('Farm-Cabbage')) {
                        makeInfoBuildingText(`- Légumes verts : ${houseStocks.cabbage} paniers produits`, false)
                    }

                    makeInfoBuildingText(`------------------------------------`, false)
                    makeInfoBuildingText(`- Total : ${houseStocks.food} unités produites`, false)
                } else {
                    makeInfoBuildingText(`Maison isolée`, false)
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
            if (!isAreaAvailableForBuilding(city, x, y, gridSize)) {
                showGenericErrorNotification(activeToolId, 'area_not_available');
                return;
            }
            
            // Prepare building data for payment validation
            let price = 0
            const houseID = activeToolId + '-' + selectedObject.userData.x + '-' + selectedObject.userData.y
            const houseStocks = await housesStore.getHouseItem(houseID, 'stocks');
            const houseNeighbors = await housesStore.getHouseItem(houseID, 'neighbors');
            let HouseRoads  = {roads: 0};
            if(houseNeighbors) {
                HouseRoads = {roads: houseNeighbors.filter(neighbor => neighbor.name === 'roads').length};
            }
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
    document.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
    document.addEventListener('mouseup', scene.onMouseUp.bind(scene), false);
    document.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
    document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
    document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);

    infoObjectCloseBtn.addEventListener('click', () => {
        if(infoObjectOverlay.classList.contains('active')) {
            infoObjectOverlay.classList.remove('active')
            
            // Re-enable pointer events on 3D scene when info overlay closes
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
            }
            
            window.game.play()
        }
    })

    const game = {

        update(time) {
            displayTime.textContent = time + ' jours'
            city.update();
            scene.update(city, time);
        },

        pause() {
           isPause = true;
            // Game paused 
            infoPanelClockIcon.style.display = 'none'
            infoPanelNoClockIcon.style.display = 'block'
            displayTime.textContent = 'pause'
        },

        play() {
            // Game playing
            isPause = false;
            infoPanelClockIcon.style.display = 'block'
            infoPanelNoClockIcon.style.display = 'none'
            displayTime.textContent = 'play'
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
    return game;
}