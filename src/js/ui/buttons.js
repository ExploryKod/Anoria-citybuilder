import {
    bullDozeButton,
    displaySpeed,
    speedChangeIndicator,
    farmsButton,
    industryButton,
    fasterButton,
    housesButton,
    palacesButton,
    infrastructureButton,
    infoObjectCloseBtn,
    infoObjectOverlay,
    loaderButton,
    marketButton,
    panelLayout,
    panelLayoutCloseBtn,
    panelLayoutInner,
    pauseButton,
    pauseOverlay,
    playButton,
    replayButton,
    resetButton,
    roadButton,
    selectButton,
    slowerButton,
    toolBarButtons,
    workshopButton
} from "./nodes.js";
import { createGame } from '../game/game.js';
import webglDetector from '../utils/WebGLResourceDetector.js';

// Global app registry helper (available throughout this module)
function appRegister(name, instance) {
    if (window.app && typeof window.app.register === 'function') {
        window.app.register(name, instance);
    } else {
        window[name] = instance;
    }
}
import gameStore from "../stores/GameStore.js";
import { hasRoadAccessFromCount } from '../acl/parcels.js';
import { listSupplyMapBuildings } from '../acl/supply.js';
import { getBalanceSheet } from '../acl/accounting.js';
import {
  getFinancialHealth,
  getTreasurySnapshot,
} from '../acl/accountingGame.js';
import AssetManager from "../meshs/AssetManager.js";
import { initRealtimeBudgetPopup, updateRealtimeBudget } from "./budget/RealtimeBudgetManager.js";
import { initBudgetStatesPopup, refreshBudgetStatesModal } from "./budget/BudgetStatesManager.js";
import { renderBalanceSheet } from "./budget/BalanceSheetPresenter.js";
import { initLoansPopup, updateLoansDisplay, contractLoan, loadActiveLoans, processLoanPayments, initLoanPaymentSystem } from "./loans/LoansManager.js";
import { initJournalPopup, loadJournalEntries, exportJournalToJSON, exportJournalToPDF } from "./journal/JournalManager.js";
import { initFoodTraceabilityPopup, initializeFoodTraceabilityTabs, loadFoodTraceabilityEntries, loadFoodCharts } from "./food-traceability/FoodTraceabilityManager.js";
import { initUrbanAdviceCenter } from "./urban-advice/UrbanAdviceManager.js";

let buttonData;
let toolIds;

function updateSpeedDisplay(changeDirection = '') {
    const speedMs = parseInt(localStorage.getItem('speed'), 10) || 3000;
    
    // Convert milliseconds to a more user-friendly unit
    // Show as "X.Yx" format for speeds (where 1x = 1000ms)
    const speedMultiplier = (1000 / speedMs).toFixed(2);
    
    displaySpeed.textContent = `${speedMultiplier}x`;
    
    // Show or hide the speed change indicator badge
    if (changeDirection) {
        speedChangeIndicator.textContent = changeDirection;
        speedChangeIndicator.classList.add('active');
    } else {
        speedChangeIndicator.classList.remove('active');
    }
}

function createBudgetElements() {
    // Budget elements are now in static HTML, no need to create them dynamically
}

async function updateBudgetDisplay() {
    try {
        const [financialHealth, currentBudget, balanceSheet] = await Promise.all([
            getFinancialHealth(),
            getTreasurySnapshot(),
            getBalanceSheet(),
        ]);

        await renderBalanceSheet({
            balanceSheet,
            turn: currentBudget.turn || 0,
            treasurySnapshot: currentBudget,
        });

        // Update financial health indicator in header
        const healthIndicatorEl = document.getElementById('budget-health-indicator');
        const healthStatusEl = healthIndicatorEl?.querySelector('.health-status');

        if (healthIndicatorEl && healthStatusEl) {
            healthStatusEl.textContent = financialHealth.message;

            healthIndicatorEl.classList.remove('warning', 'critical');

            if (financialHealth.status === 'critical') {
                healthIndicatorEl.classList.add('critical');
            } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
                healthIndicatorEl.classList.add('warning');
            }
        }

        updateRealtimeBudget();
        initBalanceSheetFilters();

    } catch (error) {
        console.error('Error updating budget display:', error);
    }
}

// Initialize balance sheet filters
function initBalanceSheetFilters() {
    const filterButtons = document.querySelectorAll('.balance-filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-filter');
            
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Apply filter
            applyBalanceSheetFilter(filter);
        });
    });
}

// Apply balance sheet filter
function applyBalanceSheetFilter(filter) {
    const actifSection = document.querySelector('.balance-sheet-actif');
    const passifSection = document.querySelector('.balance-sheet-passif');
    const totalActif = document.querySelector('.balance-sheet-total-actif');
    const totalPassif = document.querySelector('.balance-sheet-total-passif');
    
    // Reset all sections to visible
    actifSection?.classList.remove('hidden');
    passifSection?.classList.remove('hidden');
    totalActif?.classList.remove('hidden');
    totalPassif?.classList.remove('hidden');
    
    switch(filter) {
        case 'actif':
            // Show only Actif section
            passifSection?.classList.add('hidden');
            totalPassif?.classList.add('hidden');
            break;
            
        case 'passif':
            // Show only Passif section
            actifSection?.classList.add('hidden');
            totalActif?.classList.add('hidden');
            break;
            
        case 'all':
        default:
            // Show everything (already visible)
            break;
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
    // Get the button element (in case click was on SVG or other child)
    const button = e.target.closest('.toolbar-btn') || e.target;
    const group = button.dataset.group;

    switch(group) {
        case 'residential':
            getButtonsUnactive()
            getButtonsDisabled()
            button.classList.toggle('selected')

            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                createHousesButtons(buttonData);
                panelLayout.classList.add('active');
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
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
                button.classList.toggle('selected')
                createFarmsButtons(buttonData);
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'industry':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createIndustryButtons(buttonData);
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'markets':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createMarketsStallsButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'infrastructure':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createInfrastructureButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'public':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createPublicButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'palaces':
            // Check if palace button is disabled
            if (window.buttonStateManager && !window.buttonStateManager.isEnabled('palace-btn')) {
                console.warn('🏛️ Palace button is disabled');
                return; // Don't open panel if disabled
            }
            
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createPalacesButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'nature':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createNatureButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
                }
            }
            break;
        case 'roads':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createRoadsButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('panel-layout');
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
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => houseToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svg)
        }

    });
}

function createPalacesButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const palaceToolIDs = toolIds.palaces || [];
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`
    let buttonsDuplicate = [];
    const filteredButtons = buttonData.filter(buttonInfo => palaceToolIDs.includes(buttonInfo.tool));
    filteredButtons.forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svgBigHouse)
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
                makeNewButton(buttonInfo, svgCabbage)
            }
        }
    });
}

function createIndustryButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const industryToolIDs = toolIds.industry || [];

    const svgWindmill = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cog"><circle cx="12" cy="12" r="3"/><path d="M12 5L7 7l2 5M12 5l5 2-2 5M7 17l2-5M17 17l-2-5M7 7L2 7l5 10M17 7l5 0-5 10"/></svg>`
    const svgBarn = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>`
    const svgCrate = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
    </svg>`
    
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => industryToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Windmill-001') {
                makeNewButton(buttonInfo, svgWindmill)
            } else if (buttonInfo.tool === 'Barn-001') {
                makeNewButton(buttonInfo, svgBarn)
            } else if (buttonInfo.tool === 'Crate-001') {
                makeNewButton(buttonInfo, svgCrate)
            } else {
                makeNewButton(buttonInfo, svgBarn)
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

function createInfrastructureButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const infrastructureToolIDs = toolIds.infrastructure || [];

    // Réutiliser des SVG existants
    const svgWell = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-droplet"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4.5-4-6.5c-.5 2-1.5 3.9-3 5.5S5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
    const svgFountain = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    const svgStreetlight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lamp"><path d="M8 2h8l4 10H4L8 2Z"/><path d="M12 12v6"/><path d="M8 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H8Z"/></svg>`;

    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => infrastructureToolIDs.includes(buttonInfo.tool) && buttonInfo.tool !== 'StonePath-001').forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Well-001') {
                makeNewButton(buttonInfo, svgWell);
            } else if (buttonInfo.tool === 'Fountain-001') {
                makeNewButton(buttonInfo, svgFountain);
            } else if (buttonInfo.tool === 'Streetlight-001') {
                makeNewButton(buttonInfo, svgStreetlight);
            } else {
                makeNewButton(buttonInfo, svgWell); // Default
            }
        }
    });
}

function createRoadsButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const infrastructureToolIDs = toolIds.infrastructure || [];

    // Different SVG icons for different road types
    const svgRoadStraight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/></svg>`;
    const svgRoadRight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 12 L22 12"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="14" y1="16" x2="16" y2="16"/></svg>`;
    const svgRoadLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 12 L2 12"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="16" x2="6" y2="16"/></svg>`;
    const svgRoadCross = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
    const svgModernRoad = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="10" x2="9" y2="14"/><line x1="15" y1="10" x2="15" y2="14"/></svg>`;

    // Add roads button first (modern road using texture material)
    if (infrastructureToolIDs.includes('roads')) {
        makeNewButton({
            text: 'Modern Road',
            tool: 'roads',
            group: 'Road'
        }, svgModernRoad);
    }

    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => infrastructureToolIDs.includes(buttonInfo.tool) && buttonInfo.tool.startsWith('StonePath-')).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            
            // Choose appropriate icon based on road type
            let svg = svgRoadStraight;
            if (buttonInfo.tool === 'StonePath-Right-001') {
                svg = svgRoadRight;
            } else if (buttonInfo.tool === 'StonePath-Left-001') {
                svg = svgRoadLeft;
            } else if (buttonInfo.tool === 'StonePath-Cross-001') {
                svg = svgRoadCross;
            }
            
            makeNewButton(buttonInfo, svg);
        }
    });
}

function createPublicButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    
    // Check if toolIds is available
    if (!toolIds || !toolIds.public) {
        console.warn('[createPublicButtons] toolIds not initialized or public category missing');
        panelLayoutInner.classList.remove('loading-objects');
        return;
    }
    
    const publicToolIDs = toolIds.public || [];
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`

    let buttonsDuplicate = [];
    let foundChurch = false;
    
    // Filter to only show Church-002 (BookShop-001 will be autonomous button)
    buttonData.filter(buttonInfo => {
        // Check if it's in public category and is Church-002
        return publicToolIDs.includes(buttonInfo.tool) && buttonInfo.tool === 'Church-002';
    }).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Church-002') {
                makeNewButton(buttonInfo, svgBigHouse);
                foundChurch = true;
            }
        }
    });
    
    // If Church-002 not found in buttonData, create it manually from toolIds
    if (!foundChurch && publicToolIDs.includes('Church-002')) {
        console.warn('[createPublicButtons] Church-002 not in buttonData, creating manually');
        makeNewButton({
            text: 'Church',
            tool: 'Church-002',
            group: 'Public'
        }, svgBigHouse);
    }
    
    panelLayoutInner.classList.remove('loading-objects');
}

function createNatureButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const natureToolIDs = toolIds.nature || [];

    const svgTree = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trees">
        <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-2.1-5.2l.3-.3h.2a2.5 2.5 0 0 1 2-4l.4-.4a2 2 0 0 1 2.9-.2 1 1 0 0 0 1.4 0"/>
        <path d="M14 10v.2A3 3 0 0 0 15.1 16H19a3 3 0 0 0 2.1-5.2l-.3-.3h-.2a2.5 2.5 0 0 0-2-4l-.4-.4a2 2 0 0 0-2.9-.2 1 1 0 0 1-1.4 0"/>
        <path d="M12 22v-8"/>
        <path d="M12 2v4"/>
    </svg>`;
    
    const svgBoulder = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mountain">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>`;

    const svgRoad = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-route">
        <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
        <circle cx="18" cy="5" r="3"/>
    </svg>`;

    const filteredButtons = buttonData.filter(buttonInfo => natureToolIDs.includes(buttonInfo.tool));

    let buttonsDuplicate = [];
    filteredButtons.forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Boulder-001') {
                makeNewButton(buttonInfo, svgBoulder);
            } else {
                makeNewButton(buttonInfo, svgTree);
            }
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
        // Check if button is disabled before allowing click
        if (window.buttonStateManager && window.buttonStateManager.isEnabled(buttonInfo.tool)) {
            setActiveTool(e);
        }
    });

    panelLayoutInner.appendChild(button);
    panelLayoutInner.classList.remove('loading-objects')
    loaderButton.classList.remove('active')
    
    // Register button with ButtonStateManager if available
    if (window.buttonStateManager) {
        window.buttonStateManager.registerButton(buttonInfo.tool, button);
    }
}


// Function to show city size selection modal and return selected size and multiplayer mode
function showCitySizeSelection() {
    return new Promise((resolve) => {
        const modal = document.getElementById('city-size-selection-modal');
        const options = modal?.querySelectorAll('.city-size-option');
        const customInput = modal?.querySelector('#custom-city-size');
        const customButton = modal?.querySelector('#custom-size-apply');
        const messageEl = modal?.querySelector('.city-size-selection-message');
        const multiplayerToggle = modal?.querySelector('#multiplayer-toggle');
        
        if (!modal || !options) {
            // Fallback: return default size if modal doesn't exist
            resolve({ size: 16, multiplayer: false });
            return;
        }
        
        // Detect WebGL capabilities (doit être fait en premier)
        const webglCapabilities = webglDetector.detectCapabilities();
        const maxSafeCitySize = webglDetector.getMaxSafeCitySize();
        
        // Check if mobile device (used throughout the function)
        const isMobile = window.innerWidth <= 1024;
        // In test mode, allow larger sizes to test detection
        const testMode = localStorage.getItem('webgl-test-mode');
        const theoreticalMaxSize = testMode ? (isMobile ? 18 : 24) : (isMobile ? 16 : 18);
        // Use the lower of theoretical max or WebGL-safe max
        const maxSize = Math.min(theoreticalMaxSize, maxSafeCitySize);
        
        // Fonction pour activer/désactiver les options solo (définie AVANT utilisation)
        const toggleSoloOptions = (enabled) => {
            const optionsContainer = modal?.querySelector('.city-size-options');
            const customContainer = modal?.querySelector('.city-size-custom');
            
            if (enabled) {
                // Réactiver les options solo - les afficher
                options.forEach(option => {
                    option.style.pointerEvents = '';
                    option.style.opacity = option.disabled ? '0.5' : '1';
                    option.style.cursor = option.disabled ? 'not-allowed' : 'pointer';
                    option.style.display = '';
                });
                if (optionsContainer) {
                    optionsContainer.classList.remove('disabled');
                    optionsContainer.style.display = '';
                }
                if (customContainer) {
                    customContainer.classList.remove('disabled');
                    customContainer.style.display = '';
                }
                if (customInput) {
                    customInput.disabled = false;
                    customButton.disabled = false;
                }
            } else {
                // Désactiver les options solo - les masquer complètement
                options.forEach(option => {
                    option.style.pointerEvents = 'none';
                    option.style.display = 'none';
                });
                if (optionsContainer) {
                    optionsContainer.classList.add('disabled');
                    optionsContainer.style.display = 'none';
                }
                if (customContainer) {
                    customContainer.classList.add('disabled');
                    customContainer.style.display = 'none';
                }
                if (customInput) {
                    customInput.disabled = true;
                    customButton.disabled = true;
                }
            }
        }
        
        // Restaurer l'état multijoueur sauvegardé (par défaut: solo)
        const savedMultiplayer = localStorage.getItem('multiplayer-enabled') === 'true';
        const savedPseudo = localStorage.getItem('multiplayer-pseudo') || '';
        const savedRoomName = localStorage.getItem('multiplayer-room-name') || '';
        const pseudoContainer = modal?.querySelector('#multiplayer-pseudo-container');
        const pseudoInput = modal?.querySelector('#multiplayer-pseudo');
        const roomNameContainer = modal?.querySelector('#multiplayer-room-name-container');
        const roomNameInput = modal?.querySelector('#multiplayer-room-name');
        
        // Configurer le toggle multijoueur (démarre en mode solo par défaut)
        if (multiplayerToggle) {
            multiplayerToggle.checked = savedMultiplayer;
            // Afficher/masquer les champs multijoueur
            if (pseudoContainer) {
                pseudoContainer.style.display = savedMultiplayer ? 'block' : 'none';
            }
            if (roomNameContainer) {
                roomNameContainer.style.display = savedMultiplayer ? 'block' : 'none';
            }
            if (pseudoInput && savedPseudo) {
                pseudoInput.value = savedPseudo;
            }
            if (roomNameInput && savedRoomName) {
                roomNameInput.value = savedRoomName;
            }
            
            // Toggle du mode multijoueur
            multiplayerToggle.addEventListener('change', () => {
                const isMultiplayer = multiplayerToggle.checked;
                const multiplayerSection = modal?.querySelector('#multiplayer-section');
                
                // Afficher/masquer toute la section multijoueur
                if (multiplayerSection) {
                    multiplayerSection.style.display = isMultiplayer ? 'block' : 'none';
                }
                
                if (isMultiplayer) {
                    // Charger les salons disponibles
                    loadAvailableRooms(modal, maxSafeCitySize);
                }
                
                // Désactiver/activer les options solo selon le mode
                toggleSoloOptions(!isMultiplayer);
            });
            
            // Initialiser l'affichage de la section multijoueur
            const multiplayerSection = modal?.querySelector('#multiplayer-section');
            if (multiplayerSection) {
                multiplayerSection.style.display = savedMultiplayer ? 'block' : 'none';
            }
            
            // Initialiser l'état des options solo (par défaut: solo activé)
            toggleSoloOptions(!savedMultiplayer);
        }
        
        // Fonction pour charger et afficher les salons disponibles
        const loadAvailableRooms = async (modal, maxSafeCitySizeParam) => {
            const maxSafeCitySizeToUse = maxSafeCitySizeParam;
            const roomsList = modal?.querySelector('#multiplayer-rooms-list');
            if (!roomsList) return;
            
            roomsList.innerHTML = '<div class="multiplayer-rooms-loading">Chargement des salons...</div>';
            
            try {
                // Importer la configuration WebSocket
                const getWebSocketUrl = (await import('../../config/websocket.js')).default;
                const wsUrl = getWebSocketUrl();
                
                // Se connecter temporairement au WebSocket pour recevoir la liste des salons
                const ws = new WebSocket(wsUrl);
                let roomsReceived = false;
                let connectionClosed = false;
                
                const timeout = setTimeout(() => {
                    if (!roomsReceived && !connectionClosed) {
                        connectionClosed = true;
                        ws.close();
                        // Afficher un message mais permettre quand même de créer un salon
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
                    }
                }, 3000);
                
                ws.onopen = () => {
                    // La liste sera envoyée automatiquement par le serveur
                };
                
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'AVAILABLE_ROOMS') {
                            roomsReceived = true;
                            connectionClosed = true;
                            clearTimeout(timeout);
                            displayRooms(roomsList, data.rooms, maxSafeCitySizeToUse, modal);
                            // Ne pas fermer immédiatement, attendre un peu pour recevoir d'autres mises à jour
                            setTimeout(() => {
                                if (ws.readyState === WebSocket.OPEN) {
                                    ws.close();
                                }
                            }, 1000);
                        }
                    } catch (error) {
                        console.error('[Rooms] Erreur parsing:', error);
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('[Rooms] Erreur WebSocket:', error);
                    if (!connectionClosed) {
                        connectionClosed = true;
                        clearTimeout(timeout);
                        // Afficher un message mais permettre quand même de créer un salon
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
                    }
                };
                
                ws.onclose = () => {
                    connectionClosed = true;
                };
            } catch (error) {
                console.error('[Rooms] Erreur:', error);
                // Afficher un message mais permettre quand même de créer un salon
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Erreur de connexion. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
            }
        };
        
        // Fonction pour afficher les salons
        const displayRooms = (roomsList, rooms, maxSafeCitySize, modal) => {
            if (!rooms || rooms.length === 0) {
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Aucun salon disponible. Créez-en un en choisissant une taille ci-dessus.</div>';
                return;
            }
            
            roomsList.innerHTML = '';
            rooms.forEach(room => {
                const roomEl = document.createElement('div');
                const isCompatible = room.citySize <= maxSafeCitySize;
                const isFull = room.currentPlayers >= room.maxPlayers;
                
                roomEl.className = `multiplayer-room-item ${!isCompatible ? 'room-incompatible' : ''} ${isFull ? 'room-full' : ''}`;
                const roomDisplayName = room.roomName || `Salon ${room.citySize}×${room.citySize}`;
                roomEl.innerHTML = `
                    <div class="room-info">
                        <div class="room-name">${roomDisplayName}</div>
                        <div class="room-details">
                            <div class="room-size">${room.citySize} × ${room.citySize}</div>
                            <div class="room-players">${room.currentPlayers}/${room.maxPlayers} joueurs</div>
                        </div>
                    </div>
                    ${!isCompatible ? '<div class="room-warning">⚠️ Taille non compatible avec votre système</div>' : ''}
                    ${isFull ? '<div class="room-status">Plein</div>' : '<button class="room-join-btn" data-room-id="${room.id}" data-city-size="${room.citySize}">Rejoindre</button>'}
                `;
                
                // Toujours afficher le salon, même s'il est plein ou incompatible
                // Mais seulement permettre de rejoindre si compatible et pas plein
                if (!isFull && isCompatible) {
                    const joinBtn = roomEl.querySelector('.room-join-btn');
                    joinBtn.addEventListener('click', () => {
                        const playerPseudo = pseudoInput ? (pseudoInput.value.trim() || 'Joueur' + Math.floor(Math.random() * 1000)) : 'Joueur';
                        // Fermer la modale et résoudre avec les paramètres du salon
                        modal.classList.remove('active');
                        const chronosLoader = document.getElementById('chronos-loader-modal');
                        if (chronosLoader) {
                            chronosLoader.classList.remove('hidden');
                            chronosLoader.classList.add('opaque');
                        }
                        setTimeout(() => resolve({
                            size: room.citySize,
                            multiplayer: true,
                            pseudo: playerPseudo,
                            roomId: room.id,
                            action: 'join'
                        }), 300);
                    });
                } else if (isFull) {
                    // Salon plein - désactiver visuellement mais toujours afficher
                    const statusEl = roomEl.querySelector('.room-status');
                    if (statusEl) {
                        statusEl.style.fontWeight = '600';
                        statusEl.style.color = '#999';
                    }
                } else if (!isCompatible) {
                    // Salon incompatible - afficher mais avec avertissement
                    const warningEl = roomEl.querySelector('.room-warning');
                    if (warningEl) {
                        warningEl.style.fontWeight = '600';
                    }
                }
                
                roomsList.appendChild(roomEl);
            });
        };
        
        // Charger les salons si le mode multijoueur est déjà activé
        if (savedMultiplayer) {
            const roomsContainer = modal?.querySelector('#multiplayer-rooms-container');
            if (roomsContainer) {
                roomsContainer.style.display = 'block';
                loadAvailableRooms(modal, maxSafeCitySize);
            }
        }
        
        // Configurer les boutons de création de salon
        const createRoomButtons = modal?.querySelectorAll('.multiplayer-create-room-btn');
        if (createRoomButtons) {
            createRoomButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!multiplayerToggle || !multiplayerToggle.checked) {
                        return;
                    }
                    const size = parseInt(btn.dataset.size, 10);
                    // Vérifier la compatibilité WebGL
                    if (size > maxSafeCitySize) {
                        alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                        return;
                    }
                    createRoom(size);
                });
            });
        }
        
        // Update modal message if system has limitations
        if (messageEl && (webglCapabilities.issues?.length > 0 || webglCapabilities.warnings?.length > 0)) {
            const originalMessage = messageEl.innerHTML;
            let warningText = '';
            if (maxSafeCitySize < theoreticalMaxSize) {
                warningText = `<br><br><strong style="color: #ff9800;">⚠️ Limitation système détectée:</strong> `;
                warningText += `Votre système a des ressources WebGL limitées. `;
                warningText += `Taille maximale recommandée: <strong>${maxSafeCitySize} × ${maxSafeCitySize}</strong>. `;
                if (webglCapabilities.issues?.length > 0) {
                    warningText += `Les tailles supérieures peuvent causer des problèmes de performance ou des erreurs.`;
                }
            }
            messageEl.innerHTML = originalMessage + warningText;
        }
        
        // Helper function to select a size and close modal (SOLO uniquement)
        const selectSize = (size) => {
            // Vérifier que le mode multijoueur n'est pas activé
            if (multiplayerToggle && multiplayerToggle.checked) {
                console.warn('[CitySize] Tentative de sélection solo alors que multijoueur est activé');
                return;
            }
            
            // Clamp size to valid range based on device type
            size = Math.max(12, Math.min(maxSize, size));
            
            // Remove selected class from all options
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Check if it matches a preset option
            const matchingOption = Array.from(options).find(opt => 
                parseInt(opt.dataset.size, 10) === size
            );
            
            if (matchingOption) {
                matchingOption.classList.add('selected');
            } else {
                // Custom size - update input value
                if (customInput) {
                    customInput.value = size;
                }
            }
            
            // Save to localStorage (mode solo)
            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'false');
            
            // Hide modal
            modal.classList.remove('active');
            
            // Show chronos loader
            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }
            
            // Resolve with selected size (solo)
            setTimeout(() => resolve({ 
                size, 
                multiplayer: false,
                pseudo: null,
                roomId: null,
                action: 'solo'
            }), 300); // Small delay for animation
        };
        
        // Fonction pour créer un salon en mode multijoueur
        const createRoom = (size) => {
            if (!multiplayerToggle || !multiplayerToggle.checked) {
                console.warn('[CitySize] Tentative de créer un salon alors que multijoueur n\'est pas activé');
                return;
            }
            
            const playerPseudo = pseudoInput ? (pseudoInput.value.trim() || 'Joueur' + Math.floor(Math.random() * 1000)) : 'Joueur';
            const roomName = roomNameInput ? roomNameInput.value.trim() : '';
            
            // Clamp size to valid range
            size = Math.max(12, Math.min(maxSize, size));
            
            // Save to localStorage
            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'true');
            localStorage.setItem('multiplayer-pseudo', playerPseudo);
            if (roomName) {
                localStorage.setItem('multiplayer-room-name', roomName);
            }
            
            // Hide modal
            modal.classList.remove('active');
            
            // Show chronos loader
            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }
            
            // Resolve with selected size for creating a room
            setTimeout(() => resolve({ 
                size, 
                multiplayer: true,
                pseudo: playerPseudo,
                roomId: null,
                roomName: roomName || null,
                action: 'create'
            }), 300);
        };
        
        // Check if user has a saved preference
        const savedSize = parseInt(localStorage.getItem('selectedCitySize'), 10);
        const minSize = 12;
        
        if (savedSize && savedSize >= minSize && savedSize <= maxSize) {
            // Pre-select the saved size (clamp to mobile max if needed)
            const clampedSize = Math.min(savedSize, maxSize);
            const matchingOption = Array.from(options).find(opt => 
                parseInt(opt.dataset.size, 10) === clampedSize
            );
            if (matchingOption) {
                matchingOption.classList.add('selected');
            } else if (customInput && !isMobile) {
                customInput.value = clampedSize;
            }
        } else {
            // Default to 16 on mobile, 24 on desktop
            const defaultSize = isMobile ? 16 : 24;
            const defaultOption = Array.from(options).find(opt => parseInt(opt.dataset.size, 10) === defaultSize);
            if (defaultOption) {
                defaultOption.classList.add('selected');
            }
        }
        
        // Update option buttons based on WebGL capabilities
        options.forEach(option => {
            const size = parseInt(option.dataset.size, 10);
            const isSafe = size <= maxSafeCitySize;
            
            if (!isSafe) {
                // Disable options that exceed system capabilities
                option.disabled = true;
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';
                option.title = `Cette taille dépasse les capacités de votre système (max: ${maxSafeCitySize}×${maxSafeCitySize})`;
                
                // Add warning indicator
                const label = option.querySelector('.city-size-label');
                if (label && !label.querySelector('.webgl-warning')) {
                    const warning = document.createElement('span');
                    warning.className = 'webgl-warning';
                    warning.textContent = ' ⚠️';
                    warning.style.color = '#ff9800';
                    label.appendChild(warning);
                }
            } else {
                option.disabled = false;
                option.style.opacity = '1';
                option.style.cursor = 'pointer';
                option.title = '';
                
                // Remove warning indicator if present
                const warning = option.querySelector('.webgl-warning');
                if (warning) {
                    warning.remove();
                }
            }
        });
        
        // Handle preset option clicks
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Vérifier si le mode multijoueur est activé
                if (multiplayerToggle && multiplayerToggle.checked) {
                    // En mode multijoueur, on ne peut pas utiliser les options solo
                    alert('En mode multijoueur, vous devez créer ou rejoindre un salon. Désactivez le mode multijoueur pour jouer en solo.');
                    return;
                }
                
                if (option.disabled) {
                    // Show alert if user tries to select disabled option
                    const size = parseInt(option.dataset.size, 10);
                    alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                    return;
                }
                const size = parseInt(option.dataset.size, 10);
                // Mode solo uniquement
                selectSize(size);
            });
        });
        
        // Handle custom input
        if (customInput && customButton) {
            // Update input when preset is selected
            options.forEach(option => {
                option.addEventListener('click', () => {
                    customInput.value = parseInt(option.dataset.size, 10);
                });
            });
            
            // Handle apply button
            customButton.addEventListener('click', () => {
                // Vérifier si le mode multijoueur est activé
                if (multiplayerToggle && multiplayerToggle.checked) {
                    // En mode multijoueur, on ne peut pas utiliser l'input personnalisé solo
                    alert('En mode multijoueur, vous devez créer ou rejoindre un salon. Désactivez le mode multijoueur pour jouer en solo.');
                    return;
                }
                
                const customSize = parseInt(customInput.value, 10);
                    if (!isNaN(customSize) && customSize >= 12 && customSize <= maxSize) {
                        // Check if size is safe for WebGL
                        const safetyCheck = webglDetector.isCitySizeSafe(customSize);
                        if (!safetyCheck.safe) {
                            const proceed = confirm(`${safetyCheck.reason}\n\nVoulez-vous continuer quand même? (Non recommandé)`);
                            if (!proceed) {
                                customInput.value = maxSafeCitySize;
                                customInput.focus();
                                return;
                            }
                        }
                        // Mode solo uniquement
                        selectSize(customSize);
                } else {
                    alert(`Veuillez entrer une taille entre 12 et ${maxSize}${maxSize < theoreticalMaxSize ? ` (limité par les capacités de votre système)` : ''}.`);
                    customInput.focus();
                }
            });
            
            // Update input max attribute
            if (customInput) {
                customInput.max = maxSize;
                customInput.setAttribute('max', maxSize.toString());
            }
            
            // Handle Enter key in input
            customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    customButton.click();
                }
            });
        }
    });
}

window.onload = async () => {

    // Root initialization
    const assetManager = new AssetManager();
    let selectedControl = document.getElementById('bulldoze-btn');
    
    // OPTIMIZATION: Break up asset loading into smaller chunks to reduce TBT
    // Load critical assets first, then defer the rest
    await assetManager.initializeTerrains();
    
    // OPTIMIZATION: Use requestIdleCallback to defer house loading slightly
    // This prevents blocking the main thread for too long (>50ms chunks)
    const loadHouses = async () => {
        await assetManager.initializeBuildings('houses'); // Critical for gameplay
    };
    
    // Load houses in next idle period to reduce TBT
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadHouses, { timeout: 500 });
    } else {
        setTimeout(loadHouses, 0);
    }
    
    // OPTIMIZATION: Defer non-critical assets using requestIdleCallback
    // This prevents blocking the main thread during initial load
    const loadNonCriticalAssets = () => {
        Promise.all([
            assetManager.initializeBuildings('palaces'),
            assetManager.initializeBuildings('markets'),
            assetManager.initializeBuildings('farms'),
            assetManager.initializeBuildings('industry'),  // Includes crates now
            assetManager.initializeBuildings('infrastructure'),
            assetManager.initializeBuildings('public'),
            assetManager.initializeBuildings('nature'),
            assetManager.initializeBuildings('workshop')
        ]).catch(() => {
            // Silently fail - assets will load when needed
        });
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadNonCriticalAssets, { timeout: 3000 });
    } else {
        setTimeout(loadNonCriticalAssets, 500);
    }
    
    // OPTIMIZATION: Defer UI initialization to reduce TBT
    // These operations can wait until browser is idle
    const initUI = () => {
        buttonData = assetManager.getButtonData();
        toolIds = assetManager.getToolIds();
        
        // Create budget elements dynamically if they don't exist
        if (!document.getElementById('budget-btn')) {
            createBudgetElements();
        }

        updateSpeedDisplay();
    };
    
    // Defer UI initialization to reduce TBT
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(initUI, { timeout: 1000 });
    } else {
        setTimeout(initUI, 100);
    }
    
    // Initialize button states for game start
    if (window.buttonStateManager) {
        // Register category buttons
        const palaceBtn = document.getElementById('palace-btn');
        if (palaceBtn) {
            window.buttonStateManager.registerButton('palace-btn', palaceBtn);
        }
        
        const infrastructureBtn = document.getElementById('infrastructure-btn');
        if (infrastructureBtn) {
            window.buttonStateManager.registerButton('infrastructure-btn', infrastructureBtn);
        }
        
        const workshopBtn = document.getElementById('workshop-btn');
        if (workshopBtn) {
            window.buttonStateManager.registerButton('workshop-btn', workshopBtn);
        }
        
        // Disable initial unavailable buildings
        // All buttons are now enabled by default
        // Disable functionality is kept for future use
        const initialDisabledBuildings = [
            // Empty array - all buttons enabled
        ];
        
        initialDisabledBuildings.forEach(buildingId => {
            const button = document.getElementById(buildingId);
            if (button) {
                window.buttonStateManager.disable(buildingId);
            } else {
                console.warn(`⚠️ Button ${buildingId} not found in DOM, will be disabled when created`);
            }
        });
    } else {
        console.warn('⚠️ ButtonStateManager not available');
    }

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
            
            // Re-enable OrbitControls when modal closes
            // Try to access scene through various paths
            let sceneObj = null;
            if (window.game && window.game.scene) {
                sceneObj = window.game.scene;
            } else if (window.scene) {
                sceneObj = window.scene;
            } else if (window.app && window.app.game && window.app.game.scene) {
                sceneObj = window.app.game.scene;
            }
            if (sceneObj && sceneObj.controls) {
                sceneObj.controls.enabled = true;
            }
            if (sceneObj && sceneObj.suppressInput) {
                sceneObj.suppressInput(200);
            }
            
            window.game.play()
        }
    })

    playButton.addEventListener('click', () => {
        pauseOverlay.classList.remove('active')
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('pause-overlay');
        }
        
        window.game.play()
    })

    pauseButton.addEventListener('click', () => {
        pauseOverlay.classList.add('active')
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('pause-overlay');
        }
        
        window.game.pause()
    })

    replayButton.addEventListener('click', () => {
        window.game.replay()
    })

    resetButton.addEventListener('click', () => {
        // Show confirmation modal
        showResetConfirmModal();
    })

    // Function to show reset confirmation modal
    function showResetConfirmModal() {
        const modal = document.getElementById('reset-confirm-panel');
        if (!modal) {
            console.error('Reset confirm panel not found');
            return;
        }
        
        // Prevent duplicate listeners
        if (modal.classList.contains('listeners-attached')) {
            modal.classList.add('visible');
            return;
        }
        
        modal.classList.add('visible');
        modal.classList.add('listeners-attached');
        
        // Get buttons
        const cancelBtn = modal.querySelector('.reset-confirm-cancel-btn');
        const resetBtn = modal.querySelector('.reset-confirm-reset-btn');
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
        });
        
        // Reset button
        resetBtn.addEventListener('click', async () => {
            modal.classList.remove('visible');
            await performReset();
        });
        
        // Close on Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) {
                modal.classList.remove('visible');
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Reset localStorage completely - this is the single place where localStorage is cleared
     * Removes all items individually first, then calls clear() to ensure complete cleanup
     */
    function resetLocalStorage() {
        // Remove all items individually first to ensure complete cleanup
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        // Then clear all remaining items
        localStorage.clear();
    }

    // Function to perform the actual reset
    async function performReset() {
        // Hard reload - unregister service worker and clear caches
        try {
            // Unregister service worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            
            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }
            
            // Clear localStorage completely - using dedicated function
            resetLocalStorage();
            
            // Clear IndexedDB - for all databases
            if ('indexedDB' in window) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                        }
                    });
                });
            }
            
            // Small delay to ensure localStorage clear is fully processed before reload
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Reload the page
            window.location.reload(true);
        } catch (error) {
            console.error('Error during reset:', error);
            // Fallback: just reload
            window.location.reload(true);
        }
    }

    fasterButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        const previousSpeed = speed;
        
        // Apply speed limits: minimum 500ms, maximum 20,000ms
        speed = Math.max(500, speed - 500);
        
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        
        // Show '+' indicator badge if speed actually changed
        const changeDirection = (speed !== previousSpeed) ? '+' : '';
        updateSpeedDisplay(changeDirection);
        
        // Hide indicator after 1 second
        if (changeDirection) {
            setTimeout(() => {
                speedChangeIndicator.classList.remove('active');
            }, 1000);
        }
    });

    slowerButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        const previousSpeed = speed;
        
        // Apply speed limits: minimum 500ms, maximum 20,000ms
        speed = Math.min(20000, speed + 500);
        
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        
        // Show '−' indicator badge if speed actually changed
        const changeDirection = (speed !== previousSpeed) ? '−' : '';
        updateSpeedDisplay(changeDirection);
        
        // Hide indicator after 1 second
        if (changeDirection) {
            setTimeout(() => {
                speedChangeIndicator.classList.remove('active');
            }, 1000);
        }
    });

    bullDozeButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    selectButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    if (roadButton) {
        roadButton.addEventListener('click', (e) => {
            setActiveTool(e);
        });
    }

    housesButton.addEventListener('click', (e) => {
        if (window.setActiveTool) {
            window.setActiveTool(e);
        }
    })
    
    palacesButton.addEventListener('click', (e) => {
        // Check if palace button is disabled before toggling modal
        if (window.buttonStateManager && !window.buttonStateManager.isEnabled('palace-btn')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        toggleModal(e);
    })

    farmsButton.addEventListener('click', toggleModal)
    
    industryButton.addEventListener('click', toggleModal)

    marketButton.addEventListener('click', (e) => {
        if (window.setActiveTool) {
            window.setActiveTool(e);
        }
    })
    
    infrastructureButton.addEventListener('click', (e) => {
        // Check if infrastructure button is disabled before toggling modal
        if (window.buttonStateManager && !window.buttonStateManager.isEnabled('infrastructure-btn')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        toggleModal(e);
    })
    
    const bookshopButton = document.getElementById('bookshop-btn');
    if (bookshopButton) {
        bookshopButton.addEventListener('click', (e) => {
            if (window.setActiveTool) {
                window.setActiveTool(e);
            }
        });
    }

    if (workshopButton) {
        workshopButton.addEventListener('click', (e) => {
            if (window.setActiveTool) {
                window.setActiveTool(e);
            }
        });
    }

    const natureButton = document.getElementById('nature-btn');
    if (natureButton) {
        natureButton.addEventListener('click', toggleModal);
    }

    panelLayoutCloseBtn.addEventListener('click', closeModal)
    
    // Legend dropdown functionality
    const legendToggle = document.getElementById('legend-toggle');
    const legendDropdown = document.getElementById('legend-dropdown');
    const commandToggle = document.getElementById('command-toggle');
    const commandDropdown = document.getElementById('command-dropdown');
    const financeToggle = document.getElementById('finance-toggle');
    const financeDropdown = document.getElementById('finance-dropdown');
    
    if (legendToggle && legendDropdown) {
        legendToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = legendDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (commandDropdown && !commandDropdown.classList.contains('hidden')) {
                commandDropdown.classList.add('hidden');
            }
            if (financeDropdown && !financeDropdown.classList.contains('hidden')) {
                financeDropdown.classList.add('hidden');
            }
            
            // Toggle legend dropdown
            if (isCurrentlyHidden) {
                legendDropdown.classList.remove('hidden');
            } else {
                legendDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.legend-dropdown-container')) {
                legendDropdown.classList.add('hidden');
            }
        });
    }

    // Finance dropdown functionality
    if (financeToggle && financeDropdown) {
        financeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = financeDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (legendDropdown && !legendDropdown.classList.contains('hidden')) {
                legendDropdown.classList.add('hidden');
            }
            if (commandDropdown && !commandDropdown.classList.contains('hidden')) {
                commandDropdown.classList.add('hidden');
            }
            
            // Toggle finance dropdown
            if (isCurrentlyHidden) {
                financeDropdown.classList.remove('hidden');
            } else {
                financeDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.finance-dropdown-container')) {
                financeDropdown.classList.add('hidden');
            }
        });
    }
    
    // Command dropdown functionality
    if (commandToggle && commandDropdown) {
        commandToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = commandDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (legendDropdown && !legendDropdown.classList.contains('hidden')) {
                legendDropdown.classList.add('hidden');
            }
            if (financeDropdown && !financeDropdown.classList.contains('hidden')) {
                financeDropdown.classList.add('hidden');
            }
            
            // Toggle command dropdown
            if (isCurrentlyHidden) {
                commandDropdown.classList.remove('hidden');
            } else {
                commandDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.command-dropdown-container')) {
                commandDropdown.classList.add('hidden');
            }
        });
    }
    
    // Mobile toolbar/camera toggle functionality
    const toolbarMobileToggle = document.getElementById('toolbar-mobile-toggle');
    const mobileControlsToggle = document.getElementById('mobile-controls-toggle');
    const toolbarElement = document.getElementById('toolbar');
    const mobileControlsElement = document.getElementById('mobile-camera-controls');
    const narrowToolbarQuery = window.matchMedia('(max-width: 768px)');
    const landscapeToolbarQuery = window.matchMedia('(max-width: 1024px) and (orientation: landscape)');

    const closeMobileToolbar = () => {
        if (!toolbarElement) return;
        toolbarElement.classList.remove('mobile-visible');
        toolbarElement.classList.add('mobile-hidden');
        if (toolbarMobileToggle) {
            toolbarMobileToggle.classList.remove('active');
            toolbarMobileToggle.setAttribute('aria-pressed', 'false');
        }
    };

    const closeMobileControls = () => {
        if (!mobileControlsElement) return;
        mobileControlsElement.classList.remove('mobile-visible');
        mobileControlsElement.classList.add('mobile-hidden');
        if (mobileControlsToggle) {
            mobileControlsToggle.classList.remove('active');
            mobileControlsToggle.setAttribute('aria-pressed', 'false');
        }
    };

    const isMobileViewport = () => {
        return narrowToolbarQuery.matches || landscapeToolbarQuery.matches;
    };

    const applyToolbarResponsiveState = () => {
        if (!toolbarElement) return;
        if (isMobileViewport()) {
            if (!toolbarElement.classList.contains('mobile-visible')) {
                toolbarElement.classList.add('mobile-hidden');
            }
        } else {
            toolbarElement.classList.remove('mobile-hidden');
            toolbarElement.classList.remove('mobile-visible');
            if (toolbarMobileToggle) {
                toolbarMobileToggle.classList.remove('active');
                toolbarMobileToggle.setAttribute('aria-pressed', 'false');
            }
        }
    };

    const applyMobileControlsResponsiveState = () => {
        if (!mobileControlsElement) return;
        if (isMobileViewport()) {
            if (!mobileControlsElement.classList.contains('mobile-visible')) {
                mobileControlsElement.classList.add('mobile-hidden');
            }
        } else {
            mobileControlsElement.classList.remove('mobile-hidden');
            mobileControlsElement.classList.remove('mobile-visible');
            if (mobileControlsToggle) {
                mobileControlsToggle.classList.remove('active');
                mobileControlsToggle.setAttribute('aria-pressed', 'false');
            }
        }
    };

    if (toolbarMobileToggle && toolbarElement) {
        toolbarMobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobileViewport()) {
                // On desktop, no need to toggle manually
                return;
            }
            const willShow = !toolbarElement.classList.contains('mobile-visible');
            if (willShow) {
                toolbarElement.classList.add('mobile-visible');
                toolbarElement.classList.remove('mobile-hidden');
            } else {
                closeMobileToolbar();
            }
            toolbarMobileToggle.classList.toggle('active', willShow);
            toolbarMobileToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
        });
    }

    document.addEventListener('click', (e) => {
        if (!toolbarElement || !toolbarElement.classList.contains('mobile-visible')) {
            return;
        }
        if (!isMobileViewport()) {
            return;
        }
        if (!e.target.closest('#toolbar') && !e.target.closest('#toolbar-mobile-toggle')) {
            closeMobileToolbar();
        }
    });

    // Make toolbar draggable on mobile only
    const toolbarDragHeader = document.getElementById('toolbarheader');
    if (toolbarDragHeader && toolbarElement) {
        // Function to make element draggable (adapted from W3Schools)
        function dragElement(elmnt) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            // Helper function to check if target is a button or interactive element
            function isInteractiveElement(target) {
                if (!target) return false;
                // Check if it's a button, link, or inside a button container
                return target.tagName === 'BUTTON' ||
                       target.tagName === 'A' ||
                       target.closest('.toolbar-btn') !== null ||
                       target.closest('.toolbar__buttons') !== null ||
                       target.closest('.toolbar__container') !== null;
            }

            // Handle icon can always drag
            if (toolbarDragHeader) {
                toolbarDragHeader.onmousedown = dragMouseDown;
                toolbarDragHeader.ontouchstart = dragTouchStart;
            }

            // Allow dragging from anywhere on toolbar except buttons
            elmnt.addEventListener('mousedown', (e) => {
                // Don't drag if clicking on a button or interactive element
                if (isInteractiveElement(e.target)) return;
                dragMouseDown(e);
            });

            elmnt.addEventListener('touchstart', (e) => {
                // Don't drag if touching a button or interactive element
                if (isInteractiveElement(e.target)) return;
                dragTouchStart(e);
            });

            function dragMouseDown(e) {
                e.preventDefault();
                e.stopPropagation();
                // Get the mouse cursor position at startup
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                // Call a function whenever the cursor moves
                document.onmousemove = elementDrag;
            }

            function dragTouchStart(e) {
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches[0];
                pos3 = touch.clientX;
                pos4 = touch.clientY;
                document.ontouchend = closeDragElement;
                document.ontouchmove = elementDragTouch;
            }

            function elementDrag(e) {
                e.preventDefault();
                // Calculate the new cursor position
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                // Get actual visual position (accounting for transform)
                const rect = elmnt.getBoundingClientRect();
                // Set the element's new position relative to viewport
                const newTop = (rect.top - pos2);
                const newLeft = (rect.left - pos1);
                elmnt.style.top = newTop + "px";
                elmnt.style.left = newLeft + "px";
                // Remove transform, bottom, and percentage-based positioning to allow manual positioning
                elmnt.style.transform = "none";
                elmnt.style.bottom = "auto";
            }

            function elementDragTouch(e) {
                e.preventDefault();
                const touch = e.touches[0];
                // Calculate the new touch position
                pos1 = pos3 - touch.clientX;
                pos2 = pos4 - touch.clientY;
                pos3 = touch.clientX;
                pos4 = touch.clientY;
                // Get actual visual position (accounting for transform)
                const rect = elmnt.getBoundingClientRect();
                // Set the element's new position relative to viewport
                const newTop = (rect.top - pos2);
                const newLeft = (rect.left - pos1);
                elmnt.style.top = newTop + "px";
                elmnt.style.left = newLeft + "px";
                // Remove transform, bottom, and percentage-based positioning to allow manual positioning
                elmnt.style.transform = "none";
                elmnt.style.bottom = "auto";
            }

            function closeDragElement() {
                // Stop moving when mouse/touch is released
                document.onmouseup = null;
                document.onmousemove = null;
                document.ontouchend = null;
                document.ontouchmove = null;
            }
        }

        // Initialize dragging on all breakpoints
        dragElement(toolbarElement);
    }

    // Toolbar tab switching
    const toolbarTabs = document.querySelectorAll('.toolbar-tab');
    const toolbarSections = document.querySelectorAll('.toolbar-section');

    if (toolbarTabs.length > 0 && toolbarSections.length > 0) {
        toolbarTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetSection = tab.getAttribute('data-tab');
                
                // Update active tab
                toolbarTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active section
                toolbarSections.forEach(section => {
                    if (section.getAttribute('data-section') === targetSection) {
                        section.classList.add('active');
                    } else {
                        section.classList.remove('active');
                    }
                });
            });
        });
    }

    if (mobileControlsToggle && mobileControlsElement) {
        mobileControlsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobileViewport()) {
                return;
            }
            const isVisible = mobileControlsElement.classList.contains('mobile-visible');
            if (isVisible) {
                closeMobileControls();
            } else {
                mobileControlsElement.classList.remove('mobile-hidden');
                mobileControlsElement.classList.add('mobile-visible');
                mobileControlsToggle.classList.add('active');
                mobileControlsToggle.setAttribute('aria-pressed', 'true');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!mobileControlsElement || !mobileControlsElement.classList.contains('mobile-visible')) {
            return;
        }
        if (!isMobileViewport()) {
            return;
        }
        if (!e.target.closest('#mobile-camera-controls') && !e.target.closest('#mobile-controls-toggle')) {
            closeMobileControls();
        }
    });

    const handleResponsiveChange = () => {
        applyToolbarResponsiveState();
        applyMobileControlsResponsiveState();
    };

    const addMediaListener = (mq) => {
        if (mq.addEventListener) {
            mq.addEventListener('change', handleResponsiveChange);
        } else if (mq.addListener) {
            mq.addListener(handleResponsiveChange);
        }
    };

    addMediaListener(narrowToolbarQuery);
    addMediaListener(landscapeToolbarQuery);
    handleResponsiveChange();
    
    // Budget panel functionality - get elements directly to avoid timing issues
    // Budget button now opens the centered balance sheet modal
    // The old budget-panel slide-in functionality is replaced by balance-sheet-panel
    // Note: budget-panel code is kept for backwards compatibility but not used
    
    // Register with AppRegistry (window.app) if available, else use direct window.* (backwards compatible)
    appRegister('gameStore', gameStore);
    
    // Show city size selection modal before creating game
    const selectionResult = await showCitySizeSelection();
    const selectedCitySize = selectionResult.size || selectionResult; // Backward compatibility
    const multiplayerEnabled = selectionResult.multiplayer || false;
    const playerPseudo = selectionResult.pseudo || null;
    
    const game = createGame(gameStore, assetManager, selectedCitySize);
    appRegister('game', game);
    
    // Activer le multijoueur uniquement si l'utilisateur a explicitement créé/rejoint un salon
    if (multiplayerEnabled && playerPseudo && (selectionResult.action === 'create' || selectionResult.action === 'join')) {
        try {
            const { getMultiplayerManager } = await import('../multiplayer/MultiplayerManager.js');
            const multiplayerManager = getMultiplayerManager(game, game.scene);
            
            // Déterminer l'action et les paramètres
            const action = selectionResult.action;
            let roomIdOrCitySize;
            let roomName = null;
            if (action === 'join' && selectionResult.roomId) {
                // Rejoindre un salon existant
                roomIdOrCitySize = selectionResult.roomId;
            } else if (action === 'create') {
                // Créer un nouveau salon avec la taille choisie
                roomIdOrCitySize = selectedCitySize;
                roomName = selectionResult.roomName || null;
            }
            
            // Importer la configuration WebSocket
            const getWebSocketUrl = (await import('../../config/websocket.js')).default;
            const wsUrl = getWebSocketUrl();
            
            await multiplayerManager.enable(wsUrl, playerPseudo, roomIdOrCitySize, action, roomName);
            window.multiplayerManager = multiplayerManager;
        } catch (error) {
            console.error('[Multiplayer] Erreur d\'activation:', error);
            
            // Les erreurs sont gérées par MultiplayerManager :
            // - MAX_PLAYERS_REACHED → showConnectionRefusedAlert
            // - Autres erreurs → showConnectionFailedAlert (propose le mode solo)
            // Le jeu continue normalement en mode solo si l'utilisateur accepte
        }
    }
    
    // Functions can be registered as well
    window.setActiveTool = (e) => {
        getButtonsUnactive(e)
        if(e.target.classList.contains('panel-btn')) {
            getButtonsDisabled()
            // For panel buttons (house selection), just close the modal and set the tool
            closeModal();
            
            // Ensure canvas pointer events are enabled after closing modal
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
                // Force enable pointer events on mobile
                canvas.style.pointerEvents = 'auto';
                canvas.style.touchAction = 'none';
                // Add canvas-interactive class for mobile landscape
                canvas.classList.add('canvas-interactive');
            }
            
            // Also ensure PopupManager knows panel-layout is closed
            if (window.popupManager) {
                window.popupManager.forceClosePopup('panel-layout');
            }
        } else if(e.target.dataset.toolid) {
            // For toolbar buttons with data-toolid (like roads, residential), directly set the tool
            // No modal needed
        } else {
            // For toolbar buttons without data-toolid, toggle the modal
            toggleModal(e)
        }
        selectedControl = e.currentTarget;
        selectedControl.classList.add('selected');
        window.game.setActiveToolId(e.target.dataset.toolid);
    }

    // Initialize real-time budget popup
    initRealtimeBudgetPopup();

    // Initialize urban advice center
    initUrbanAdviceCenter();
    
    // Initialize budget states popup
    initBudgetStatesPopup();
    
    // Initialize city map popup
    initCityMapPopup();
    
    // Initialize loans popup
    initLoansPopup();
    
    // Initialize loan payment system
    initLoanPaymentSystem();
    
    // Initialize journal popup
    initJournalPopup();
    initFoodTraceabilityPopup();
    
    // Initialize balance sheet popup
    initBalanceSheetPopup();
    
    // Initialize administrator panel
    if (typeof initAdministratorPanel === 'function') {
        initAdministratorPanel();
    }
}

// Real-time Budget Popup Functions - Moved to budget/RealtimeBudgetManager.js

// City Map Popup Functions
function initCityMapPopup() {
    const cityMapBtn = document.getElementById('city-map-btn');
    const cityMapPanel = document.getElementById('city-map-panel');
    const cityMapCloseBtn = document.querySelector('.city-map-close-btn');

    if (!cityMapBtn || !cityMapPanel || !cityMapCloseBtn) {
        console.warn('City map popup elements not found');
        return;
    }

    // Initialize collapsible legend for mobile landscape
    function initCollapsibleLegend() {
        const legendToggle = document.querySelector('.legend-toggle');
        const legend = document.querySelector('.city-map-legend');
        
        if (legendToggle && legend) {
            legendToggle.addEventListener('click', () => {
                legend.classList.toggle('collapsed');
                // Icons are handled by CSS animations - no need to change text content
            });
        }
    }

    // Toggle popup on button click
    cityMapBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        cityMapPanel.classList.toggle('active');
        
        if (cityMapPanel.classList.contains('active')) {
            // Use PopupManager to handle events
            if (window.popupManager) {
                window.popupManager.forceOpenPopup('city-map-panel');
            }
            // Generate the city map grid
            await generateCityMap();
            
            // Initialize collapsible legend after a short delay to ensure DOM is ready
            setTimeout(initCollapsibleLegend, 100);

            // Initialize map filters
            initCityMapFilters();
        } else {
            // Use PopupManager to handle events
            if (window.popupManager) {
                window.popupManager.forceClosePopup('city-map-panel');
            }
        }
    });

    // Close popup on close button click
    cityMapCloseBtn.addEventListener('click', () => {
        cityMapPanel.classList.remove('active');
        
        if (window.popupManager) {
            window.popupManager.forceClosePopup('city-map-panel');
        }
    });

    // Close popup when clicking outside
    cityMapPanel.addEventListener('click', (e) => {
        if (e.target === cityMapPanel) {
            cityMapPanel.classList.remove('active');
            
            if (window.popupManager) {
                window.popupManager.forceClosePopup('city-map-panel');
            }
        }
    });
}

// Apply filter on city map grid cells
function applyCityMapFilter(filter) {
    const grid = document.getElementById('city-map-grid');
    if (!grid) return;
    const cells = grid.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const cat = cell.getAttribute('data-category') || 'other';
        if (filter === 'all' || filter === cat) {
            cell.classList.remove('filtered-hidden');
        } else {
            cell.classList.add('filtered-hidden');
        }
    });
}

// Wire up city map filter buttons
function initCityMapFilters() {
    const filterBar = document.querySelector('.city-map-filters');
    if (!filterBar) return;
    const btns = filterBar.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter') || 'all';
            applyCityMapFilter(filter);
        });
    });
    // Apply current active on init
    const activeBtn = filterBar.querySelector('.filter-btn.active');
    const current = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
    applyCityMapFilter(current);

    // Neighbor toggle (independent of category filters)
    const neighborsBtn = filterBar.querySelector('.neighbors-btn');
    const grid = document.getElementById('city-map-grid');
    if (neighborsBtn && grid) {
        // Start with neighbors hidden when button is not active
        if (!neighborsBtn.classList.contains('active')) {
            grid.classList.add('hide-neighbors');
        }
        // Active (orange) = neighbors shown; inactive = hidden
        neighborsBtn.addEventListener('click', () => {
            const willBeActive = !neighborsBtn.classList.contains('active');
            neighborsBtn.classList.toggle('active', willBeActive);
            if (willBeActive) {
                grid.classList.remove('hide-neighbors');
            } else {
                grid.classList.add('hide-neighbors');
            }
        });
    }
}

// Function to get building code from type
function getBuildingCode(type) {
    if (!type) return '';
    if (type.includes('House-Blue')) return 'HB';
    if (type.includes('House-Red')) return 'HR';
    if (type.includes('House-Purple')) return 'HP';
    if (type.includes('House-2Story') || type.includes('House_2Story')) return 'H2S';
    if (type.includes('Market')) return 'M';
    if (type.includes('Farm')) return 'F';
    if (type.includes('Windmill')) return 'WM';
    if (type.includes('Barn')) return 'BA';
    if (type.includes('Church')) return 'CH';
    if (type.includes('Well')) return 'WE';
    if (type.includes('Fountain')) return 'FO';
    if (type.includes('Tombstone') || type.includes('Tomb')) return 'TO';
    if (type.includes('roads')) return 'R';
    if (type.includes('Road')) return 'R';
    // Default: return first letter of type
    return type.charAt(0).toUpperCase();
}

// Function to get all neighbor codes for a building
function getNeighborCodes(neighbors) {
    if (!neighbors || !Array.isArray(neighbors) || neighbors.length === 0) {
        return '';
    }
    
    return neighbors.map(neighbor => {
        // Prefer explicit fields, fallback to buildingId used in DB
        const typeLike = neighbor.type || neighbor.name || '';
        const code = getBuildingCode(typeLike);
        if (neighbor.x !== undefined && neighbor.y !== undefined) {
            return `${code}(${neighbor.x},${neighbor.y})`;
        }
        return code;
    }).join(' ');
}

// Function to generate city map grid
async function generateCityMap() {
    const cityMapGrid = document.getElementById('city-map-grid');
    if (!cityMapGrid) return;
    
    try {
        // Show loading
        cityMapGrid.innerHTML = `
            <div class="grid-loading">
                <div class="loading-spinner"></div>
                <p>Chargement de la carte...</p>
            </div>
        `;
        
        // Get city dimensions from game - default to 16x16 if not available
        let citySize = 16;
        if (window.scene && window.scene.city) {
            citySize = window.scene.city.size;
        }
        
        // Get all buildings via Supply BC (hasFood / marketTooFar + layout fields)
        let buildings = [];
        try {
            buildings = await listSupplyMapBuildings();
        } catch (error) {
            console.warn('Could not load Supply map buildings:', error);
            buildings = [];
        }
        
        // Create a map of buildings by position (x,y)
        const buildingMap = new Map();
        buildings.forEach(building => {
            if (building.x !== undefined && building.y !== undefined && building.x != null && building.y != null) {
                const key = `${building.x},${building.y}`;
                buildingMap.set(key, building);
            }
        });
        
        // Create the HTML table with full city grid (0 to citySize-1)
        // First header cell shows coordinate system info
        let tableHTML = '<table class="city-grid-table"><thead><tr>';
        tableHTML += '<th class="coord-label-cell"><span class="coord-label-x">X ↕</span><span class="coord-label-y">↔ Y</span></th>';
        
        // Add column headers (y coordinates) 
        for (let y = 0; y < citySize; y++) {
            tableHTML += `<th class="y-header">${y}</th>`;
        }
        tableHTML += '</tr></thead><tbody>';
        
        // Add rows (x coordinates)
        for (let x = 0; x < citySize; x++) {
            tableHTML += `<tr><th class="x-header">${x}</th>`;
            
            for (let y = 0; y < citySize; y++) {
                const key = `${x},${y}`;
                const building = buildingMap.get(key);
                
                if (building) {
                    const code = getBuildingCode(building.type);
                    const neighbors = building.neighbors || [];
                    const neighborCodes = getNeighborCodes(neighbors);
                    
                    // Check if building needs road access (not roads themselves)
                    const isRoad = building.type.includes('roads') || building.type.includes('Road');
                    const needsRoadAccess = !isRoad;
                    
                    const hasRoad = needsRoadAccess ? hasRoadAccessFromCount(building.roadCount) : true;
                    
                    // Check if building can have food (houses, markets, but not roads, wells, etc.)
                    const canHaveFood = building.type.includes('House') || building.type.includes('Market') || building.type.includes('Farm');
                    
                    // Supply BC fields
                    const hasFood = canHaveFood ? building.hasFood === true : true;
                    
                    // Check if house is too far from market (for houses only)
                    const isHouse = building.kind === 'house';
                    const marketTooFar = isHouse ? (building.marketTooFar === true) : false;
                    
                    // Determine category for filtering
                    let category = 'services';
                    if (building.type && (building.type.includes('House') || building.type.includes('Palace'))) {
                        category = 'houses';
                    } else if (building.type && (building.type.includes('roads') || building.type.includes('Road'))) {
                        category = 'infrastructure';
                    } else if (building.type && (building.type.includes('Well') || building.type.includes('Church'))) {
                        category = 'services';
                    } else if (building.type && (building.type.includes('Market') || building.type.includes('Farm'))) {
                        category = 'services';
                    }

                    tableHTML += `<td class=\"grid-cell\" data-category=\"${category}\">`;
                    
                    // Status indicators
                    tableHTML += `<div class="status-indicators">`;
                    // Only show road indicator for buildings that need roads
                    if (needsRoadAccess && !hasRoad) {
                        tableHTML += `<span class="status-indicator no-road" title="Pas de route"></span>`;
                    }
                    // Show market-too-far indicator for houses without food that are too far from markets
                    if (isHouse && !hasFood && marketTooFar) {
                        tableHTML += `<span class="status-indicator market-too-far" title="Marché trop loin"></span>`;
                    }
                    // Only show food indicator for buildings that can have food (but not if it's market-too-far)
                    else if (canHaveFood && !hasFood && !marketTooFar) {
                        tableHTML += `<span class="status-indicator no-food" title="Pas de nourriture"></span>`;
                    }
                    tableHTML += `</div>`;
                    
                    tableHTML += `<span class=\"building-code ${code.toLowerCase()}\">${code}</span>`;
                    // Neighbors list (shown when neighbors toggle is active)
                    if (neighborCodes) {
                        tableHTML += `<div class=\"neighbors-list\">${neighborCodes}</div>`;
                    }
                    // Habitants count (per house), shown when neighbors are hidden
                    if (category === 'houses') {
                        const habitants = Number(building.pop || 0);
                        tableHTML += `<div class=\"habitants-count\" title=\"Habitants\">${habitants}</div>`;
                    }
                    tableHTML += `</td>`;
                } else {
                    // Empty cell (grass) - show a small indicator
                    tableHTML += `<td class=\"grid-cell empty-cell\" data-category=\"infrastructure\"> 
                        <span class="building-code grass" style="opacity: 0.3;">G</span>
                    </td>`;
                }
            }
            
            tableHTML += '</tr>';
        }
        
        tableHTML += '</tbody></table>';
        
        cityMapGrid.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error generating city map:', error);
        cityMapGrid.innerHTML = `
            <div class="grid-loading">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">⚠️ Impossible de charger la carte</p>
                <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 20px;">
                    Une erreur s'est produite lors du chargement de la carte de votre ville
                </p>
                <div style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); max-width: 400px;">
                    <p style="color: #fca5a5; font-size: 0.85rem; margin: 0 0 10px 0;">
                        <strong>Détails de l'erreur:</strong>
                    </p>
                    <p style="color: #fca5a5; font-size: 0.75rem; margin: 0; font-family: monospace;">
                        ${error.message || 'Erreur inconnue'}
                    </p>
                </div>
                <button onclick="generateCityMap()" style="margin-top: 20px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }
}

// Budget States Popup Functions
// Budget States Popup Functions - Moved to budget/BudgetStatesManager.js

// Urban Advice Center Functions - Moved to urban-advice/UrbanAdviceManager.js

// Loan System Functions - Moved to loans/LoansManager.js

// Balance Sheet Popup Functions (using budget-panel-wrapper)
function initBalanceSheetPopup() {
    const budgetBtn = document.getElementById('budget-btn');
    const budgetPanel = document.getElementById('budget-panel');
    const budgetPanelCloseBtn = document.querySelector('.budget-panel-close-btn');

    if (!budgetBtn || !budgetPanel || !budgetPanelCloseBtn) {
        console.warn('Balance sheet popup elements not found');
        return;
    }

    // Open balance sheet popup on budget button click
    budgetBtn.addEventListener('click', () => {
        budgetPanel.classList.add('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('budget-panel');
        }
        
        // Update balance sheet data
        updateBudgetDisplay();
    });

    // Close popup on close button click
    budgetPanelCloseBtn.addEventListener('click', () => {
        budgetPanel.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('budget-panel');
        }
    });

    // Close popup when clicking outside
    budgetPanel.addEventListener('click', (e) => {
        if (e.target === budgetPanel) {
            budgetPanel.classList.remove('active');
            
            // Utiliser PopupManager pour gérer les événements
            if (window.popupManager) {
                window.popupManager.forceClosePopup('budget-panel');
            }
        }
    });
}

// Loans Popup Functions - Moved to loans/LoansManager.js

// Make loadBudgetStates globally accessible
window.loadBudgetStates = (period = '3', showLoading = true) => loadBudgetStates(period, showLoading);

// Make generateCityMap globally accessible
window.generateCityMap = generateCityMap;

// Global refresh function for budget states modal
// refreshBudgetStatesModal - Moved to budget/BudgetStatesManager.js
// Already exported globally from the module

// Journal Popup Functions - Moved to journal/JournalManager.js


// Food Traceability Popup Functions - Moved to food-traceability/FoodTraceabilityManager.js
