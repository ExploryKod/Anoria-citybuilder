import {
    bullDozeButton,
    displaySpeed,
    farmsButton,
    fasterButton,
    housesButton,
    infoObjectCloseBtn,
    infoObjectOverlay,
    loaderButton,
    marketButton,
    othersButton,
    panelLayout,
    panelLayoutCloseBtn,
    panelLayoutInner,
    pauseButton,
    pauseOverlay,
    playButton,
    replayButton,
    roadButton,
    selectButton,
    slowerButton,
    toolBarButtons
} from "./nodes.js";
import { createGame } from '../game/game.js';
import gameStore from "../stores/GameStore.js";
import housesStore from "../stores/HousesStore.js";
import budgetManager from "../stores/BudgetManager.js";
import AssetManager from "../meshs/AssetManager.js";

let buttonData;
let toolIds;

function updateSpeedDisplay() {
    const speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
    displaySpeed.textContent = `Vitesse du jeu: ${speed} ms`;
}

function createBudgetElements() {
    // Create budget button
    const budgetBtn = document.createElement('button');
    budgetBtn.type = 'button';
    budgetBtn.id = 'budget-btn';
    budgetBtn.setAttribute('data-toolid', 'budget');
    budgetBtn.className = 'toolbar-btn';
    budgetBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-euro">
            <path d="M4 10h12"/><path d="M4 14h9"/>
            <path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>
        </svg>
    `;
    
    // Add to toolbar (after roads button)
    const roadsBtn = document.getElementById('roads-btn');
    if (roadsBtn && roadsBtn.parentNode) {
        roadsBtn.parentNode.insertBefore(budgetBtn, roadsBtn.nextSibling);
    }
    
    // Create budget panel
    const budgetPanel = document.createElement('div');
    budgetPanel.id = 'budget-panel';
    budgetPanel.className = 'budget-panel';
    
    // Add inline styles to ensure visibility
    budgetPanel.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
    `;
    
    budgetPanel.innerHTML = `
        <div class="budget-panel-wrapper">
            <div class="budget-panel-header">
                <h2>💰 Suivi du Budget</h2>
                <div class="budget-panel-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-x">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m15 9-6 6"/>
                        <path d="m9 9 6 6"/>
                    </svg>
                </div>
            </div>
            <div class="budget-panel-content">
                <div class="budget-summary">
                    <div class="budget-item">
                        <span class="budget-label">Tour Actuel:</span>
                        <span class="budget-value" id="budget-turn">0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Population:</span>
                        <span class="budget-value" id="budget-population">0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Total Bâtiments:</span>
                        <span class="budget-value" id="budget-buildings">0</span>
                    </div>
                </div>
                
                <div class="budget-financial">
                    <h3>Aperçu Financier</h3>
                    <div class="budget-item">
                        <span class="budget-label">Fonds Disponibles:</span>
                        <span class="budget-value" id="budget-funds">0€</span>
                        <span class="budget-change" id="budget-funds-change">+0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Dépenses Totales:</span>
                        <span class="budget-value" id="budget-expenses">0€</span>
                        <span class="budget-change" id="budget-expenses-change">+0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Revenus Totaux:</span>
                        <span class="budget-value" id="budget-income">0€</span>
                        <span class="budget-change" id="budget-income-change">+0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Flux Net:</span>
                        <span class="budget-value" id="budget-netflow">0€</span>
                        <span class="budget-change" id="budget-netflow-change">+0</span>
                    </div>
                </div>

                <div class="budget-buildings">
                    <h3>Portefeuille de Bâtiments</h3>
                    <div class="budget-item">
                        <span class="budget-label">Valeur Totale:</span>
                        <span class="budget-value" id="budget-total-value">0€</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Maisons:</span>
                        <span class="budget-value" id="budget-houses">0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Fermes:</span>
                        <span class="budget-value" id="budget-farms">0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Marchés:</span>
                        <span class="budget-value" id="budget-markets">0</span>
                    </div>
                    <div class="budget-item">
                        <span class="budget-label">Routes:</span>
                        <span class="budget-value" id="budget-roads">0</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(budgetPanel);
    
    // Add a style element for the active state
    const style = document.createElement('style');
    style.textContent = `
        .budget-panel.active {
            display: flex !important;
        }
        .budget-panel-wrapper {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .budget-panel-header {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .budget-panel-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .budget-panel-close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s ease;
        }
        .budget-panel-close-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        .budget-panel-content {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
        }
        .budget-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .budget-item:last-child {
            border-bottom: none;
        }
        .budget-label {
            font-weight: 500;
            color: #ccc;
        }
        .budget-value {
            font-weight: 600;
            font-size: 16px;
        }
    `;
    document.head.appendChild(style);
    
    console.log('Budget elements created dynamically');
}

async function updateBudgetDisplay() {
    try {
        // Get budget data from BudgetManager
        const budgetSummary = await budgetManager.getBudgetSummary();
        const financialHealth = await budgetManager.getFinancialHealth();
        
        // Get other game data
        const population = await housesStore.getGlobalPopulation() || 0;
        const totalBuildingValue = await housesStore.getGlobalBuildingPrices() || 0;
        
        // Get building counts
        const houses = await housesStore.listAllHouses();
        const buildingCounts = {
            houses: 0,
            farms: 0,
            markets: 0,
            roads: 0,
            total: 0
        };
        
        houses.forEach(house => {
            const type = house.type;
            if (type.includes('House')) buildingCounts.houses++;
            else if (type.includes('Farm')) buildingCounts.farms++;
            else if (type.includes('Market')) buildingCounts.markets++;
            else if (type.includes('roads')) buildingCounts.roads++;
            buildingCounts.total++;
        });
        
        // Update display elements
        const budgetTurnEl = document.getElementById('budget-turn');
        const budgetPopulationEl = document.getElementById('budget-population');
        const budgetBuildingsEl = document.getElementById('budget-buildings');
        const budgetFundsEl = document.getElementById('budget-funds');
        const budgetExpensesEl = document.getElementById('budget-expenses');
        const budgetIncomeEl = document.getElementById('budget-income');
        const budgetNetflowEl = document.getElementById('budget-netflow');
        const budgetTotalValueEl = document.getElementById('budget-total-value');
        const budgetHousesEl = document.getElementById('budget-houses');
        const budgetFarmsEl = document.getElementById('budget-farms');
        const budgetMarketsEl = document.getElementById('budget-markets');
        const budgetRoadsEl = document.getElementById('budget-roads');
        
        // Update financial data
        if (budgetTurnEl) budgetTurnEl.textContent = budgetSummary.turn;
        if (budgetPopulationEl) budgetPopulationEl.textContent = population;
        if (budgetBuildingsEl) budgetBuildingsEl.textContent = buildingCounts.total;
        
        // Financial data with proper type checking
        if (budgetFundsEl) {
            if (typeof budgetSummary.funds !== 'number' || isNaN(budgetSummary.funds)) {
                console.error('Invalid funds value in budget summary:', budgetSummary.funds);
                budgetFundsEl.textContent = 'Erreur';
                budgetFundsEl.style.color = '#ff6b6b';
            } else {
                budgetFundsEl.textContent = `${budgetSummary.funds.toLocaleString('fr-FR')}€`;
                budgetFundsEl.style.color = budgetSummary.funds < 0 ? '#ff6b6b' : '#4ade80';
            }
        }
        
        if (budgetExpensesEl) {
            if (typeof budgetSummary.expenses !== 'number' || isNaN(budgetSummary.expenses)) {
                console.error('Invalid expenses value in budget summary:', budgetSummary.expenses);
                budgetExpensesEl.textContent = 'Erreur';
            } else {
                budgetExpensesEl.textContent = `${budgetSummary.expenses.toLocaleString('fr-FR')}€`;
            }
        }
        
        if (budgetIncomeEl) {
            budgetIncomeEl.textContent = `0€`; // Income disabled for now
        }
        
        if (budgetNetflowEl) {
            if (typeof budgetSummary.netFlow !== 'number' || isNaN(budgetSummary.netFlow)) {
                console.error('Invalid netFlow value in budget summary:', budgetSummary.netFlow);
                budgetNetflowEl.textContent = 'Erreur';
                budgetNetflowEl.style.color = '#ff6b6b';
            } else {
                budgetNetflowEl.textContent = `${budgetSummary.netFlow.toLocaleString('fr-FR')}€`;
                budgetNetflowEl.style.color = budgetSummary.netFlow >= 0 ? '#4ade80' : '#ff6b6b';
            }
        }
        
        // Building data
        if (budgetTotalValueEl) {
            if (typeof totalBuildingValue !== 'number' || isNaN(totalBuildingValue)) {
                console.error('Invalid totalBuildingValue:', totalBuildingValue);
                budgetTotalValueEl.textContent = 'Erreur';
            } else {
                budgetTotalValueEl.textContent = `${totalBuildingValue.toLocaleString('fr-FR')}€`;
            }
        }
        if (budgetHousesEl) budgetHousesEl.textContent = buildingCounts.houses;
        if (budgetFarmsEl) budgetFarmsEl.textContent = buildingCounts.farms;
        if (budgetMarketsEl) budgetMarketsEl.textContent = buildingCounts.markets;
        if (budgetRoadsEl) budgetRoadsEl.textContent = buildingCounts.roads;
        
        // Add financial health indicator
        const healthIndicator = document.getElementById('budget-health') || document.createElement('div');
        if (!document.getElementById('budget-health')) {
            healthIndicator.id = 'budget-health';
            healthIndicator.style.cssText = `
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                margin-top: 10px;
                text-align: center;
            `;
            document.querySelector('.budget-financial').appendChild(healthIndicator);
        }
        
        healthIndicator.textContent = financialHealth.message;
        healthIndicator.style.backgroundColor = 
            financialHealth.status === 'critical' ? '#ff6b6b' :
            financialHealth.status === 'warning' ? '#ffa726' :
            financialHealth.status === 'deficit' ? '#ff9800' :
            financialHealth.status === 'excellent' ? '#4ade80' : '#81c784';
        healthIndicator.style.color = 'white';
        
    } catch (error) {
        console.error('Error updating budget display:', error);
    }
}

// Animation panel buttons
let animateButton = function(e) {

    e.preventDefault();
    //reset animation
    e.target.classList.remove('animate');

    e.target.classList.add('animate');
    setTimeout(function(){
        e.target.classList.remove('animate');
    },700);
};

const bubblyButtons = document.getElementsByClassName("bubbly-button");



function getButtonsUnactive() {
    toolBarButtons.forEach(button => {
        button.classList.remove('selected')
    })
}

function getButtonsDisabled() {
    toolBarButtons.forEach(button => {
        if(button.classList.contains('disabled')) {
            button.classList.remove('disabled')
        } else {
            button.classList.add('disabled')
        }

    })
}

function closeModal() {
    toolBarButtons.forEach(button => {
        if (button.classList.contains('disabled')) {
            button.classList.remove('disabled')
        }
    });
    toolBarButtons.forEach(button => {
        if(button.classList.contains('selected')) {
            button.classList.remove('selected')
        }
    })
    if(panelLayout.classList.contains('active')) {
        panelLayout.classList.remove('active');
        
        // Re-enable pointer events on 3D scene
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.classList.remove('pointer-events-disabled');
        }
        
        // Resume the game when closing building selection modal
        if (window.game) {
            window.game.play();
        }
    }
}

function toggleModal(e) {



    switch(e.target.dataset.group) {
        case 'residential':
            getButtonsUnactive()
            getButtonsDisabled()
            e.target.classList.toggle('selected')

            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                createHousesButtons(buttonData);
                panelLayout.classList.add('active');
                
                // Disable pointer events on 3D scene when modal opens
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                
                // Pause the game when opening building selection modal
                if (window.game) {
                    window.game.pause();
                }
            } else {
                // Re-enable pointer events on 3D scene when modal closes
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                
                // Resume the game when closing building selection modal
                if (window.game) {
                    window.game.play();
                }
            }

            break;
        case 'farms':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createFarmsButtons(buttonData);
                
                // Disable pointer events on 3D scene when modal opens
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                
                // Pause the game when opening building selection modal
                if (window.game) {
                    window.game.pause();
                }
            } else {
                // Re-enable pointer events on 3D scene when modal closes
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                
                // Resume the game when closing building selection modal
                if (window.game) {
                    window.game.play();
                }
            }
            break;
        case 'markets':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createMarketsStallsButtons(buttonData)
                
                // Disable pointer events on 3D scene when modal opens
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                
                // Pause the game when opening building selection modal
                if (window.game) {
                    window.game.pause();
                }
            } else {
                // Re-enable pointer events on 3D scene when modal closes
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                
                // Resume the game when closing building selection modal
                if (window.game) {
                    window.game.play();
                }
            }
            break;
        case 'others':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createOthersButtons(buttonData)
                
                // Disable pointer events on 3D scene when modal opens
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                
                // Pause the game when opening building selection modal
                if (window.game) {
                    window.game.pause();
                }
            } else {
                // Re-enable pointer events on 3D scene when modal closes
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                
                // Resume the game when closing building selection modal
                if (window.game) {
                    window.game.play();
                }
            }
            break;
        default:
            e.target.classList.toggle('selected')
            panelLayout.classList.remove('active');
            break;
    }
}

function createHousesButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const houseToolIDs = toolIds.houses || [];
    const svg =  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-home">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>`
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => houseToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if(buttonInfo.tool === 'House-2Story') {
                makeNewButton(buttonInfo, svgBigHouse)
            } else {
                makeNewButton(buttonInfo, svg)
            }

        }

    });
}

function createMarketsStallsButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const marketsToolIDs = toolIds.markets || [];

    const svgCloth =  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shirt">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                    </svg>`
    const svgFurniture = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-armchair"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z"/><path d="M5 18v2"/><path d="M19 18v2"/>
                              </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => marketsToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svgCloth)
        }
    });
}

function createFarmsButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const farmToolIDs = toolIds.farms || [];

    const svgCarrot = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-carrot">
                        <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/>
                        <path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>
                    </svg>`
    const svgWheat = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wheat">
                            <path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>
                            <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>
                            <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/>
                            <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                            <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                            <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                        </svg>`
    const svgCabbage = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            class="lucide lucide-leafy-green"><path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/>
                            </svg>`
    const svgFarmTools = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tractor"><path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>
                            </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => farmToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Farm-Carrot') {
                makeNewButton(buttonInfo, svgCarrot);
            } else if (buttonInfo.tool === 'Farm-Wheat') {
                makeNewButton(buttonInfo, svgWheat)
            } else if (buttonInfo.tool === 'Farm-Cabbage') {
                makeNewButton(buttonInfo, svgCabbage)
            } else {
                makeNewButton(buttonInfo, svgFarmTools);
            }
        }
    });
}

function createOthersButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const tombToolIDs = toolIds.tombs || [];

    function makeTumbSVG(color) {
        return `<svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="m19 21v-11c0-3.86599-3.134-7-7-7-3.86599 0-7 3.13401-7 7v11m-2 0h18" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
                </svg>`
    }

    let buttonsDuplicate = [];
    let tumbColors = [{"Tombstone-1": "#000", "Tombstone-2": "#7aee1a", "Tombstone-3": "#f3e90b"}]
    buttonData.filter(buttonInfo => tombToolIDs.includes(buttonInfo.tool)).forEach((buttonInfo, index) => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, makeTumbSVG(tumbColors[0][buttonInfo.tool]));
        }
    });
}

function makeNewButton(buttonInfo, svg="") {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonInfo.tool;
    button.dataset.toolid = buttonInfo.tool;
    button.classList.add('toolbar-btn');
    button.classList.add('panel-btn');

    button.innerHTML = svg;

    button.addEventListener('click', (e) => {
        setActiveTool(e);
    });

    panelLayoutInner.appendChild(button);
    panelLayoutInner.classList.remove('loading-objects')
    loaderButton.classList.remove('active')
}


window.onload = async () => {

    // Root initialization
    const assetManager = new AssetManager();
    let selectedControl = document.getElementById('bulldoze-btn');
    await assetManager.initializeTerrains()
    await assetManager.initializeBuildings('houses')
    await assetManager.initializeBuildings('markets')
    await assetManager.initializeBuildings('farms')
    buttonData = assetManager.getButtonData();
    toolIds = assetManager.getToolIds();
    
    // Create budget elements dynamically if they don't exist
    if (!document.getElementById('budget-btn')) {
        console.log('Creating budget button dynamically...');
        createBudgetElements();
    }

    updateSpeedDisplay();

    for (let i = 0; i < bubblyButtons.length; i++) {
        bubblyButtons[i].addEventListener('click', animateButton, false);
    }

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

    playButton.addEventListener('click', () => {
        pauseOverlay.classList.remove('active')
        
        // Re-enable pointer events on 3D scene when pause overlay closes
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.classList.remove('pointer-events-disabled');
        }
        
        window.game.play()
    })

    pauseButton.addEventListener('click', () => {
        pauseOverlay.classList.add('active')
        
        // Disable pointer events on 3D scene when pause overlay opens
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.classList.add('pointer-events-disabled');
        }
        
        window.game.pause()
    })

    replayButton.addEventListener('click', () => {
        window.game.replay()
    })

    fasterButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        if(speed <= 0) {
            return
        }

        speed -= 500;
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        updateSpeedDisplay();
    });

    slowerButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        speed += 500;
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        updateSpeedDisplay();
    });

    bullDozeButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    selectButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    roadButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    housesButton.addEventListener('click', toggleModal)

    farmsButton.addEventListener('click', toggleModal)

    marketButton.addEventListener('click', toggleModal)

    othersButton.addEventListener('click', toggleModal)

    panelLayoutCloseBtn.addEventListener('click', closeModal)
    
    // Budget panel functionality - get elements directly to avoid timing issues
    const budgetBtn = document.getElementById('budget-btn');
    const budgetPanelEl = document.getElementById('budget-panel');
    const budgetPanelCloseBtnEl = document.querySelector('.budget-panel-close-btn');
    
    console.log('Budget elements found:', {
        button: budgetBtn,
        panel: budgetPanelEl,
        closeBtn: budgetPanelCloseBtnEl
    });
    
    if (budgetBtn) {
        budgetBtn.addEventListener('click', () => {
            console.log('Budget button clicked!');
            console.log('Budget panel element:', budgetPanelEl);
            console.log('Budget panel classes before:', budgetPanelEl.className);
            budgetPanelEl.classList.add('active');
            console.log('Budget panel classes after:', budgetPanelEl.className);
            console.log('Budget panel computed style display:', window.getComputedStyle(budgetPanelEl).display);
            updateBudgetDisplay();
        });
        console.log('Budget button event listener added');
    } else {
        console.warn('Budget button not found in DOM');
        
        // Try again after a short delay
        setTimeout(() => {
            const retryBudgetBtn = document.getElementById('budget-btn');
            const retryBudgetPanelEl = document.getElementById('budget-panel');
            const retryBudgetPanelCloseBtnEl = document.querySelector('.budget-panel-close-btn');
            
            console.log('Retry - Budget elements found:', {
                button: retryBudgetBtn,
                panel: retryBudgetPanelEl,
                closeBtn: retryBudgetPanelCloseBtnEl
            });
            
            if (retryBudgetBtn) {
                retryBudgetBtn.addEventListener('click', () => {
                    console.log('Budget button clicked (retry)!');
                    console.log('Budget panel element (retry):', retryBudgetPanelEl);
                    console.log('Budget panel classes before (retry):', retryBudgetPanelEl.className);
                    retryBudgetPanelEl.classList.add('active');
                    console.log('Budget panel classes after (retry):', retryBudgetPanelEl.className);
                    console.log('Budget panel computed style display (retry):', window.getComputedStyle(retryBudgetPanelEl).display);
                    updateBudgetDisplay();
                });
                console.log('Budget button event listener added on retry');
            }
            
            if (retryBudgetPanelCloseBtnEl) {
                retryBudgetPanelCloseBtnEl.addEventListener('click', () => {
                    retryBudgetPanelEl.classList.remove('active');
                });
            }
            
            if (retryBudgetPanelEl) {
                retryBudgetPanelEl.addEventListener('click', (e) => {
                    if (e.target === retryBudgetPanelEl) {
                        retryBudgetPanelEl.classList.remove('active');
                    }
                });
            }
        }, 1000);
    }
    
    if (budgetPanelCloseBtnEl) {
        budgetPanelCloseBtnEl.addEventListener('click', () => {
            budgetPanelEl.classList.remove('active');
        });
    }
    
    if (budgetPanelEl) {
        // Close budget panel when clicking outside
        budgetPanelEl.addEventListener('click', (e) => {
            if (e.target === budgetPanelEl) {
                budgetPanelEl.classList.remove('active');
            }
        });
    }
    
    window.game = createGame(housesStore, gameStore, assetManager);
    window.setActiveTool = (e) => {
        getButtonsUnactive(e)
        if(e.target.classList.contains('panel-btn')) {
            getButtonsDisabled()
            // For panel buttons (house selection), just close the modal and set the tool
            closeModal();
        } else {
            // For toolbar buttons, toggle the modal
            toggleModal(e)
        }
        selectedControl = e.currentTarget;
        selectedControl.classList.add('selected');
        window.game.setActiveToolId(e.target.dataset.toolid);
    }

    // Initialize real-time budget popup
    initRealtimeBudgetPopup();
}

// Real-time Budget Popup Functions
function initRealtimeBudgetPopup() {
    const realtimeBudgetBtn = document.getElementById('realtime-budget-btn');
    const realtimeBudgetPanel = document.getElementById('realtime-budget-panel');
    const realtimeBudgetCloseBtn = document.querySelector('.realtime-budget-close-btn');
    const realtimeFundsEl = document.getElementById('realtime-funds');

    if (!realtimeBudgetBtn || !realtimeBudgetPanel || !realtimeBudgetCloseBtn || !realtimeFundsEl) {
        console.warn('Real-time budget popup elements not found');
        return;
    }

    // Toggle popup on budget box click
    realtimeBudgetBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        e.preventDefault(); // Prevent default behavior
        
        // Don't open if we're in a modal or other popup context
        if (document.querySelector('.modal.active') || document.querySelector('.info-object-overlay.active')) {
            return;
        }
        
        // Only toggle if clicking directly on the budget box or its children
        if (e.target === realtimeBudgetBtn || realtimeBudgetBtn.contains(e.target)) {
            realtimeBudgetPanel.classList.toggle('active');
            if (realtimeBudgetPanel.classList.contains('active')) {
                // Disable pointer events on 3D scene when budget panel opens
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                updateRealtimeBudget();
            } else {
                // Re-enable pointer events on 3D scene when budget panel closes
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
            }
        }
    });

    // Close popup on close button click
    realtimeBudgetCloseBtn.addEventListener('click', () => {
        realtimeBudgetPanel.classList.remove('active');
        // Re-enable pointer events on 3D scene when budget panel closes
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.classList.remove('pointer-events-disabled');
        }
    });

    // Close popup when clicking outside
    realtimeBudgetPanel.addEventListener('click', (e) => {
        if (e.target === realtimeBudgetPanel) {
            realtimeBudgetPanel.classList.remove('active');
            // Re-enable pointer events on 3D scene when budget panel closes
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
            }
        }
    });

    // Update real-time budget every second when popup is open
    setInterval(() => {
        if (realtimeBudgetPanel.classList.contains('active')) {
            updateRealtimeBudget();
        }
    }, 1000);

    // Close real-time budget popup when other modals are opened
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('modal') || target.classList.contains('info-object-overlay')) {
                    if (target.classList.contains('active') && realtimeBudgetPanel.classList.contains('active')) {
                        realtimeBudgetPanel.classList.remove('active');
                    }
                }
            }
        });
    });

    // Observe modal elements for class changes
    const modalElements = document.querySelectorAll('.modal, .info-object-overlay');
    modalElements.forEach(element => {
        observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    });
}

async function updateRealtimeBudget() {
    const realtimeFundsEl = document.getElementById('realtime-funds');
    if (!realtimeFundsEl) return;

    try {
        if (window.budgetManager) {
            const budgetData = await window.budgetManager.getCurrentBudget();
            const funds = budgetData.funds || 0;
            realtimeFundsEl.textContent = `${funds.toLocaleString('fr-FR')}€`;
            
            // Add visual feedback for low funds
            if (funds < 10) {
                realtimeFundsEl.style.color = '#ff6b6b';
                realtimeFundsEl.style.animation = 'pulse 1s infinite';
            } else if (funds < 50) {
                realtimeFundsEl.style.color = '#ffa726';
                realtimeFundsEl.style.animation = 'pulse 2s infinite';
            } else {
                realtimeFundsEl.style.color = 'var(--cta)';
                realtimeFundsEl.style.animation = 'pulse 2s infinite';
            }
        } else {
            realtimeFundsEl.textContent = 'Chargement...';
            realtimeFundsEl.style.color = 'var(--grey)';
        }
    } catch (error) {
        console.error('Error updating real-time budget:', error);
        realtimeFundsEl.textContent = 'Erreur';
        realtimeFundsEl.style.color = '#ff6b6b';
    }
}