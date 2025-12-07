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
    publicButton,
    replayButton,
    resetButton,
    roadButton,
    selectButton,
    slowerButton,
    toolBarButtons
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
import housesStore from "../stores/HousesStore.js";
import budgetManager from "../stores/BudgetManager.js";
import AssetManager from "../meshs/AssetManager.js";

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
        // Get budget data from BudgetManager
        const budgetSummary = await budgetManager.getBudgetSummary();
        const financialHealth = await budgetManager.getFinancialHealth();
        const currentBudget = await budgetManager.getCurrentBudget();
        
        // Get building data
        const houses = await housesStore.listAllHouses();
        const totalBuildingValue = await housesStore.getGlobalBuildingPrices() || 0;
        
        // Get actual building prices from housesStore
        const buildingPrices = await housesStore.getBuildingPricesByType() || {};
        
        // Analyze buildings by type and color
        const buildingAnalysis = {
            redHouses: 0,
            blueHouses: 0,
            purpleHouses: 0,
            cabbageFields: 0,
            wheatFields: 0,
            carrotFields: 0,
            foodMarkets: 0,
            roads: 0
        };
        
        houses.forEach(house => {
            const type = house.type;
            if (type.includes('House-Red')) buildingAnalysis.redHouses++;
            else if (type.includes('House-Blue')) buildingAnalysis.blueHouses++;
            else if (type.includes('House-Purple')) buildingAnalysis.purpleHouses++;
            else if (type.includes('Farm-Cabbage')) buildingAnalysis.cabbageFields++;
            else if (type.includes('Farm-Wheat')) buildingAnalysis.wheatFields++;
            else if (type.includes('Farm-Carrot')) buildingAnalysis.carrotFields++;
            else if (type.includes('Market')) buildingAnalysis.foodMarkets++;
            else if (type.includes('roads')) buildingAnalysis.roads++;
        });
        
        // Use actual building prices from housesStore
        const housePrices = {
            red: buildingPrices['House-Red'] || 'N/A',
            blue: buildingPrices['House-Blue'] || 'N/A',
            purple: buildingPrices['House-Purple'] || 'N/A'
        };
        
        const farmPrices = {
            cabbage: buildingPrices['Farm-Cabbage'] || 'N/A',
            wheat: buildingPrices['Farm-Wheat'] || 'N/A',
            carrot: buildingPrices['Farm-Carrot'] || 'N/A'
        };
        
        const marketPrice = buildingPrices['Market'] || 'N/A';
        const roadPrice = buildingPrices['roads'] || 'N/A';
        
        
        // Calculate detailed values (handle N/A prices)
        const redHousesValue = typeof housePrices.red === 'number' ? buildingAnalysis.redHouses * housePrices.red : 0;
        const blueHousesValue = typeof housePrices.blue === 'number' ? buildingAnalysis.blueHouses * housePrices.blue : 0;
        const purpleHousesValue = typeof housePrices.purple === 'number' ? buildingAnalysis.purpleHouses * housePrices.purple : 0;
        const totalHousesValue = redHousesValue + blueHousesValue + purpleHousesValue;
        
        const cabbageValue = typeof farmPrices.cabbage === 'number' ? buildingAnalysis.cabbageFields * farmPrices.cabbage : 0;
        const wheatValue = typeof farmPrices.wheat === 'number' ? buildingAnalysis.wheatFields * farmPrices.wheat : 0;
        const carrotValue = typeof farmPrices.carrot === 'number' ? buildingAnalysis.carrotFields * farmPrices.carrot : 0;
        const totalFarmsValue = cabbageValue + wheatValue + carrotValue;
        
        const marketsValue = typeof marketPrice === 'number' ? buildingAnalysis.foodMarkets * marketPrice : 0;
        const roadsValue = typeof roadPrice === 'number' ? buildingAnalysis.roads * roadPrice : 0;
        
        // Calculate depreciation (amortissements) - based on actual game mechanics
        // For now, no depreciation until we implement building aging mechanics
        const totalDepreciation = 0; // No depreciation system implemented yet
        
        // Calculate provisions for risks and charges
        // For now, no provisions until we implement risk management mechanics
        const riskProvisions = 0; // No risk provisions system implemented yet
        const chargeProvisions = 0; // No charge provisions system implemented yet
        
        // Calculate additional assets (according to French standards)
        const intangibleAssets = 0; // No intangible assets for now (software, patents, etc.)
        const financialAssets = 0; // No financial assets for now (securities, guarantees, etc.)
        
        // Calculate net values
        const totalBuildingsNet = totalBuildingValue - totalDepreciation;
        const inventoryGross = 0; // No inventory for now
        const inventoryProvisions = 0; // No inventory provisions for now
        const inventoryNet = inventoryGross - inventoryProvisions;
        const receivables = 0; // No receivables for now
        
        // Update Balance Sheet - ACTIF
        updateBalanceSheetElement('balance-sheet-date', `Tour ${currentBudget.turn || 0} (état du passif et de l'actif au ${currentBudget.turn || 0}e tour)`);
        
        // Update detailed intangible assets (all 0€ for now - not implemented)
        updateBalanceSheetElement('intangible-assets-value', `${intangibleAssets.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('establishment-costs', '0€');
        updateBalanceSheetElement('rd-costs', '0€');
        updateBalanceSheetElement('patents-licenses', '0€');
        updateBalanceSheetElement('goodwill', '0€');
        updateBalanceSheetElement('software-rights', '0€');
        updateBalanceSheetElement('other-intangible', '0€');
        updateBalanceSheetElement('intangible-in-progress', '0€');
        updateBalanceSheetElement('intangible-advances', '0€');
        
        // Update detailed tangible assets
        updateBalanceSheetElement('total-buildings-gross-value', `${totalBuildingValue.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('land-value', '0€'); // No land system implemented
        updateBalanceSheetElement('constructions-value', `${totalBuildingValue.toLocaleString('fr-FR')}€`); // All buildings are constructions
        updateBalanceSheetElement('technical-equipment', '0€'); // No technical equipment system
        updateBalanceSheetElement('other-tangible', '0€');
        updateBalanceSheetElement('tangible-in-progress', '0€');
        updateBalanceSheetElement('tangible-advances', '0€');
        
        updateBalanceSheetElement('total-depreciation-value', `${totalDepreciation.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('total-buildings-net-value', `${totalBuildingsNet.toLocaleString('fr-FR')}€`);
        
        // Update detailed financial assets (all 0€ for now - not implemented)
        updateBalanceSheetElement('financial-assets-value', `${financialAssets.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('equity-interests', '0€');
        updateBalanceSheetElement('participation-receivables', '0€');
        updateBalanceSheetElement('portfolio-securities', '0€');
        updateBalanceSheetElement('other-securities', '0€');
        updateBalanceSheetElement('loans-granted', '0€'); // Prêts accordés (not implemented)
        updateBalanceSheetElement('other-financial', '0€');
        updateBalanceSheetElement('total-houses-value', `${totalHousesValue.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('red-houses-value', typeof housePrices.red === 'number' ? `${redHousesValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('blue-houses-value', typeof housePrices.blue === 'number' ? `${blueHousesValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('purple-houses-value', typeof housePrices.purple === 'number' ? `${purpleHousesValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('total-farms-value', `${totalFarmsValue.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('cabbage-fields-value', typeof farmPrices.cabbage === 'number' ? `${cabbageValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('wheat-fields-value', typeof farmPrices.wheat === 'number' ? `${wheatValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('carrot-fields-value', typeof farmPrices.carrot === 'number' ? `${carrotValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('total-markets-value', typeof marketPrice === 'number' ? `${marketsValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('food-markets-value', typeof marketPrice === 'number' ? `${marketsValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('total-roads-value', typeof roadPrice === 'number' ? `${roadsValue.toLocaleString('fr-FR')}€` : 'N/A');
        updateBalanceSheetElement('roads-value', typeof roadPrice === 'number' ? `${roadsValue.toLocaleString('fr-FR')}€` : 'N/A');
        
        // Update detailed current assets (all 0€ for now - not implemented)
        updateBalanceSheetElement('stocks-work-in-progress', '0€');
        updateBalanceSheetElement('raw-materials', '0€');
        updateBalanceSheetElement('work-in-progress', '0€');
        updateBalanceSheetElement('finished-products', '0€');
        updateBalanceSheetElement('merchandise', '0€');
        updateBalanceSheetElement('advances-on-orders', '0€');
        
        // Update receivables details
        updateBalanceSheetElement('total-receivables', `${receivables.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('client-receivables', '0€');
        updateBalanceSheetElement('other-receivables', '0€');
        updateBalanceSheetElement('called-unpaid-capital', '0€');
        
        // Update marketable securities
        updateBalanceSheetElement('marketable-securities', '0€');
        updateBalanceSheetElement('own-shares', '0€');
        updateBalanceSheetElement('other-securities', '0€');
        
        // Update treasury and cash
        updateBalanceSheetElement('treasury-instruments', '0€');
        updateBalanceSheetElement('cash-value', `${currentBudget.funds.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('prepaid-expenses', '0€');
        
        // Calculate total current assets
        const totalCurrentAssets = receivables + currentBudget.funds;
        updateBalanceSheetElement('total-current-assets', `${totalCurrentAssets.toLocaleString('fr-FR')}€`);
        
        // Update additional sections (all 0€ for now)
        updateBalanceSheetElement('deferred-charges', '0€');
        updateBalanceSheetElement('loan-redemption-premiums', '0€');
        updateBalanceSheetElement('conversion-differences', '0€');
        
        // Calculate total assets (net values) - updated structure
        const totalAssets = intangibleAssets + totalBuildingsNet + financialAssets + totalCurrentAssets + 0; // +0 for deferred charges, premiums, conversion differences
        updateBalanceSheetElement('total-assets', `${totalAssets.toLocaleString('fr-FR')}€`);
        
        // Calculate loan debts from budget
        const activeLoans = await budgetManager.getActiveLoans();
        let bankLoansDebt = 0;
        let commercialLoansDebt = 0;
        
        activeLoans.forEach(loan => {
            if (loan.type === 'bank') {
                bankLoansDebt += loan.amount;
            } else if (loan.type === 'commercial') {
                commercialLoansDebt += loan.amount;
            }
        });
        
        // Update Balance Sheet - PASSIF
        // Capital social: Only arbitrary value allowed - initial mayor's funds from budget store
        const shareCapital = currentBudget.initialFunds || currentBudget.funds; // Use initial funds from budget store
        updateBalanceSheetElement('share-capital', `${shareCapital.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('legal-reserves', '0€'); // No legal reserves system implemented yet
        updateBalanceSheetElement('carried-forward', '0€'); // No carried forward system implemented yet
        updateBalanceSheetElement('net-result', `${currentBudget.netFlow.toLocaleString('fr-FR')}€`);
        
        // Update provisions
        updateBalanceSheetElement('risk-provisions', `${riskProvisions.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('charge-provisions', `${chargeProvisions.toLocaleString('fr-FR')}€`);
        
        // Update debts
        updateBalanceSheetElement('bank-loans-debt', `${bankLoansDebt.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('commercial-loans-debt', `${commercialLoansDebt.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('supplier-debts', '0€'); // Pas de dettes fournisseurs pour l'instant
        updateBalanceSheetElement('social-fiscal-debts', '0€'); // Pas de dettes sociales/fiscales pour l'instant
        
        // Calculate accrued expenses (charges à payer) - includes loan interest and building maintenance
        const accruedExpenses = (currentBudget.totalLoanInterestExpenses || 0) + (currentBudget.totalBuildingMaintenance || 0);
        updateBalanceSheetElement('accrued-expenses', `${accruedExpenses.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('loan-interest-expenses', `${(currentBudget.totalLoanInterestExpenses || 0).toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('building-maintenance-expenses', `${(currentBudget.totalBuildingMaintenance || 0).toLocaleString('fr-FR')}€`);
        
        // Calculate debt totals
        const financialDebtsTotal = bankLoansDebt + commercialLoansDebt;
        const operatingDebtsTotal = accruedExpenses; // Include both loan interest and building maintenance
        updateBalanceSheetElement('financial-debts-total', `${financialDebtsTotal.toLocaleString('fr-FR')}€`);
        updateBalanceSheetElement('operating-debts-total', `${operatingDebtsTotal.toLocaleString('fr-FR')}€`);
        
        // Calculate total liabilities
        const totalLiabilities = shareCapital + currentBudget.netFlow + riskProvisions + chargeProvisions + bankLoansDebt + commercialLoansDebt + accruedExpenses;
        updateBalanceSheetElement('total-liabilities', `${totalLiabilities.toLocaleString('fr-FR')}€`);
        
        // Verify balance sheet equation: ACTIF = PASSIF
        const balanceDifference = Math.abs(totalAssets - totalLiabilities);
        if (balanceDifference > 1) { // Allow 1€ difference for rounding
            console.warn(`⚠️ Bilan déséquilibré: ACTIF (${totalAssets}€) ≠ PASSIF (${totalLiabilities}€). Différence: ${balanceDifference}€`);
            // Adjust net result to balance the sheet
            const adjustedNetResult = currentBudget.netFlow + (totalAssets - totalLiabilities);
            updateBalanceSheetElement('net-result', `${adjustedNetResult.toLocaleString('fr-FR')}€`);
            updateBalanceSheetElement('total-liabilities', `${totalAssets.toLocaleString('fr-FR')}€`);
        } else {
            console.log(`✅ Bilan équilibré: ACTIF = PASSIF = ${totalAssets}€`);
        }
        
        // Update financial health indicator in header
        const healthIndicatorEl = document.getElementById('budget-health-indicator');
        const healthStatusEl = healthIndicatorEl?.querySelector('.health-status');
        
        if (healthIndicatorEl && healthStatusEl) {
            // Update text and styling based on financial health
            healthStatusEl.textContent = financialHealth.message;
            
            // Remove existing classes
            healthIndicatorEl.classList.remove('warning', 'critical');
            
            // Add appropriate class based on status
            if (financialHealth.status === 'critical') {
                healthIndicatorEl.classList.add('critical');
            } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
                healthIndicatorEl.classList.add('warning');
            }
            // Default styling (healthy/excellent) is already applied via CSS
        }
        
        // Update real-time budget display
        updateRealtimeBudget();
        
        // Initialize balance sheet filters
        initBalanceSheetFilters();
        
    } catch (error) {
        console.error('Error updating budget display:', error);
    }
}

function updateBalanceSheetElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
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
    
    console.log(`Balance sheet filter applied: ${filter}`);
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
                e.target.classList.toggle('selected')
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
                e.target.classList.toggle('selected')
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
                e.target.classList.toggle('selected')
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
                e.target.classList.toggle('selected')
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
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
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
                console.log('🏛️ Palace button is disabled');
                return; // Don't open panel if disabled
            }
            
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
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
    
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => industryToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Windmill-001') {
                makeNewButton(buttonInfo, svgWindmill)
            } else if (buttonInfo.tool === 'Barn-001') {
                makeNewButton(buttonInfo, svgBarn)
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
    buttonData.filter(buttonInfo => infrastructureToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
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

function createPublicButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const publicToolIDs = toolIds.public || [];

    // Réutiliser le même SVG que les maisons (temporaire)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-home">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>`
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`

    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => publicToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Church-002') {
                makeNewButton(buttonInfo, svgBigHouse);
            } else {
                makeNewButton(buttonInfo, svg);
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
        const theoreticalMaxSize = testMode ? (isMobile ? 24 : 32) : (isMobile ? 16 : 24);
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
                    console.log('[Rooms] Connexion WebSocket établie pour charger les salons');
                };
                
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[Rooms] Message reçu:', data.type, data);
                        if (data.type === 'AVAILABLE_ROOMS') {
                            roomsReceived = true;
                            connectionClosed = true;
                            clearTimeout(timeout);
                            console.log('[Rooms] Salons reçus:', data.rooms);
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
            assetManager.initializeBuildings('industry'),
            assetManager.initializeBuildings('infrastructure'),
            assetManager.initializeBuildings('public')
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
        console.log('✅ ButtonStateManager loaded successfully');
        
        // Register category buttons
        const palaceBtn = document.getElementById('palace-btn');
        if (palaceBtn) {
            window.buttonStateManager.registerButton('palace-btn', palaceBtn);
        }
        
        const infrastructureBtn = document.getElementById('infrastructure-btn');
        if (infrastructureBtn) {
            window.buttonStateManager.registerButton('infrastructure-btn', infrastructureBtn);
        }
        
        // Disable initial unavailable buildings
        const initialDisabledBuildings = [
            'palace-btn',           // Palace category button
            'House-Red',            // Red house
            'House-Purple',         // Purple house
            // 'Windmill-001',      // Windmill - REACTIVATED
            'Church-002',           // Church
            'infrastructure-btn'    // Infrastructure category button
        ];
        
        initialDisabledBuildings.forEach(buildingId => {
            window.buttonStateManager.disable(buildingId);
            console.log(`🚫 Disabled: ${buildingId}`);
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

    // Function to perform the actual reset
    async function performReset() {
        // Hard reload - unregister service worker and clear caches
        try {
            // Unregister service worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('Service worker unregistered');
                }
            }
            
            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    console.log('Cache deleted:', cacheName);
                }
            }
            
            // Clear localStorage
            localStorage.clear();
            console.log('LocalStorage cleared');
            
            // Clear IndexedDB - for all databases
            if ('indexedDB' in window) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                            console.log('IndexedDB deleted:', db.name);
                        }
                    });
                });
            }
            
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

    roadButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

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
    
    publicButton.addEventListener('click', (e) => {
        if (window.setActiveTool) {
            window.setActiveTool(e);
        }
    })

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
    appRegister('housesStore', housesStore);
    
    // Show city size selection modal before creating game
    const selectionResult = await showCitySizeSelection();
    const selectedCitySize = selectionResult.size || selectionResult; // Backward compatibility
    const multiplayerEnabled = selectionResult.multiplayer || false;
    const playerPseudo = selectionResult.pseudo || null;
    
    const game = createGame(housesStore, gameStore, assetManager, selectedCitySize);
    appRegister('game', game);
    
    // Activer le multijoueur uniquement si l'utilisateur a explicitement créé/rejoint un salon
    if (multiplayerEnabled && playerPseudo && (selectionResult.action === 'create' || selectionResult.action === 'join')) {
        try {
            const { getMultiplayerManager } = await import('../multiplayer/MultiplayerManager.js');
            const multiplayerManager = getMultiplayerManager(game, game.scene, housesStore);
            
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
            
            console.log('[Multiplayer] Activation avec:', { action, roomIdOrCitySize, playerPseudo, selectedCitySize, roomName });
            
            // Importer la configuration WebSocket
            const getWebSocketUrl = (await import('../../config/websocket.js')).default;
            const wsUrl = getWebSocketUrl();
            
            await multiplayerManager.enable(wsUrl, playerPseudo, roomIdOrCitySize, action, roomName);
            window.multiplayerManager = multiplayerManager;
            console.log(`[Multiplayer] Mode multijoueur activé avec pseudo: ${playerPseudo}`);
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
        
        // Only toggle if clicking directly on the budget box or its children
        if (e.target === realtimeBudgetBtn || realtimeBudgetBtn.contains(e.target)) {
            realtimeBudgetPanel.classList.toggle('active');
            realtimeBudgetBtn.classList.toggle('active'); // Add/remove active class on button
            
            if (realtimeBudgetPanel.classList.contains('active')) {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('realtime-budget-panel');
                }
                updateRealtimeBudget();
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('realtime-budget-panel');
                }
            }
        }
    });

    // Close popup on close button click
    realtimeBudgetCloseBtn.addEventListener('click', () => {
        realtimeBudgetPanel.classList.remove('active');
        realtimeBudgetBtn.classList.remove('active'); // Remove active class from button
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('realtime-budget-panel');
        }
    });

    // Close popup when clicking outside
    realtimeBudgetPanel.addEventListener('click', (e) => {
        if (e.target === realtimeBudgetPanel) {
            realtimeBudgetPanel.classList.remove('active');
            realtimeBudgetBtn.classList.remove('active'); // Remove active class from button
            // No need to manage pointer events since budget panel doesn't interfere with 3D scene
        }
    });

    // Update real-time budget every second when popup is open
    setInterval(() => {
        if (realtimeBudgetPanel.classList.contains('active')) {
            updateRealtimeBudget();
        }
    }, 1000);

    // Note: Removed automatic closing when other modals open
    // The budget panel now stays open when building modals are active
}

async function updateRealtimeBudget() {
    const realtimeFundsEl = document.getElementById('realtime-funds');
    const realtimeIncomeEl = document.getElementById('realtime-income');
    const realtimeExpensesEl = document.getElementById('realtime-expenses');
    const realtimeNetflowEl = document.getElementById('realtime-netflow');
    const realtimeTurnEl = document.getElementById('realtime-turn');
    const realtimePopulationEl = document.getElementById('realtime-population');
    const realtimeHealthStatusEl = document.getElementById('realtime-health-status');
    const realtimeHealthMessageEl = document.getElementById('realtime-health-message');
    const realtimeTaxesEl = document.getElementById('realtime-taxes');
    const realtimeOtherIncomeEl = document.getElementById('realtime-other-income');
    const realtimeBuildingMaintenanceEl = document.getElementById('realtime-building-maintenance');
    const realtimeLoanInterestEl = document.getElementById('realtime-loan-interest');
    const realtimeInvestmentsEl = document.getElementById('realtime-investments');
    // Starvation alerts removed

    if (!realtimeFundsEl) {
        console.warn('Realtime budget elements not found');
        return;
    }

    try {
        
        if (window.budgetManager) {
            const budgetData = await window.budgetManager.getCurrentBudget();
            const financialHealth = await window.budgetManager.getFinancialHealth();
            const incomeBreakdown = await window.budgetManager.getIncomeBreakdown();
            const expenseBreakdown = await window.budgetManager.getExpenseBreakdown();
            
            // Get population data from IndexedDB
            // Primary source: housesStore (sums house.pop from houses table) - source of truth
            // Fallback: gameStore (game table) for backwards compatibility
            let population = 0;
            let populationError = false;
            try {
                // Try housesStore first (source of truth - calculates from house.pop)
                if (housesStore && typeof housesStore.getGlobalPopulation === 'function') {
                    population = await housesStore.getGlobalPopulation();
                    population = population || 0;
                    console.log('[buttons.js > updateRealtimeBudget] Population from housesStore (IndexedDB):', population);
                } else if (window.housesStore && typeof window.housesStore.getGlobalPopulation === 'function') {
                    population = await window.housesStore.getGlobalPopulation();
                    population = population || 0;
                    console.log('[buttons.js > updateRealtimeBudget] Population from housesStore (IndexedDB, window):', population);
                } else {
                    // Fallback to gameStore (also IndexedDB, but may be stale)
                    console.warn('[buttons.js > updateRealtimeBudget] ⚠️ housesStore.getGlobalPopulation not available, FALLING BACK to gameStore (may be stale)');
                    if (window.gameStore && typeof window.gameStore.getLatestGameItemByField === 'function') {
                        const gamePop = await window.gameStore.getLatestGameItemByField('population');
                        population = gamePop !== null && gamePop !== undefined ? gamePop : 0;
                        console.warn('[buttons.js > updateRealtimeBudget] ⚠️ Using FALLBACK population from gameStore:', {
                            population,
                            source: 'gameStore (IndexedDB game table)',
                            note: 'This may not reflect real-time house population changes'
                        });
                    } else {
                        console.error('[buttons.js > updateRealtimeBudget] ❌ Both housesStore and gameStore unavailable! Population set to 0');
                        population = 0;
                    }
                }
            } catch (error) {
                console.error('[buttons.js > updateRealtimeBudget] Error fetching population from IndexedDB:', error);
                population = 0;
                populationError = true;
            }
            
            // Mettre à jour les fonds principaux
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
            
            // Mettre à jour les détails financiers
            if (realtimeIncomeEl) {
                const income = budgetData.income || 0;
                realtimeIncomeEl.textContent = `${income.toLocaleString('fr-FR')}€`;
            }
            if (realtimeExpensesEl) {
                const expenses = budgetData.expenses || 0;
                realtimeExpensesEl.textContent = `${expenses.toLocaleString('fr-FR')}€`;
            }
            if (realtimeNetflowEl) {
                const netFlow = (budgetData.income || 0) - (budgetData.expenses || 0);
                realtimeNetflowEl.textContent = `${netFlow.toLocaleString('fr-FR')}€`;
                // Colorer le flux net selon s'il est positif ou négatif
                if (netFlow > 0) {
                    realtimeNetflowEl.style.color = 'var(--success)';
                } else if (netFlow < 0) {
                    realtimeNetflowEl.style.color = 'var(--danger)';
                } else {
                    realtimeNetflowEl.style.color = 'var(--cta)';
                }
            }
            // Mettre à jour les informations générales
            if (realtimeTurnEl) {
                const turnSpan = realtimeTurnEl.querySelector('span');
                if (turnSpan) {
                    turnSpan.textContent = budgetData.turn || 0;
                } else {
                    realtimeTurnEl.textContent = budgetData.turn || 0;
                }
            }
            if (realtimePopulationEl) {
                const populationSpan = realtimePopulationEl.querySelector('span');
                if (populationSpan) {
                    populationSpan.textContent = population.toString();
                    
                    // Style différent selon l'état
                    if (populationError) {
                        populationSpan.style.color = '#ff6b6b'; // Rouge pour erreur
                        realtimePopulationEl.title = 'Erreur lors du chargement de la population';
                    } else {
                        populationSpan.style.color = '#fff'; // Blanc pour valeur normale
                        realtimePopulationEl.title = `Population actuelle (${population} habitants)`;
                    }
                } else {
                    realtimePopulationEl.textContent = population.toString();
                }
                
                console.log('[buttons.js > updateRealtimeBudget] Updated realtime population display:', {
                    population,
                    hasError: populationError,
                    elementExists: !!realtimePopulationEl
                });
            }
            
            // Mettre à jour la santé financière
            if (realtimeHealthStatusEl && realtimeHealthMessageEl) {
                realtimeHealthStatusEl.textContent = getHealthStatusText(financialHealth.status);
                realtimeHealthMessageEl.textContent = financialHealth.message;
                
                // Appliquer la classe CSS appropriée
                realtimeHealthStatusEl.className = 'realtime-health-status ' + financialHealth.status;
            }
            
            // Mettre à jour les détails des revenus
            if (realtimeTaxesEl) {
                const taxes = incomeBreakdown.taxes || 0;
                realtimeTaxesEl.textContent = `${taxes.toLocaleString('fr-FR')}€`;
            }
            if (realtimeOtherIncomeEl) {
                const otherIncome = incomeBreakdown.otherIncome || 0;
                realtimeOtherIncomeEl.textContent = `${otherIncome.toLocaleString('fr-FR')}€`;
            }
            
            // Mettre à jour les détails des dépenses
            if (realtimeBuildingMaintenanceEl) {
                const buildingMaintenance = expenseBreakdown.buildingMaintenance || 0;
                realtimeBuildingMaintenanceEl.textContent = `${buildingMaintenance.toLocaleString('fr-FR')}€`;
            }
            if (realtimeLoanInterestEl) {
                const loanInterest = budgetData.totalLoanInterestExpenses || 0;
                realtimeLoanInterestEl.textContent = `${loanInterest.toLocaleString('fr-FR')}€`;
            }
            if (realtimeInvestmentsEl) {
                const investments = expenseBreakdown.investments || 0;
                realtimeInvestmentsEl.textContent = `${investments.toLocaleString('fr-FR')}€`;
            }
            
            // Mettre à jour le détail du calcul des intérêts des dettes
            updateLoanInterestDetail(budgetData);
            
            // Starvation alerts removed
        } else {
            // Valeurs par défaut si le budget manager n'est pas disponible
            realtimeFundsEl.textContent = 'Non disponible';
            realtimeFundsEl.style.color = '#ff6b6b';
            realtimeFundsEl.title = 'Budget manager non initialisé';
            
            if (realtimeIncomeEl) {
                realtimeIncomeEl.textContent = 'N/A';
                realtimeIncomeEl.style.color = '#ffa726';
            }
            if (realtimeExpensesEl) {
                realtimeExpensesEl.textContent = 'N/A';
                realtimeExpensesEl.style.color = '#ffa726';
            }
            if (realtimeNetflowEl) {
                realtimeNetflowEl.textContent = 'N/A';
                realtimeNetflowEl.style.color = '#ffa726';
            }
            if (realtimeTurnEl) {
                const turnSpan = realtimeTurnEl.querySelector('span');
                if (turnSpan) {
                    turnSpan.textContent = 'N/A';
                    turnSpan.style.color = '#ffa726';
                } else {
                    realtimeTurnEl.textContent = 'N/A';
                }
            }
            if (realtimePopulationEl) {
                const populationSpan = realtimePopulationEl.querySelector('span');
                if (populationSpan) {
                    populationSpan.textContent = 'N/A';
                    populationSpan.style.color = '#ffa726';
                    realtimePopulationEl.title = 'Budget manager non initialisé';
                } else {
                    realtimePopulationEl.textContent = 'N/A';
                }
            }
            if (realtimeHealthStatusEl) realtimeHealthStatusEl.textContent = 'Non disponible';
            if (realtimeHealthMessageEl) realtimeHealthMessageEl.textContent = 'Budget manager non initialisé';
            if (realtimeTaxesEl) {
                realtimeTaxesEl.textContent = 'N/A';
                realtimeTaxesEl.style.color = '#ffa726';
            }
            if (realtimeOtherIncomeEl) {
                realtimeOtherIncomeEl.textContent = 'N/A';
                realtimeOtherIncomeEl.style.color = '#ffa726';
            }
            if (realtimeBuildingMaintenanceEl) {
                realtimeBuildingMaintenanceEl.textContent = 'N/A';
                realtimeBuildingMaintenanceEl.style.color = '#ffa726';
            }
            if (realtimeLoanInterestEl) {
                realtimeLoanInterestEl.textContent = 'N/A';
                realtimeLoanInterestEl.style.color = '#ffa726';
            }
            if (realtimeInvestmentsEl) {
                realtimeInvestmentsEl.textContent = 'N/A';
                realtimeInvestmentsEl.style.color = '#ffa726';
            }
        }
    } catch (error) {
        console.error('Error updating real-time budget:', error);
        realtimeFundsEl.textContent = 'Erreur';
        realtimeFundsEl.style.color = '#ff6b6b';
        if (realtimeHealthStatusEl) realtimeHealthStatusEl.textContent = 'Erreur';
        if (realtimeHealthMessageEl) realtimeHealthMessageEl.textContent = 'Impossible de charger les données';
        
        // Show population span even on error
        if (realtimePopulationEl) {
            const populationSpan = realtimePopulationEl.querySelector('span');
            if (populationSpan) {
                populationSpan.textContent = 'Erreur';
                populationSpan.style.color = '#ff6b6b';
                realtimePopulationEl.title = 'Erreur lors du chargement de la population';
            }
        }
    }
}

function getHealthStatusText(status) {
    const statusMap = {
        'healthy': 'Sain',
        'warning': 'Attention',
        'critical': 'Critique',
        'excellent': 'Excellent',
        'deficit': 'Déficitaire'
    };
    return statusMap[status] || 'Inconnu';
}

// Update loan interest calculation detail
async function updateLoanInterestDetail(budgetData) {
    const detailContainer = document.getElementById('realtime-loan-interest-detail');
    if (!detailContainer) return;
    
    try {
        const activeLoans = await budgetManager.getActiveLoans();
        
        if (activeLoans.length === 0) {
            detailContainer.innerHTML = `
                <div class="no-loans-message">
                    <span class="no-loans-icon">📭</span>
                    <span class="no-loans-text">Aucun prêt actif</span>
                </div>
            `;
            return;
        }
        
        let totalInterest = 0;
        const loanCalculations = activeLoans.map(loan => {
            const monthlyInterest = Math.round(loan.amount * (loan.interestRate / 100) / loan.duration);
            totalInterest += monthlyInterest;
            
            return `
                <div class="loan-interest-calculation">
                    <div class="loan-interest-calculation-header">
                        <div class="loan-interest-calculation-title">
                            ${loan.type === 'bank' ? '🏛️ Prêt Bancaire' : '🏪 Prêt Commercial'} (${loan.id.slice(-6)})
                        </div>
                        <div class="loan-interest-calculation-amount">${monthlyInterest.toLocaleString('fr-FR')}€/tour</div>
                    </div>
                    <div class="loan-interest-calculation-details">
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Montant emprunté:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.amount.toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Taux d'intérêt:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.interestRate}%</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Durée:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.duration} tours</span>
                        </div>
                        <div class="loan-interest-calculation-detail">
                            <span class="loan-interest-calculation-detail-label">Calcul:</span>
                            <span class="loan-interest-calculation-detail-value">${loan.amount.toLocaleString('fr-FR')}€ × ${loan.interestRate}% ÷ ${loan.duration} = ${monthlyInterest.toLocaleString('fr-FR')}€/tour</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        detailContainer.innerHTML = `
            ${loanCalculations}
            <div class="loan-interest-calculation" style="border-left-color: var(--success); background: rgba(0, 255, 0, 0.05);">
                <div class="loan-interest-calculation-header">
                    <div class="loan-interest-calculation-title">💰 Total Intérêts par Tour</div>
                    <div class="loan-interest-calculation-amount" style="color: var(--success);">${totalInterest.toLocaleString('fr-FR')}€</div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error updating loan interest detail:', error);
        detailContainer.innerHTML = `
            <div class="no-loans-message">
                <span class="no-loans-icon">❌</span>
                <span class="no-loans-text">Erreur lors du chargement</span>
            </div>
        `;
    }
}

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
        const typeLike = neighbor.name || neighbor.type || neighbor.buildingId || '';
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
        
        // Get all houses from database - use local housesStore or fallback to window
        let houses = [];
        try {
            if (housesStore && typeof housesStore.listAllHouses === 'function') {
                houses = await housesStore.listAllHouses();
            } else if (window.housesStore && typeof window.housesStore.listAllHouses === 'function') {
                houses = await window.housesStore.listAllHouses();
            } else {
                throw new Error('housesStore not available');
            }
        } catch (error) {
            console.warn('Could not access housesStore:', error);
            houses = [];
        }
        
        // Create a map of buildings by position (x,y)
        const buildingMap = new Map();
        houses.forEach(house => {
            if (house.x !== undefined && house.y !== undefined) {
                const key = `${house.x},${house.y}`;
                buildingMap.set(key, house);
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
                    
                    // Check for road access (only for buildings that need it)
                    let hasRoad = true;
                    try {
                        const { checkRoadAccess } = await import('../game/modules/ModuleHelper.js');
                        hasRoad = needsRoadAccess ? checkRoadAccess(neighbors).hasAccess : true;
                    } catch (err) {
                        console.warn('[ui/buttons.js > generateCityMap] Falling back to inline road access check because ModuleHelper import failed.', {
                            error: err?.message || err,
                            buildingType: building.type,
                            neighborsCount: neighbors?.length ?? 0
                        });
                        // Fallback to previous inline logic if helper not available
                        hasRoad = needsRoadAccess ? neighbors.some(neighbor => neighbor.name === 'roads' || neighbor.name === 'Road') : true;
                    }
                    
                    // Check if building can have food (houses, markets, but not roads, wells, etc.)
                    const canHaveFood = building.type.includes('House') || building.type.includes('Market') || building.type.includes('Farm');
                    
                    // Check for food stocks (only for buildings that can have food)
                    const stocks = building.stocks || {};
                    const hasFood = canHaveFood ? (stocks.food > 0 || stocks.wheat > 0 || stocks.carrot > 0 || stocks.cabbage > 0) : true;
                    
                    // Check if house is too far from market (for houses only)
                    const isHouse = building.type && (building.type.includes('House') || building.type.includes('house'));
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
function initBudgetStatesPopup() {
    const budgetStatesBtn = document.getElementById('budget-states-btn');
    const budgetStatesPanel = document.getElementById('budget-states-panel');
    const budgetStatesCloseBtn = document.querySelector('.budget-states-close-btn');
    const budgetStatesList = document.getElementById('budget-states-list');
    const summaryContent = document.getElementById('summary-content');
    const filterButtons = document.querySelectorAll('.budget-filter-btn');

    if (!budgetStatesBtn || !budgetStatesPanel || !budgetStatesCloseBtn) {
        console.warn('Budget states popup elements not found');
        return;
    }

    // Toggle popup on budget states button click
    budgetStatesBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (e.target === budgetStatesBtn || budgetStatesBtn.contains(e.target)) {
            budgetStatesPanel.classList.toggle('active');
            budgetStatesBtn.classList.toggle('active');
            
            if (budgetStatesPanel.classList.contains('active')) {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceOpenPopup('budget-states-panel');
                }
                // Load budget states first
                await loadBudgetStates('3', true);
                // Update labels after loading data
                await updateFilterButtonLabels();
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    window.popupManager.forceClosePopup('budget-states-panel');
                }
            }
        }
    });

    // Close popup on close button click
    budgetStatesCloseBtn.addEventListener('click', () => {
        budgetStatesPanel.classList.remove('active');
        budgetStatesBtn.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('budget-states-panel');
        }
    });

    // Close popup when clicking outside
    budgetStatesPanel.addEventListener('click', (e) => {
        if (e.target === budgetStatesPanel) {
            budgetStatesPanel.classList.remove('active');
            budgetStatesBtn.classList.remove('active');
        }
    });

    // Filter button event listeners
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Load budget states with filter first (no loading state to avoid flash)
            const period = btn.dataset.period;
            await loadBudgetStates(period, false);
            
            // Update labels after loading data to avoid hiding buttons prematurely
            await updateFilterButtonLabels();
        });
    });

    // Update filter button labels dynamically
    updateFilterButtonLabels();
}

async function updateFilterButtonLabels() {
    try {
        if (!window.budgetManager) {
            console.warn('BudgetManager not available for updating filter labels');
            return;
        }

        // Get all budget states from the store
        const allStates = await window.budgetManager.getBudgetStates();
        
        if (allStates.length === 0) {
            return;
        }

        // Sort by turn descending to get the most recent first
        const sortedStates = allStates.sort((a, b) => b.turn - a.turn);
        
        // Take the last 3 states (most recent)
        const last3States = sortedStates.slice(0, 3);
        
        // Sort by turn ascending for display order
        last3States.sort((a, b) => a.turn - b.turn);

        // Update the first 3 filter buttons (skip "Tous")
        const filterButtons = document.querySelectorAll('.budget-filter-btn');
        for (let i = 0; i < 3; i++) {
            const btn = filterButtons[i];
            if (btn && !btn.dataset.period.includes('all')) {
                if (i < last3States.length) {
                    // Show the actual turn from budget state
                    const turn = last3States[i].turn;
                    btn.textContent = `${turn} jours`;
                    btn.dataset.period = turn.toString();
                    btn.style.display = 'block';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                } else {
                    // Keep button visible but disabled if no state available
                    btn.style.display = 'block';
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.textContent = `${3 + i} jours`; // Fallback text
                }
            }
        }

    } catch (error) {
        console.warn('Error updating filter button labels:', error);
    }
}

async function loadBudgetStates(period = '3', showLoading = true) {
    const budgetStatesList = document.getElementById('budget-states-list');
    const summaryContent = document.getElementById('summary-content');
    
    if (!budgetStatesList || !summaryContent) {
        console.warn('Budget states display elements not found');
        return;
    }

    // Only show loading state if explicitly requested (first load)
    if (showLoading) {
        budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Chargement des états de budget...</p>
            </div>
        `;
    }

    try {
        if (!window.budgetManager) {
            throw new Error('BudgetManager not available');
        }

        let budgetStates = [];
        
        if (period === 'all') {
            budgetStates = await window.budgetManager.getBudgetStates();
        } else {
            const turnNumber = parseInt(period);
            if (!isNaN(turnNumber)) {
                // Pour les périodes dynamiques : afficher l'état du tour spécifique
                const allStates = await window.budgetManager.getBudgetStates();
                budgetStates = allStates.filter(state => state.turn === turnNumber);
            } else {
                // Fallback pour autres valeurs
                budgetStates = await window.budgetManager.getBudgetStatesEveryNTurns(3);
            }
        }

        if (budgetStates.length === 0) {
            budgetStatesList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun état de budget disponible</p>
                    <small>Les états sont collectés tous les 3 tours</small>
                </div>
            `;
            summaryContent.innerHTML = '<p>Aucune donnée disponible</p>';
            return;
        }

        // Filter out invalid states (missing required fields)
        const validStates = budgetStates.filter(state => 
            state && 
            typeof state.funds === 'number' && 
            typeof state.income === 'number' && 
            typeof state.expenses === 'number'
        );

        if (validStates.length === 0) {
            budgetStatesList.innerHTML = `
                <div class="budget-state-loading">
                    <p>Aucun état de budget valide disponible</p>
                    <small>Les données peuvent être corrompues</small>
                </div>
            `;
            summaryContent.innerHTML = '<p>Aucune donnée valide disponible</p>';
            return;
        }

        // Display budget states
        displayBudgetStates(validStates, budgetStatesList);
        
        // Display summary
        displayBudgetSummary(validStates, summaryContent);

    } catch (error) {
        console.error('Error loading budget states:', error);
        budgetStatesList.innerHTML = `
            <div class="budget-state-loading">
                <p>Erreur lors du chargement des états</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function displayBudgetStates(states, container) {
    container.innerHTML = states.map(state => {
        // Safely get values with fallbacks (using same keys as budget_current)
        const funds = state.funds || 0;
        const income = state.income || 0;
        const expenses = state.expenses || 0;
        const netFlow = state.netFlow || 0;
        const dailyIncome = state.dailyIncome || 0;
        const dailyExpenses = state.dailyExpenses || 0;
        const population = state.population || 0;
        const healthStatus = state.financialHealth?.status || 'healthy';
        const date = state.date ? new Date(state.date).toLocaleDateString('fr-FR') : 'N/A';
        
        return `
        <div class="budget-state-item">
            <div class="budget-state-header">
                <div class="budget-state-turn">Tour ${state.turn || 'N/A'}</div>
                <div class="budget-state-date">${date}</div>
            </div>
            
            <!-- Compte de Résultat -->
            <div class="budget-income-statement">
                <div class="statement-section">
                    <h4 class="statement-title">PRODUITS</h4>
                    <div class="statement-line">
                        <span class="statement-label">Impôt Citoyen (${population} hab.)</span>
                        <span class="statement-value positive">${(state.totalTaxes || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    ${state.taxBreakdown ? `
                    <div class="statement-subdetail" style="padding-left: 20px; margin: 8px 0;">
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons bleues</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Blue'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons rouges</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Red'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Maisons violettes</span>
                            <span class="statement-value">${(state.taxBreakdown['House-Purple'] || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="statement-line">
                        <span class="statement-label">Autres revenus</span>
                        <span class="statement-value positive">${((income || 0) - (state.totalTaxes || 0)).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL PRODUITS</span>
                        <span class="statement-value total positive">${income.toLocaleString('fr-FR')}€</span>
                    </div>
                </div>
                
                <div class="statement-section">
                    <h4 class="statement-title">CHARGES</h4>
                    <div class="statement-line">
                        <span class="statement-label">Maintenance bâtiments</span>
                        <span class="statement-value negative">-${(state.totalBuildingMaintenance || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    ${state.maintenanceBreakdown ? `
                    <div class="statement-subdetail" style="padding-left: 20px; margin: 8px 0;">
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Habitations</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.houses || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Fermes</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.farms || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Marchés</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.markets || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Routes</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.roads || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Infrastructure</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.infrastructure || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="statement-line" style="font-size: 0.85em;">
                            <span class="statement-label">• Industrie</span>
                            <span class="statement-value">-${(state.maintenanceBreakdown.industry || 0).toLocaleString('fr-FR')}€</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="statement-line">
                        <span class="statement-label">Intérêts dettes</span>
                        <span class="statement-value negative">-${(state.totalLoanInterestExpenses || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Intérêts des prêts bancaires et commerciaux contractés</small>
                    </div>
                    <div class="statement-line">
                        <span class="statement-label">Remboursements prêts</span>
                        <span class="statement-value negative">-${(state.totalLoanRepayments || 0).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Remboursement du capital des prêts (principal)</small>
                    </div>
                    <div class="statement-line">
                        <span class="statement-label">Autres charges</span>
                        <span class="statement-value negative">-${Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0)).toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-subnote">
                        <small>Autres dépenses non catégorisées (salaires, services, etc.)</small>
                    </div>
                    <div class="statement-line total-line">
                        <span class="statement-label">TOTAL CHARGES</span>
                        <span class="statement-value total negative">-${expenses.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div class="statement-note">
                        <small>Vérification: Maintenance (${state.totalBuildingMaintenance || 0}€) + Intérêts (${state.totalLoanInterestExpenses || 0}€) + Remboursements (${state.totalLoanRepayments || 0}€) + Autres (${Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0))}€) = ${(state.totalBuildingMaintenance || 0) + (state.totalLoanInterestExpenses || 0) + (state.totalLoanRepayments || 0) + Math.max(0, (expenses || 0) - (state.totalBuildingMaintenance || 0) - (state.totalLoanInterestExpenses || 0) - (state.totalLoanRepayments || 0))}€</small>
                    </div>
                </div>
                
                <div class="statement-section result-section">
                    <div class="statement-line result-line">
                        <span class="statement-label">RÉSULTAT NET</span>
                        <span class="statement-value result ${netFlow >= 0 ? 'positive' : 'negative'}">
                            ${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString('fr-FR')}€
                        </span>
                    </div>
                    <div class="statement-note">
                        <small>Ce résultat doit correspondre au "Résultat de l'exercice" du bilan</small>
                    </div>
                </div>
            </div>
            
            <!-- Informations complémentaires -->
            <div class="budget-state-info">
                <div class="info-item">
                    <span class="info-label">Trésorerie</span>
                    <span class="info-value">${funds.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Population</span>
                    <span class="info-value">${population} habitants</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Santé financière</span>
                    <span class="info-value" style="color: ${getHealthStatusColor(healthStatus)}">
                        ${getHealthStatusText(healthStatus)}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label"></span>
                    <span class="info-value ${(state.loanDebt || 0) > 0 ? 'negative' : ''}">${(state.loanDebt || 0).toLocaleString('fr-FR')}€</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function displayBudgetSummary(states, container) {
    if (states.length === 0) {
        container.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }

    const firstState = states[0];
    const lastState = states[states.length - 1];
    
    // Safely calculate totals with fallbacks (using same keys as budget_current)
    const totalIncome = states.reduce((sum, state) => sum + (state.income || 0), 0);
    const totalExpenses = states.reduce((sum, state) => sum + (state.expenses || 0), 0);
    const averageFunds = states.reduce((sum, state) => sum + (state.funds || 0), 0) / states.length;
    const populationGrowth = (lastState.population || 0) - (firstState.population || 0);
    
    // Calculate loan-related totals
    const totalLoanInterest = states.reduce((sum, state) => sum + (state.totalLoanInterest || 0), 0);
    const totalLoanRepayments = states.reduce((sum, state) => sum + (state.totalLoanRepayments || 0), 0);
    const currentLoanDebt = lastState.loanDebt || 0;
    
    const buildingGrowth = calculateBuildingGrowth(firstState.buildingCounts || {}, lastState.buildingCounts || {});

    container.innerHTML = `
        <div class="budget-income-statement">
            <div class="statement-section">
                <h4 class="statement-title">RÉSUMÉ PÉRIODE (Tours ${firstState.turn || 'N/A'} - ${lastState.turn || 'N/A'})</h4>
                <div class="statement-line">
                    <span class="statement-label">Revenus totaux</span>
                    <span class="statement-value positive">${totalIncome.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Dépenses totales</span>
                    <span class="statement-value negative">-${totalExpenses.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line total-line">
                    <span class="statement-label">Résultat net</span>
                    <span class="statement-value total ${(totalIncome - totalExpenses) >= 0 ? 'positive' : 'negative'}">
                        ${(totalIncome - totalExpenses) >= 0 ? '+' : ''}${(totalIncome - totalExpenses).toLocaleString('fr-FR')}€
                    </span>
                </div>
            </div>
            
            <div class="statement-section">
                <h4 class="statement-title">INDICATEURS</h4>
                <div class="statement-line">
                    <span class="statement-label">Trésorerie moyenne</span>
                    <span class="statement-value">${averageFunds.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Croissance population</span>
                    <span class="statement-value ${populationGrowth >= 0 ? 'positive' : 'negative'}">
                        ${populationGrowth >= 0 ? '+' : ''}${populationGrowth} habitants
                    </span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Nouveaux bâtiments</span>
                    <span class="statement-value">
                        ${Object.entries(buildingGrowth)
                            .filter(([type, growth]) => growth > 0)
                            .map(([type, growth]) => `${type}: +${growth}`)
                            .join(', ') || 'Aucun'}
                    </span>
                </div>
            </div>
            
            <div class="statement-section">
                <h4 class="statement-title">DETTES</h4>
                <div class="statement-line">
                    <span class="statement-label">Intérêts payés</span>
                    <span class="statement-value negative">-${totalLoanInterest.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Remboursements</span>
                    <span class="statement-value negative">-${totalLoanRepayments.toLocaleString('fr-FR')}€</span>
                </div>
                <div class="statement-line">
                    <span class="statement-label">Dette actuelle</span>
                    <span class="statement-value ${currentLoanDebt > 0 ? 'negative' : ''}">${currentLoanDebt.toLocaleString('fr-FR')}€</span>
                </div>
            </div>
        </div>
    `;
}

function calculateBuildingGrowth(startBuildings, endBuildings) {
    const growth = {};
    const buildingTypes = ['houses', 'farms', 'markets', 'roads'];
    
    // Ensure we have valid objects
    const start = startBuildings || {};
    const end = endBuildings || {};
    
    for (const type of buildingTypes) {
        const startValue = start[type] || 0;
        const endValue = end[type] || 0;
        growth[type] = endValue - startValue;
    }
    
    return growth;
}

function getHealthStatusColor(status) {
    const colorMap = {
        'healthy': '#4ade80',
        'warning': '#ffa726',
        'critical': '#ff6b6b',
        'excellent': '#4ade80',
        'deficit': '#ff9800'
    };
    return colorMap[status] || '#4ade80';
}

// Starvation system removed

// Urban Advice Center Functions
function initUrbanAdviceCenter() {
    const budgetBtn = document.getElementById('budget-btn');
    const budgetPanel = document.getElementById('budget-panel');
    const budgetCloseBtn = document.querySelector('.budget-close-btn');
    const budgetTabs = document.querySelectorAll('.budget-tab');
    const tabContents = document.querySelectorAll('.budget-tab-content');

    if (!budgetBtn || !budgetPanel || !budgetCloseBtn) {
        return;
    }

    // Toggle panel on budget button click
    budgetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (e.target === budgetBtn || budgetBtn.contains(e.target)) {
            budgetPanel.classList.toggle('active');
            budgetBtn.classList.toggle('active');
            if (budgetPanel.classList.contains('active')) {
                // Load data when opening
                await loadUrbanAnalysis();
                await loadAdvice();
            }
        }
    });

    // Close panel on close button click
    budgetCloseBtn.addEventListener('click', () => {
        budgetPanel.classList.remove('active');
        budgetBtn.classList.remove('active');
    });

    // Close panel when clicking outside
    budgetPanel.addEventListener('click', (e) => {
        if (e.target === budgetPanel) {
            budgetPanel.classList.remove('active');
            budgetBtn.classList.remove('active');
        }
    });

    // Tab switching
    budgetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active class from all tabs and contents
            budgetTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Load specific data based on tab
            if (targetTab === 'analysis') {
                loadUrbanAnalysis();
            } else if (targetTab === 'advice') {
                loadAdvice();
            } else if (targetTab === 'loans') {
                loadActiveLoans();
            }
        });
    });

    // Initialize loan system
    initLoanSystem();
}

async function loadUrbanAnalysis() {
    try {
        // Get all houses from database
        const houses = await window.housesStore.listAllHouses();
        
        // Analyze social classes
        const socialClasses = {
            red: 0,    // Classe populaire
            blue: 0,   // Classe moyenne  
            purple: 0  // Classe aisée
        };

        // Count houses by color/type
        houses.forEach(house => {
            if (house.type && house.type.includes('House')) {
                if (house.type.includes('Red')) {
                    socialClasses.red++;
                } else if (house.type.includes('Blue')) {
                    socialClasses.blue++;
                } else if (house.type.includes('Purple')) {
                    socialClasses.purple++;
                }
            }
        });

        // Update social classes display
        document.getElementById('red-houses').textContent = socialClasses.red;
        document.getElementById('blue-houses').textContent = socialClasses.blue;
        document.getElementById('purple-houses').textContent = socialClasses.purple;

        // Analyze commerce (markets)
        const markets = houses.filter(house => 
            house.type && house.type.includes('Market')
        );
        document.getElementById('food-markets').textContent = markets.length;

        // Analyze agriculture (farms)
        const farms = houses.filter(house => 
            house.type && house.type.includes('Farm')
        );
        
        const fieldTypes = {
            cabbage: 0,
            wheat: 0,
            carrot: 0
        };

        farms.forEach(farm => {
            if (farm.type.includes('Cabbage')) fieldTypes.cabbage++;
            else if (farm.type.includes('Wheat')) fieldTypes.wheat++;
            else if (farm.type.includes('Carrot')) fieldTypes.carrot++;
        });

        document.getElementById('cabbage-fields').textContent = fieldTypes.cabbage;
        document.getElementById('wheat-fields').textContent = fieldTypes.wheat;
        document.getElementById('carrot-fields').textContent = fieldTypes.carrot;


    } catch (error) {
        console.error('Error loading urban analysis:', error);
    }
}

async function loadAdvice() {
    const adviceList = document.getElementById('advice-list');
    
    try {
        // Get current city data
        const houses = await window.housesStore.listAllHouses();
        const budget = await window.budgetManager.getCurrentBudget();
        
        const advice = [];

        // Check for missing markets
        const markets = houses.filter(house => 
            house.type && house.type.includes('Market')
        );
        
        if (markets.length === 0) {
            advice.push({
                type: 'priority',
                icon: '🛒',
                title: 'Marché manquant',
                description: 'Construisez un marché de nourriture pour distribuer les ressources agricoles à vos habitants.'
            });
        }

        // Check for food production vs population
        const farms = houses.filter(house => 
            house.type && house.type.includes('Farm')
        );
        const totalPopulation = houses.reduce((sum, house) => 
            sum + (house.pop || 0), 0
        );

        if (totalPopulation > 0 && farms.length === 0) {
            advice.push({
                type: 'priority',
                icon: '🌾',
                title: 'Production alimentaire insuffisante',
                description: 'Vos habitants ont besoin de nourriture. Construisez des fermes pour produire des aliments.'
            });
        }

        // Check for road connectivity (use helper when available; fallback preserved)
        const housesWithoutRoads = [];
        for (const house of houses) {
            if (!house.type || !house.type.includes('House')) continue;
            let hasRoadAccess = false;
            try {
                const { checkRoadAccess } = await import('../game/modules/ModuleHelper.js');
                hasRoadAccess = !!(house.neighbors && checkRoadAccess(house.neighbors).hasAccess);
            } catch (err) {
                console.warn('[ui/buttons.js > initUrbanAdviceCenter] Falling back to inline road access check because ModuleHelper import failed.', {
                    error: err?.message || err,
                    houseId: house.id,
                    neighborsCount: house.neighbors?.length ?? 0
                });
                hasRoadAccess = !!(house.neighbors && house.neighbors.filter(n => n.name === 'roads').length > 0);
            }
            if (!hasRoadAccess) housesWithoutRoads.push(house);
        }

        if (housesWithoutRoads.length > 0) {
            advice.push({
                type: 'priority',
                icon: '🛣️',
                title: 'Maisons sans accès routier',
                description: `${housesWithoutRoads.length} maison(s) n'ont pas d'accès aux routes. Connectez-les pour permettre le commerce.`
            });
        }

        // Financial advice
        if (budget.funds < 50) {
            advice.push({
                type: 'priority',
                icon: '💰',
                title: 'Fonds insuffisants',
                description: 'Vos fonds sont faibles. Considérez contracter un prêt ou réduire vos dépenses.'
            });
        } else if (budget.funds > 500) {
            advice.push({
                type: 'suggestion',
                icon: '🏗️',
                title: 'Opportunité d\'expansion',
                description: 'Vous avez des fonds suffisants pour développer votre ville. Construisez de nouveaux bâtiments !'
            });
        }

        // Social balance advice
        const socialClasses = {
            red: houses.filter(h => h.type && h.type.includes('Red')).length,
            blue: houses.filter(h => h.type && h.type.includes('Blue')).length,
            purple: houses.filter(h => h.type && h.type.includes('Purple')).length
        };

        const totalHouses = socialClasses.red + socialClasses.blue + socialClasses.purple;
        if (totalHouses > 0) {
            const redPercentage = (socialClasses.red / totalHouses) * 100;
            if (redPercentage > 70) {
                advice.push({
                    type: 'suggestion',
                    icon: '🏘️',
                    title: 'Diversité sociale',
                    description: 'Votre ville est principalement composée de maisons populaires. Diversifiez avec des maisons de classe moyenne et aisée.'
                });
            }
        }

        // Display advice
        if (advice.length === 0) {
            adviceList.innerHTML = `
                <div class="advice-item suggestion">
                    <div class="advice-header">
                        <div class="advice-icon">✅</div>
                        <div class="advice-title">Ville équilibrée</div>
                    </div>
                    <div class="advice-description">Votre ville semble bien équilibrée ! Continuez sur cette voie.</div>
                </div>
            `;
        } else {
            adviceList.innerHTML = advice.map(item => `
                <div class="advice-item ${item.type}">
                    <div class="advice-header">
                        <div class="advice-icon">${item.icon}</div>
                        <div class="advice-title">${item.title}</div>
                    </div>
                    <div class="advice-description">${item.description}</div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Error loading advice:', error);
        adviceList.innerHTML = `
            <div class="advice-loading">
                Erreur lors du chargement des conseils
            </div>
        `;
    }
}

function initLoanSystem() {
    const loanAmountInput = document.getElementById('loan-amount');
    const loanDurationSelect = document.getElementById('loan-duration');
    const contractLoanBtn = document.getElementById('contract-loan-btn');
    const loanPrincipal = document.getElementById('loan-principal');
    const loanInterest = document.getElementById('loan-interest');
    const loanTotal = document.getElementById('loan-total');

    if (!loanAmountInput || !loanDurationSelect || !contractLoanBtn) {
        console.warn('Loan system elements not found');
        return;
    }

    // Update loan summary when inputs change
    function updateLoanSummary() {
        const amount = parseInt(loanAmountInput.value) || 0;
        const duration = parseInt(loanDurationSelect.value) || 10;
        
        // Calculate interest rate based on duration
        let interestRate = 0.05; // 5%
        if (duration === 15) interestRate = 0.07; // 7%
        if (duration === 20) interestRate = 0.10; // 10%
        
        const interest = Math.round(amount * interestRate);
        const total = amount + interest;
        
        loanPrincipal.textContent = `${amount}€`;
        loanInterest.textContent = `${interest}€`;
        loanTotal.textContent = `${total}€`;
    }

    loanAmountInput.addEventListener('input', updateLoanSummary);
    loanDurationSelect.addEventListener('change', updateLoanSummary);

    // Contract loan
    contractLoanBtn.addEventListener('click', async () => {
        const amount = parseInt(loanAmountInput.value);
        const duration = parseInt(loanDurationSelect.value);
        
        if (!amount || amount < 50 || amount > 1000) {
            alert('Le montant doit être entre 50€ et 1000€');
            return;
        }

        try {
            // Calculate interest
            let interestRate = 0.05;
            if (duration === 15) interestRate = 0.07;
            if (duration === 20) interestRate = 0.10;
            
            const interest = Math.round(amount * interestRate);
            const total = amount + interest;

            // Add loan to budget
            await window.budgetManager.addIncome(amount, `Prêt contracté (${duration} tours)`);
            
            // Store loan information (you might want to create a loans table)
            const loan = {
                id: `loan_${Date.now()}`,
                amount: amount,
                total: total,
                interest: interest,
                duration: duration,
                remainingTurns: duration,
                contractedAt: new Date().toISOString()
            };

            // Store in localStorage for now (you might want to use IndexedDB)
            const activeLoans = JSON.parse(localStorage.getItem('activeLoans') || '[]');
            activeLoans.push(loan);
            localStorage.setItem('activeLoans', JSON.stringify(activeLoans));

            alert(`Prêt de ${amount}€ contracté ! Total à rembourser : ${total}€ sur ${duration} tours.`);
            
            // Reset form
            loanAmountInput.value = '200';
            loanDurationSelect.value = '10';
            updateLoanSummary();
            
            // Reload active loans
            loadActiveLoans();

        } catch (error) {
            console.error('Error contracting loan:', error);
            alert('Erreur lors de la contraction du prêt');
        }
    });

    // Initial update
    updateLoanSummary();
}


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

// Loans Popup Functions
function initLoansPopup() {
    const loansBtn = document.getElementById('loans-btn');
    const loansPanel = document.getElementById('loans-panel');
    const loansCloseBtn = document.querySelector('.loans-panel-close-btn');
    const loanSelectBtns = document.querySelectorAll('.loan-select-btn');
    const loanFormSection = document.getElementById('loan-form-section');
    const loanCancelBtn = document.getElementById('loan-cancel-btn');
    const loanContractBtn = document.getElementById('loan-contract-btn');
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');

    if (!loansBtn || !loansPanel || !loansCloseBtn) {
        console.warn('Loans popup elements not found');
        return;
    }

    // Toggle popup on loans button click
    loansBtn.addEventListener('click', () => {
        console.log('Loans button clicked!');
        loansPanel.classList.add('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('loans-panel');
        }
        
        updateLoansDisplay();
    });

    // Close popup on close button click
    loansCloseBtn.addEventListener('click', () => {
        loansPanel.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('loans-panel');
        }
    });

    // Close popup when clicking outside
    loansPanel.addEventListener('click', (e) => {
        if (e.target === loansPanel) {
            loansPanel.classList.remove('active');
            
            // Utiliser PopupManager pour gérer les événements
            if (window.popupManager) {
                window.popupManager.forceClosePopup('loans-panel');
            }
        }
    });

    // Loan selection buttons
    loanSelectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const loanType = btn.dataset.loanType;
            showLoanForm(loanType);
        });
    });

    // Cancel loan form
    if (loanCancelBtn) {
        loanCancelBtn.addEventListener('click', () => {
            hideLoanForm();
        });
    }

    // Contract loan
    if (loanContractBtn) {
        loanContractBtn.addEventListener('click', () => {
            contractLoan();
        });
    }

    // Update loan summary when inputs change
    if (loanAmountInput && loanDurationInput) {
        loanAmountInput.addEventListener('input', updateLoanSummary);
        loanDurationInput.addEventListener('change', updateLoanSummary);
    }
}

async function updateLoansDisplay() {
    try {
        // Get budget data
        const currentBudget = await budgetManager.getCurrentBudget();
        const financialHealth = await budgetManager.getFinancialHealth();
        
        // Update date
        updateLoansElement('loans-date', `Tour ${currentBudget.turn || 0}`);
        
        // Update health indicator
        const healthIndicatorEl = document.getElementById('loans-health-indicator');
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
        
        // Update health impact section
        updateHealthImpact(financialHealth);
        
        // Update loan rates based on financial health
        updateLoanRates(financialHealth);
        
        // Load active loans
        loadActiveLoans();
        
    } catch (error) {
        console.error('Error updating loans display:', error);
    }
}

function updateLoansElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function updateHealthImpact(financialHealth) {
    const healthImpactEl = document.getElementById('health-impact');
    if (!healthImpactEl) return;
    
    let healthStatusClass = 'health-status-good';
    let healthIcon = '✅';
    let healthText = 'Finance saine - Taux préférentiels disponibles';
    
    if (financialHealth.status === 'critical') {
        healthStatusClass = 'health-status-critical';
        healthIcon = '⚠️';
        healthText = 'Finance critique - Taux élevés appliqués';
    } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
        healthStatusClass = 'health-status-warning';
        healthIcon = '⚠️';
        healthText = 'Finance fragile - Taux majorés';
    }
    
    healthImpactEl.innerHTML = `
        <div class="${healthStatusClass}">
            <span class="health-icon">${healthIcon}</span>
            <span class="health-text">${healthText}</span>
        </div>
    `;
}

function updateLoanRates(financialHealth) {
    // Base rates
    let bankRate = 5;
    let commercialRate = 7;
    
    // Adjust rates based on financial health
    if (financialHealth.status === 'critical') {
        bankRate += 5; // +5% penalty
        commercialRate += 7; // +7% penalty
    } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
        bankRate += 2; // +2% penalty
        commercialRate += 3; // +3% penalty
    }
    
    // Update display
    updateLoansElement('bank-rate', `Taux: ${bankRate}%`);
    updateLoansElement('commercial-rate', `Taux: ${commercialRate}%`);
}

function showLoanForm(loanType) {
    const loanFormSection = document.getElementById('loan-form-section');
    if (loanFormSection) {
        loanFormSection.style.display = 'block';
        
        // Set loan type specific values
        const loanAmountInput = document.getElementById('loan-amount-input');
        const loanDurationInput = document.getElementById('loan-duration-input');
        
        if (loanType === 'bank') {
            if (loanAmountInput) {
                loanAmountInput.min = '100';
                loanAmountInput.max = '1000';
                loanAmountInput.value = '500';
            }
            if (loanDurationInput) {
                loanDurationInput.innerHTML = `
                    <option value="10">10 tours</option>
                    <option value="15">15 tours</option>
                    <option value="20">20 tours</option>
                `;
            }
        } else if (loanType === 'commercial') {
            if (loanAmountInput) {
                loanAmountInput.min = '200';
                loanAmountInput.max = '2000';
                loanAmountInput.value = '1000';
            }
            if (loanDurationInput) {
                loanDurationInput.innerHTML = `
                    <option value="15">15 tours</option>
                    <option value="20">20 tours</option>
                    <option value="25">25 tours</option>
                    <option value="30">30 tours</option>
                `;
            }
        }
        
        // Store current loan type
        loanFormSection.dataset.loanType = loanType;
        
        // Update summary
        updateLoanSummary();
    }
}

function hideLoanForm() {
    const loanFormSection = document.getElementById('loan-form-section');
    if (loanFormSection) {
        loanFormSection.style.display = 'none';
    }
}

function updateLoanSummary() {
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');
    const loanFormSection = document.getElementById('loan-form-section');
    
    if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;
    
    const amount = parseInt(loanAmountInput.value) || 0;
    const duration = parseInt(loanDurationInput.value) || 10;
    const loanType = loanFormSection.dataset.loanType || 'bank';
    
    // Calculate interest rate based on loan type and financial health
    let interestRate = loanType === 'bank' ? 5 : 7;
    
    // Apply financial health penalties
    if (window.budgetManager) {
        window.budgetManager.getFinancialHealth().then(health => {
            if (health.status === 'critical') {
                interestRate += loanType === 'bank' ? 5 : 7;
            } else if (health.status === 'warning' || health.status === 'deficit') {
                interestRate += loanType === 'bank' ? 2 : 3;
            }
            
            const interest = Math.round(amount * (interestRate / 100));
            const total = amount + interest;
            
            updateLoansElement('loan-principal-display', `${amount}€`);
            updateLoansElement('loan-rate-display', `${interestRate}%`);
            updateLoansElement('loan-interest-display', `${interest}€`);
            updateLoansElement('loan-total-display', `${total}€`);
        });
    }
}

async function contractLoan() {
    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationInput = document.getElementById('loan-duration-input');
    const loanFormSection = document.getElementById('loan-form-section');
    
    if (!loanAmountInput || !loanDurationInput || !loanFormSection) return;
    
    const amount = parseInt(loanAmountInput.value);
    const duration = parseInt(loanDurationInput.value);
    const loanType = loanFormSection.dataset.loanType;
    
    if (!amount || amount < 100) {
        alert('Le montant doit être d\'au moins 100€');
        return;
    }
    
    try {
        // Calculate final interest rate
        const financialHealth = await budgetManager.getFinancialHealth();
        let interestRate = loanType === 'bank' ? 5 : 7;
        
        if (financialHealth.status === 'critical') {
            interestRate += loanType === 'bank' ? 5 : 7;
        } else if (financialHealth.status === 'warning' || financialHealth.status === 'deficit') {
            interestRate += loanType === 'bank' ? 2 : 3;
        }
        
        const interest = Math.round(amount * (interestRate / 100));
        const total = amount + interest;
        
        // Create loan object
        const loan = {
            id: `loan_${Date.now()}`,
            type: loanType,
            amount: amount,
            total: total,
            interest: interest,
            interestRate: interestRate,
            duration: duration,
            remainingTurns: duration,
            contractedAt: new Date().toISOString()
        };
        
        // Add loan to budget using proper accounting method
        await budgetManager.addLoan(amount, `Prêt ${loanType} contracté (${duration} tours)`, loan);
        
        // Update budget display to show the new loan interest
        updateBudgetDisplay();
        
        alert(`Prêt ${loanType} de ${amount}€ contracté ! Total à rembourser : ${total}€ sur ${duration} tours.`);
        
        // Reset form
        hideLoanForm();
        loadActiveLoans();
        
    } catch (error) {
        console.error('Error contracting loan:', error);
        alert('Erreur lors de la contraction du prêt');
    }
}

async function loadActiveLoans() {
    const activeLoansList = document.getElementById('active-loans-list');
    if (!activeLoansList) return;
    
    try {
        const activeLoans = await budgetManager.getActiveLoans();
        
        if (activeLoans.length === 0) {
            activeLoansList.innerHTML = `
                <div class="no-loans">
                    <span class="no-loans-icon">📭</span>
                    <span class="no-loans-text">Aucun prêt actif</span>
                </div>
            `;
            return;
        }
        
        activeLoansList.innerHTML = activeLoans.map(loan => {
            // Calculate amortization schedule
            const amortizationSchedule = generateAmortizationSchedule(loan);
            
            return `
                <div class="loan-item">
                    <div class="loan-item-header">
                        <div class="loan-type">${loan.type === 'bank' ? '🏛️ Bancaire' : '🏪 Commercial'}</div>
                        <div class="loan-amount">${loan.amount}€</div>
                        <div class="loan-progress">${loan.remainingTurns}/${loan.duration} tours</div>
                    </div>
                    <div class="loan-details">
                        <div>Taux: ${loan.interestRate}%</div>
                        <div>Total à rembourser: ${loan.total}€ (intérêts: ${loan.interest}€)</div>
                    </div>
                    
                    <!-- Amortization Schedule -->
                    <div class="amortization-schedule">
                        <h4>Tableau d'amortissement</h4>
                        <div class="schedule-summary">
                            <div class="summary-item">
                                <span class="label">Intérêts totaux restants:</span>
                                <span class="value">${amortizationSchedule.remainingInterest}€</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">Capital restant:</span>
                                <span class="value">${loan.amount}€</span>
                            </div>
                        </div>
                        
                        <div class="schedule-table">
                            <div class="schedule-header">
                                <div class="col-turn">Tour</div>
                                <div class="col-payment">Paiement</div>
                                <div class="col-interest">Intérêts</div>
                                <div class="col-principal">Capital</div>
                                <div class="col-balance">Solde</div>
                            </div>
                            ${amortizationSchedule.schedule.map((row, index) => `
                                <div class="schedule-row ${row.paid ? 'paid' : ''}">
                                    <div class="col-turn">${row.turn}</div>
                                    <div class="col-payment">${row.payment}€</div>
                                    <div class="col-interest">${row.interest}€</div>
                                    <div class="col-principal">${row.principal}€</div>
                                    <div class="col-balance">${row.balance}€</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading active loans:', error);
        activeLoansList.innerHTML = `
            <div class="no-loans">
                <span class="no-loans-icon">❌</span>
                <span class="no-loans-text">Erreur lors du chargement</span>
            </div>
        `;
    }
}

function generateAmortizationSchedule(loan) {
    const schedule = [];
    const monthlyPayment = Math.round(loan.total / loan.duration);
    const interestRate = loan.interestRate / 100;
    let remainingBalance = loan.amount;
    let totalInterestPaid = 0;
    let paidTurns = loan.duration - loan.remainingTurns;
    
    // Calculate total interest for the loan
    const totalInterest = loan.interest || Math.round(loan.amount * interestRate);
    
    for (let turn = 1; turn <= loan.duration; turn++) {
        const interestPayment = Math.round(remainingBalance * interestRate / loan.duration);
        const principalPayment = monthlyPayment - interestPayment;
        const isPaid = turn <= paidTurns;
        
        if (isPaid) {
            remainingBalance = Math.max(0, remainingBalance - principalPayment);
            totalInterestPaid += interestPayment;
        }
        
        schedule.push({
            turn: turn,
            payment: monthlyPayment,
            interest: interestPayment,
            principal: principalPayment,
            balance: remainingBalance,
            paid: isPaid
        });
    }
    
    const remainingInterest = Math.max(0, totalInterest - totalInterestPaid);
    
    return {
        schedule: schedule,
        remainingInterest: remainingInterest
    };
}

// Loan Management System
async function processLoanPayments() {
    try {
        const activeLoans = await budgetManager.getActiveLoans();
        if (activeLoans.length === 0) return;
        
        console.log(`💰 Processing loan payments for ${activeLoans.length} active loan(s)`);
        
        const loansToRemove = [];
        
        for (let i = 0; i < activeLoans.length; i++) {
            const loan = activeLoans[i];
            
            // Calculate monthly payment (principal + interest)
            const monthlyPayment = Math.round(loan.total / loan.duration);
            const interestPayment = Math.round(loan.amount * (loan.interestRate / 100) / loan.duration);
            const principalPayment = monthlyPayment - interestPayment;
            
            console.log(`Loan ${loan.id}: payment=${monthlyPayment}, interest=${interestPayment}, principal=${principalPayment}`);
            
            // Check if we have enough funds
            const currentBudget = await budgetManager.getCurrentBudget();
            if (currentBudget.funds >= monthlyPayment) {
                // Pay interest first
                await budgetManager.addLoanInterest(interestPayment, `Intérêts prêt ${loan.type} (${loan.id})`);
                console.log(`✅ Paid ${interestPayment}€ in interest for loan ${loan.id}`);
                
                // Pay principal
                await budgetManager.repayLoan(principalPayment, `Remboursement prêt ${loan.type} (${loan.id})`, loan.id);
                console.log(`✅ Paid ${principalPayment}€ in principal for loan ${loan.id}`);
                
                // Remove loan if fully paid
                if (loan.remainingTurns <= 0 || loan.amount <= 0) {
                    loansToRemove.push(i);
                    console.log(`Loan ${loan.id} fully repaid and removed`);
                }
            } else {
                // Not enough funds - just pay interest if possible
                if (currentBudget.funds >= interestPayment) {
                    await budgetManager.addLoanInterest(interestPayment, `Intérêts prêt ${loan.type} (${loan.id})`);
                    loan.remainingTurns--; // Still count as a turn
                    console.log(`⚠️ Only paid ${interestPayment}€ in interest (not enough funds for full payment)`);
                } else {
                    // Can't even pay interest - loan goes into default
                    console.warn(`Loan ${loan.id} in default - cannot pay interest`);
                    loan.remainingTurns--;
                }
            }
        }
        
        // Update displays
        updateBudgetDisplay();
        
        // Log final totals
        const finalBudget = await budgetManager.getCurrentBudget();
        console.log(`📊 Budget totals after loan payments:`, {
            totalLoanInterestExpenses: finalBudget.totalLoanInterestExpenses,
            totalLoanRepayments: finalBudget.totalLoanRepayments
        });
        
    } catch (error) {
        console.error('Error processing loan payments:', error);
    }
}

// Initialize loan payment system
function initLoanPaymentSystem() {
    // Expose processLoanPayments globally for scene.js
    // Register utility functions with AppRegistry
    appRegister('processLoanPayments', processLoanPayments);
    window.processLoanPayments = processLoanPayments; // Keep direct access for backwards compatibility
    
    // Process loan payments every turn
    if (window.game && window.game.onTurnEnd) {
        const originalOnTurnEnd = window.game.onTurnEnd;
        window.game.onTurnEnd = function() {
            originalOnTurnEnd.call(this);
            processLoanPayments();
        };
    }
}

// Make loadBudgetStates globally accessible
window.loadBudgetStates = (period = '3', showLoading = true) => loadBudgetStates(period, showLoading);

// Make generateCityMap globally accessible
window.generateCityMap = generateCityMap;

// Global refresh function for budget states modal
async function refreshBudgetStatesModal() {
    
    // Get current active filter button
    const activeFilterBtn = document.querySelector('.budget-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : '3';
    
    // Reload budget states with current period
    await loadBudgetStates(currentPeriod, true);
    
    // Update filter button labels
    await updateFilterButtonLabels();
    
}

// Make refresh function globally accessible
window.refreshBudgetStatesModal = refreshBudgetStatesModal;

// Journal Popup Functions
function initJournalPopup() {
    const journalBtn = document.getElementById('journal-btn');
    const journalPanel = document.getElementById('journal-panel');
    const journalCloseBtn = document.querySelector('.journal-close-btn');
    const journalRefreshBtn = document.getElementById('journal-refresh-btn');
    const filterButtons = document.querySelectorAll('.journal-filter-btn');
    
    if (!journalBtn || !journalPanel || !journalCloseBtn || !journalRefreshBtn) {
        console.warn('Journal popup elements not found');
        return;
    }
    
    // Toggle journal popup on journal button click
    journalBtn.addEventListener('click', () => {
        journalPanel.classList.add('active');
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('journal-panel');
        }
        loadJournalEntries('all');
    });
    
    // Close journal popup
    journalCloseBtn.addEventListener('click', () => {
        journalPanel.classList.remove('active');
        if (window.popupManager) {
            window.popupManager.forceClosePopup('journal-panel');
        }
    });
    
    // Close popup when clicking outside
    journalPanel.addEventListener('click', (e) => {
        if (e.target === journalPanel) {
            journalPanel.classList.remove('active');
            if (window.popupManager) {
                window.popupManager.forceClosePopup('journal-panel');
            }
        }
    });
    
    // Refresh button
    journalRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod);
    });
    
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadJournalEntries(btn.dataset.period);
        });
    });
    
    // Export buttons
    const exportJsonBtn = document.getElementById('journal-export-json-btn');
    const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
    
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', async () => {
            await exportJournalToJSON();
        });
    }
    
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            await exportJournalToPDF();
        });
    }
}

async function loadJournalEntries(period = 'all') {
    const journalList = document.getElementById('journal-list');
    if (!journalList) return;
    
    journalList.innerHTML = `
        <div class="journal-loading">
            <div class="loading-spinner"></div>
            <p>Chargement du journal...</p>
        </div>
    `;
    
    try {
        // Try to use journalManager directly if available, otherwise fall back to budgetManager
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('Journal/BudgetManager not available');
        }
        
        // Récupérer les données groupées par année et mois
        const yearlyData = await manager.getYearlyFinancialSummary();
        
        // Obtenir le budget actuel (source unique de vérité : budget.funds)
        let currentFunds = 0;
        let currentYear = 0;
        let currentTurn = 0;
        
        if (window.budgetManager) {
            const budget = await window.budgetManager.getCurrentBudget();
            currentFunds = budget.funds || 0;
            currentTurn = budget.turn || 0;
            if (window.TimeManager) {
                const timeInfo = window.TimeManager.getTimeInfo(currentTurn);
                currentYear = timeInfo.year;
            }
        } else {
            // Fallback: utiliser le turn le plus récent du journal
            const allEntries = await manager.getJournalEntries();
            if (allEntries.length > 0) {
                // Trier par turn décroissant pour obtenir le plus récent
                const sortedEntries = [...allEntries].sort((a, b) => b.turn - a.turn);
                currentTurn = sortedEntries[0].turn;
            }
        }
        const currentDate = new Date().toISOString();
        
        // Sauvegarder les soldes de fin d'année dans localStorage
        // Utiliser les entrées 'balance' qui reflètent budget.funds
        const LOCALSTORAGE_KEY = 'journal_year_end_balances';
        let soldes = []; // Déclarer en dehors du try pour être accessible plus tard
        
        try {
            const stored = localStorage.getItem(LOCALSTORAGE_KEY);
            soldes = stored ? JSON.parse(stored) : [];
            
            // NETTOYER : supprimer les entrées avec amount NaN ou undefined
            soldes = soldes.filter(s => typeof s.amount === 'number' && !isNaN(s.amount));
            
            // Pour chaque année affichée, récupérer le solde depuis les entrées balance
            for (const yearData of yearlyData) {
                try {
                    let nature;
                    let amount;
                    
                    // Pour l'année en cours, utiliser currentFunds (budget.funds actuel)
                    if (yearData.year === currentYear) {
                        nature = currentFunds >= 0 ? 'revenue' : 'deficit';
                        amount = Math.abs(currentFunds);
                    } else {
                        // Pour les années précédentes, utiliser localStorage (méthode synchrone)
                        // Retourne {an, nature, amount, turn, date} ou null
                        const yearEndBalance = manager.getYearEndBalance(yearData.year);
                        
                        if (yearEndBalance && typeof yearEndBalance.amount === 'number' && !isNaN(yearEndBalance.amount)) {
                            nature = yearEndBalance.nature;
                            amount = yearEndBalance.amount;
                        } else {
                            // Pas de solde valide trouvé, utiliser netFlow calculé comme fallback
                            const netFlow = yearData.netFlow;
                            if (typeof netFlow === 'number' && !isNaN(netFlow)) {
                                nature = netFlow >= 0 ? 'revenue' : 'deficit';
                                amount = Math.abs(netFlow);
                                console.warn(`[Journal] No valid balance in localStorage for year ${yearData.year}, using netFlow: ${netFlow}`);
                            } else {
                                console.warn(`[Journal] No valid balance for year ${yearData.year}, skipping`);
                                continue;
                            }
                        }
                    }
                    
                    // Validation finale : ne pas sauvegarder si amount est NaN
                    if (typeof amount !== 'number' || isNaN(amount)) {
                        console.error(`[Journal] Invalid amount for year ${yearData.year}: ${amount}`);
                        continue;
                    }
                    
                    // Vérifier si cette combinaison (an + turn) existe déjà
                    const existingIndex = soldes.findIndex(s => s.an === yearData.year && s.turn === currentTurn);
                    
                    if (existingIndex >= 0) {
                        // Mettre à jour l'entrée existante
                        soldes[existingIndex] = {
                            an: yearData.year,
                            nature: nature,
                            amount: amount,
                            turn: currentTurn,
                            date: currentDate
                        };
                    } else {
                        // Ajouter une nouvelle entrée
                        soldes.push({
                            an: yearData.year,
                            nature: nature,
                            amount: amount,
                            turn: currentTurn,
                            date: currentDate
                        });
                    }
                } catch (error) {
                    console.error(`[Journal] Error getting balance for year ${yearData.year}:`, error.message);
                    // Ne pas sauvegarder cette année si erreur
                }
            }
            
            // Trier par année puis par turn (décroissant)
            soldes.sort((a, b) => {
                if (a.an !== b.an) return b.an - a.an;
                return b.turn - a.turn;
            });
            
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(soldes));
            console.log('[Journal] Saved balances to localStorage:', soldes);
        } catch (error) {
            console.error('[Journal] Error saving balances to localStorage:', error);
        }
        
        if (yearlyData.length === 0) {
            journalList.innerHTML = `
                <div class="no-journal-entries">
                    <div class="no-journal-entries-icon">📔</div>
                    <div class="no-journal-entries-text">Aucune écriture dans le journal</div>
                </div>
            `;
            return;
        }
        
        // Créer le HTML avec regroupements Année → Mois → Entrées
        let html = '';
        
        yearlyData.forEach(yearData => {
            // En-tête Année
            const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
            
            // Pour le solde : utiliser budget.funds (source unique de vérité)
            let displayBalance;
            let balanceClass;
            
            if (yearData.year === currentYear) {
                // Année en cours : utiliser budget.funds actuel
                displayBalance = currentFunds;
                balanceClass = displayBalance >= 0 ? 'positive' : 'negative';
            } else {
                // Années précédentes : utiliser le solde sauvegardé depuis localStorage
                const savedBalance = soldes.find(s => s.an === yearData.year);
                if (savedBalance && typeof savedBalance.amount === 'number' && !isNaN(savedBalance.amount)) {
                    displayBalance = savedBalance.nature === 'revenue' ? savedBalance.amount : -savedBalance.amount;
                    balanceClass = savedBalance.nature === 'revenue' ? 'positive' : 'negative';
                } else {
                    // Fallback : utiliser netFlow calculé
                    const netFlow = yearData.netFlow;
                    if (typeof netFlow === 'number' && !isNaN(netFlow)) {
                        displayBalance = netFlow;
                        balanceClass = displayBalance >= 0 ? 'positive' : 'negative';
                    } else {
                        // Dernier recours : afficher 0 avec avertissement
                        displayBalance = 0;
                        balanceClass = 'error';
                        console.warn(`[Journal] No valid balance for year ${yearData.year}`);
                    }
                }
            }
            
            html += `
                <div class="journal-year-group">
                    <div class="journal-year-header">
                        <h3>Année ${yearDisplay}</h3>
                        <div class="journal-year-summary">
                            <div class="journal-summary-item income">
                                <span class="label">Revenus:</span>
                                <span class="amount">+${yearData.income.total}€</span>
                            </div>
                            <div class="journal-summary-item expenses">
                                <span class="label">Dépenses:</span>
                                <span class="amount">-${yearData.expenses.total}€</span>
                            </div>
                            <div class="journal-summary-item netflow ${balanceClass}">
                                <span class="label">Solde:</span>
                                <span class="amount">${displayBalance >= 0 ? '+' : ''}${displayBalance}€</span>
                            </div>
                        </div>
                    </div>
                    
                    ${yearData.months.map(monthData => {
                        // En-tête Mois
                        const yearDisplayMonth = monthData.year === 0 ? '0 JC' : `${monthData.year} ap JC`;
                        return `
                            <div class="journal-month-group">
                                <div class="journal-month-header">
                                    <h4>${monthData.monthName} ${yearDisplayMonth}</h4>
                                    <div class="journal-month-summary">
                                        <div class="journal-summary-item income">
                                            <span class="label">Revenus:</span>
                                            <span class="amount">+${monthData.income.total}€</span>
                                        </div>
                                        <div class="journal-summary-item expenses">
                                            <span class="label">Dépenses:</span>
                                            <span class="amount">-${monthData.expenses.total}€</span>
                                        </div>
                                        <div class="journal-summary-item netflow ${monthData.netFlow >= 0 ? 'positive' : 'negative'}">
                                            <span class="label">Solde:</span>
                                            <span class="amount">${monthData.netFlow >= 0 ? '+' : ''}${monthData.netFlow}€</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="journal-month-entries">
                                    ${(() => {
                                        // Séparer les entrées : report à nouveau en premier, puis les autres
                                        const carryForwardIncome = monthData.income.entries.filter(e => e.type === 'carry_forward');
                                        const carryForwardExpenses = monthData.expenses.entries.filter(e => e.type === 'carry_forward');
                                        const otherIncome = monthData.income.entries.filter(e => e.type !== 'carry_forward');
                                        const otherExpenses = monthData.expenses.entries.filter(e => e.type !== 'carry_forward');
                                        
                                        // Afficher d'abord les reports à nouveau (revenus puis dépenses), puis les autres
                                        return [
                                            ...carryForwardIncome.map(entry => createJournalEntryHTML(entry)),
                                            ...carryForwardExpenses.map(entry => createJournalEntryHTML(entry)),
                                            ...otherIncome.map(entry => createJournalEntryHTML(entry)),
                                            ...otherExpenses.map(entry => createJournalEntryHTML(entry))
                                        ].join('');
                                    })()}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        });
        
        journalList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading journal entries:', error);
        journalList.innerHTML = `
            <div class="journal-loading">
                <p>Erreur lors du chargement du journal: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Export journal to JSON and download
 */
async function exportJournalToJSON() {
    try {
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('JournalManager not available');
        }
        
        const jsonString = await manager.exportToJSON();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[Journal] Exported to JSON successfully');
    } catch (error) {
        console.error('[Journal] Error exporting to JSON:', error);
        alert('Erreur lors de l\'export JSON: ' + error.message);
    }
}

/**
 * Export journal to PDF and download
 */
async function exportJournalToPDF() {
    try {
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('JournalManager not available');
        }
        
        // Show loading indicator
        const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.disabled = true;
            exportPdfBtn.innerHTML = '<span>Génération...</span>';
        }
        
        const pdfBlob = await manager.exportToPDF();
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Restore button
        if (exportPdfBtn) {
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
        }
        
        console.log('[Journal] Exported to PDF successfully');
    } catch (error) {
        console.error('[Journal] Error exporting to PDF:', error);
        alert('Erreur lors de l\'export PDF: ' + error.message);
        
        // Restore button on error
        const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
        }
    }
}

function createJournalEntryHTML(entry) {
    const date = new Date(entry.date);
    const formattedDate = date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Obtenir l'année depuis le turn
    let yearDisplay = '';
    if (window.TimeManager && entry.turn !== undefined) {
        const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
        yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
    }
    
    // Déterminer si c'est un revenu (positif) ou une dépense (négatif)
    // Les cumuls et les balances sont informatifs seulement (pas comptés dans les calculs)
    let isIncome = false;
    
    if (entry.type === 'cumul_maintenance' || 
        entry.type === 'cumul_construction' || 
        entry.type === 'cumul_salary' ||
        entry.type === 'cumul_exceptional_expenses' ||
        entry.type === 'cumul_loan_interest' ||
        entry.type === 'cumul_loan_repayment') {
        isIncome = false; // Les cumuls sont toujours des dépenses
    } else if (entry.type === 'balance') {
        // La balance peut être positive ou négative selon le montant
        isIncome = entry.amount >= 0;
    } else if (entry.type === 'citizen_tax' || entry.type === 'capital_funds') {
        isIncome = true;
    } else if (entry.type === 'salary' || entry.type === 'maintenance' || entry.type === 'construction' || entry.type === 'exceptional_expenses') {
        isIncome = false; // Dépenses
    } else if (entry.type === 'carry_forward') {
        // Pour carry_forward, utiliser la propriété isCarryForwardIncome si disponible
        isIncome = entry.isCarryForwardIncome !== undefined ? entry.isCarryForwardIncome : true;
    }
    
    const typeClass = isIncome ? 'positive' : 'negative';
    
    const typeLabels = {
        'citizen_tax': 'Impôt Citoyen',
        'capital_funds': 'Capital de départ',
        'carry_forward': 'Report à nouveau',
        'construction': 'Construction',
        'exceptional_expenses': 'Réparation',
        'maintenance': 'Maintenance mensuelle',
        'salary': 'Salaires',
        'loan_interest': 'Intérêts prêt',
        'loan_repayment': 'Remboursement prêt',
        'cumul_maintenance': 'Cumul Maintenance',
        'cumul_construction': 'Cumul Construction',
        'cumul_salary': 'Cumul Salaires',
        'cumul_exceptional_expenses': 'Cumul Réparations',
        'cumul_loan_interest': 'Cumul Intérêts Prêt',
        'cumul_loan_repayment': 'Cumul Remboursement Prêt',
        'balance': 'Solde'
    };
    
    // Check if description contains breakdown data
    const breakdownMatch = entry.description?.match(/\|BREAKDOWN\|(.*?)\|BREAKDOWN\|/);
    let descriptionText = entry.description || '';
    let breakdownItems = null;
    
    if (breakdownMatch && entry.type === 'maintenance') {
        try {
            breakdownItems = JSON.parse(breakdownMatch[1]);
            // Remove breakdown data from description text
            descriptionText = entry.description.replace(/\|BREAKDOWN\|.*?\|BREAKDOWN\|/, '').trim();
        } catch (e) {
            console.warn('Failed to parse maintenance breakdown:', e);
        }
    }
    
    return `
        <div class="journal-entry">
            <div class="journal-entry-header">
                <span class="journal-entry-type ${entry.type}">${typeLabels[entry.type] || entry.type}</span>
                <span class="journal-entry-amount ${typeClass}">
                    ${typeClass === 'positive' ? '+' : '-'}${Math.abs(entry.amount)}€
                </span>
            </div>
            <div class="journal-entry-details">
                <div class="journal-entry-description">${descriptionText}</div>
                ${breakdownItems ? `
                <ul class="journal-maintenance-breakdown">
                    ${breakdownItems.map(item => `
                        <li class="journal-breakdown-item">
                            <span class="breakdown-label">${item.label}:</span>
                            <span class="breakdown-count">${item.count}</span>
                            <span class="breakdown-multiply">×</span>
                            <span class="breakdown-unit-cost">${item.unitCost}€</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-total">${item.total}€</span>
                        </li>
                    `).join('')}
                </ul>
                ` : ''}
                <div class="journal-entry-meta">
                    ${yearDisplay ? `<span class="journal-entry-year">Année: ${yearDisplay}</span>` : ''}
                    ${entry.turn !== undefined ? `<span class="journal-entry-turn-number">Tour: ${entry.turn}</span>` : ''}
                    <span class="journal-entry-date">${formattedDate}</span>
                </div>
            </div>
        </div>
    `;
}

// Initialize journal popup in window.onload

// Food Traceability Popup Functions
function initFoodTraceabilityPopup() {
    const foodTraceabilityBtn = document.getElementById('food-traceability-btn');
    const foodTraceabilityPanel = document.getElementById('food-traceability-panel');
    const foodTraceabilityCloseBtn = document.querySelector('.food-traceability-close-btn');
    const foodTraceabilityRefreshBtn = document.getElementById('food-traceability-refresh-btn');
    const filterButtons = document.querySelectorAll('.food-traceability-filter-btn');
    
    if (!foodTraceabilityBtn || !foodTraceabilityPanel || !foodTraceabilityCloseBtn || !foodTraceabilityRefreshBtn) {
        console.warn('Food traceability popup elements not found');
        return;
    }
    
    // Toggle food traceability popup on button click
    foodTraceabilityBtn.addEventListener('click', () => {
        foodTraceabilityPanel.classList.add('active');
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('food-traceability-panel');
        }
        // Ensure tabs are initialized when opening
        initializeFoodTraceabilityTabs();
        loadFoodTraceabilityEntries('all');
    });
    
    // Close food traceability popup
    foodTraceabilityCloseBtn.addEventListener('click', () => {
        foodTraceabilityPanel.classList.remove('active');
        if (window.popupManager) {
            window.popupManager.forceClosePopup('food-traceability-panel');
        }
    });
    
    // Close popup when clicking outside
    foodTraceabilityPanel.addEventListener('click', (e) => {
        if (e.target === foodTraceabilityPanel) {
            foodTraceabilityPanel.classList.remove('active');
            if (window.popupManager) {
                window.popupManager.forceClosePopup('food-traceability-panel');
            }
        }
    });
    
    // Refresh button
    foodTraceabilityRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.food-traceability-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadFoodTraceabilityEntries(currentPeriod);
    });
    
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadFoodTraceabilityEntries(btn.dataset.period);
        });
    });
    
    // Initialize tabs (can be called multiple times safely)
    initializeFoodTraceabilityTabs();
}

// Initialize food traceability tabs (separate function so it can be called when modal opens)
let tabsInitialized = false;
function initializeFoodTraceabilityTabs() {
    if (tabsInitialized) return; // Avoid duplicate listeners
    
    const tabs = document.querySelectorAll('.food-traceability-tab');
    const tabContents = document.querySelectorAll('.food-traceability-tab-content');
    
    if (tabs.length === 0 || tabContents.length === 0) {
        console.warn('Food traceability tabs not found', { tabs: tabs.length, tabContents: tabContents.length });
        return;
    }
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = tab.dataset.tab;
            
            if (!targetTab) {
                console.warn('Tab button missing data-tab attribute');
                return;
            }
            
            // Update tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update tab contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                const expectedId = `food-traceability-${targetTab}-tab`;
                if (content.id === expectedId) {
                    content.classList.add('active');
                }
            });
            
            // Load charts if charts tab is selected
            if (targetTab === 'charts') {
                loadFoodCharts();
            }
        });
    });
    
    // Charts refresh button
    const chartsRefreshBtn = document.getElementById('food-charts-refresh-btn');
    if (chartsRefreshBtn) {
        chartsRefreshBtn.addEventListener('click', () => {
            loadFoodCharts();
        });
    }
    
    // Year selector
    const yearSelect = document.getElementById('food-charts-year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            loadFoodCharts();
        });
    }
    
    tabsInitialized = true;
}

async function loadFoodTraceabilityEntries(period = 'all') {
    const foodTraceabilityList = document.getElementById('food-traceability-list');
    if (!foodTraceabilityList) return;
    
    foodTraceabilityList.innerHTML = `
        <div class="food-traceability-loading">
            <div class="loading-spinner"></div>
            <p>Chargement de la traçabilité...</p>
        </div>
    `;
    
    try {
        if (!window.foodTraceabilityService) {
            throw new Error('FoodTraceabilityService not available');
        }
        
        let transactions = await window.foodTraceabilityService.getAllTransactions();
        
        // Filter by period
        if (period !== 'all') {
            const now = new Date();
            const periodMs = parseInt(period) * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(now.getTime() - periodMs);
            
            transactions = transactions.filter(transaction => new Date(transaction.date) >= cutoffDate);
        }
        
        if (transactions.length === 0) {
            foodTraceabilityList.innerHTML = `
                <div class="no-food-traceability-entries">
                    <div class="no-food-traceability-entries-icon">🌾</div>
                    <div class="no-food-traceability-entries-text">Aucune transaction alimentaire enregistrée</div>
                </div>
            `;
            return;
        }
        
        // Group transactions by month and year
        const transactionsByMonthAndYear = {};
        transactions.forEach(transaction => {
            const month = transaction.month !== undefined ? transaction.month : 0;
            const year = transaction.year !== undefined ? transaction.year : 0;
            const key = `${year}-${month}`;
            
            if (!transactionsByMonthAndYear[key]) {
                transactionsByMonthAndYear[key] = {
                    month: month,
                    year: year,
                    transactions: []
                };
            }
            transactionsByMonthAndYear[key].transactions.push(transaction);
        });
        
        // Sort by year (descending) then by month (ascending)
        const sortedKeys = Object.keys(transactionsByMonthAndYear).sort((a, b) => {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);
            if (yearA !== yearB) {
                return yearB - yearA;
            }
            return monthA - monthB;
        });
        
        // Get current stocks from IndexedDB for all buildings
        let currentStocks = {};
        let allBuildingsData = [];
        try {
            allBuildingsData = await housesStore.listAllHouses();
            allBuildingsData.forEach(building => {
                const buildingKey = building.id || building.name;
                if (buildingKey && building.stocks) {
                    currentStocks[buildingKey] = building.stocks;
                }
            });
        } catch (err) {
            console.warn('Could not fetch current stocks from IndexedDB:', err);
        }
        
        // Calculate stocks for each month by going backwards from current stocks
        // We'll process months in reverse chronological order (newest to oldest)
        const stocksByMonth = {}; // { buildingKey: { monthKey: stocks } }
        const allBuildingKeys = new Set();
        
        // Collect all building keys from transactions
        transactions.forEach(t => {
            if (t.fromId || t.fromCoords) allBuildingKeys.add(t.fromId || t.fromCoords);
            if (t.toId || t.toCoords) allBuildingKeys.add(t.toId || t.toCoords);
        });
        // Also add buildings from IndexedDB
        allBuildingsData.forEach(building => {
            const buildingKey = building.id || building.name;
            if (buildingKey) allBuildingKeys.add(buildingKey);
        });
        
        // Initialize stocks for each building
        allBuildingKeys.forEach(buildingKey => {
            stocksByMonth[buildingKey] = {};
            // Start with current stocks (after all transactions)
            const currentMonthKey = 'current';
            stocksByMonth[buildingKey][currentMonthKey] = { ...(currentStocks[buildingKey] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 }) };
        });
        
        // Process months in reverse chronological order (newest to oldest)
        // This way we can calculate stocks before each month by reversing transactions
        const reversedKeys = [...sortedKeys].reverse();
        
        reversedKeys.forEach((key, index) => {
            const { month, year, transactions: monthTransactions } = transactionsByMonthAndYear[key];
            
            // For each building, calculate stocks before this month
            allBuildingKeys.forEach(buildingKey => {
                // Get stocks after this month (which is stocks before next month in reverse order)
                const previousMonthKey = index === 0 ? 'current' : reversedKeys[index - 1];
                const stocksAfter = stocksByMonth[buildingKey][previousMonthKey] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                // Calculate stocks before this month by reversing transactions
                const stocksBefore = { ...stocksAfter };
                
                // Helper to check if transaction matches building
                const matchesBuilding = (t, isFrom) => {
                    const id = isFrom ? t.fromId : t.toId;
                    const coords = isFrom ? t.fromCoords : t.toCoords;
                    return id === buildingKey || coords === buildingKey;
                };
                
                // Reverse farm-to-market transactions (farm sold)
                monthTransactions.filter(t => 
                    t.transactionType === 'farm_to_market' && matchesBuilding(t, true)
                ).forEach(t => {
                    // Farm sold, so before = after + sold
                    if (t.foodType === 'wheat') stocksBefore.wheat = (stocksBefore.wheat || 0) + t.quantity;
                    else if (t.foodType === 'carrot') stocksBefore.carrot = (stocksBefore.carrot || 0) + t.quantity;
                    else if (t.foodType === 'cabbage') stocksBefore.cabbage = (stocksBefore.cabbage || 0) + t.quantity;
                });
                
                // Reverse market purchases from farms (market bought)
                monthTransactions.filter(t => 
                    t.transactionType === 'farm_to_market' && matchesBuilding(t, false)
                ).forEach(t => {
                    // Market bought, so before = after - bought + sold (need to account for sales)
                    const salesThisMonth = monthTransactions.filter(st => 
                        st.transactionType === 'market_to_house' && 
                        matchesBuilding(st, true) &&
                        st.foodType === t.foodType
                    ).reduce((sum, st) => sum + st.quantity, 0);
                    
                    if (t.foodType === 'wheat') stocksBefore.wheat = Math.max(0, (stocksBefore.wheat || 0) - t.quantity + salesThisMonth);
                    else if (t.foodType === 'carrot') stocksBefore.carrot = Math.max(0, (stocksBefore.carrot || 0) - t.quantity + salesThisMonth);
                    else if (t.foodType === 'cabbage') stocksBefore.cabbage = Math.max(0, (stocksBefore.cabbage || 0) - t.quantity + salesThisMonth);
                });
                
                // Reverse market-to-house transactions (market sold)
                monthTransactions.filter(t => 
                    t.transactionType === 'market_to_house' && matchesBuilding(t, true)
                ).forEach(t => {
                    // Market sold, so before = after + sold
                    if (t.foodType === 'wheat') stocksBefore.wheat = (stocksBefore.wheat || 0) + t.quantity;
                    else if (t.foodType === 'carrot') stocksBefore.carrot = (stocksBefore.carrot || 0) + t.quantity;
                    else if (t.foodType === 'cabbage') stocksBefore.cabbage = (stocksBefore.cabbage || 0) + t.quantity;
                });
                
                // Reverse house purchases (house bought)
                monthTransactions.filter(t => 
                    t.transactionType === 'market_to_house' && matchesBuilding(t, false)
                ).forEach(t => {
                    // House bought, so before = after - bought + consumed
                    const consumptionThisMonth = monthTransactions.filter(ct => 
                        ct.transactionType === 'house_consumption' && 
                        matchesBuilding(ct, true) &&
                        ct.foodType === t.foodType
                    ).reduce((sum, ct) => sum + ct.quantity, 0);
                    
                    if (t.foodType === 'wheat') stocksBefore.wheat = Math.max(0, (stocksBefore.wheat || 0) - t.quantity + consumptionThisMonth);
                    else if (t.foodType === 'carrot') stocksBefore.carrot = Math.max(0, (stocksBefore.carrot || 0) - t.quantity + consumptionThisMonth);
                    else if (t.foodType === 'cabbage') stocksBefore.cabbage = Math.max(0, (stocksBefore.cabbage || 0) - t.quantity + consumptionThisMonth);
                });
                
                // Reverse house consumption
                monthTransactions.filter(t => 
                    t.transactionType === 'house_consumption' && matchesBuilding(t, true)
                ).forEach(t => {
                    // House consumed, so before = after + consumed
                    if (t.foodType === 'wheat') stocksBefore.wheat = (stocksBefore.wheat || 0) + t.quantity;
                    else if (t.foodType === 'carrot') stocksBefore.carrot = (stocksBefore.carrot || 0) + t.quantity;
                    else if (t.foodType === 'cabbage') stocksBefore.cabbage = (stocksBefore.cabbage || 0) + t.quantity;
                });
                
                stocksBefore.food = (stocksBefore.wheat || 0) + (stocksBefore.carrot || 0) + (stocksBefore.cabbage || 0);
                stocksByMonth[buildingKey][key] = stocksBefore;
            });
        });
        
        // Create HTML grouped by month
        const html = sortedKeys.map(key => {
            const { month, year, transactions } = transactionsByMonthAndYear[key];
            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            const monthName = monthNames[month] || `Mois ${month + 1}`;
            
            // Format year: 0 = "0 JC", 1+ = "X ap JC"
            const yearDisplay = year === 0 ? '0 JC' : `${year} ap JC`;
            
            // Group transactions by pair (Ferme-Marché or Marché-Maison)
            // For each pair, we'll show: stocks avant, transaction, stocks après
            
            // 1. Group Farm-Market transactions
            const farmMarketPairs = {};
            transactions.filter(t => t.transactionType === 'farm_to_market').forEach(transaction => {
                const farmKey = transaction.fromId || transaction.fromCoords;
                const marketKey = transaction.toId || transaction.toCoords;
                const pairKey = `${farmKey}-${marketKey}`;
                
                if (!farmMarketPairs[pairKey]) {
                    farmMarketPairs[pairKey] = {
                        farmKey,
                        farmCoords: transaction.fromCoords,
                        marketKey,
                        marketCoords: transaction.toCoords,
                        transactions: [],
                        byFoodType: {}
                    };
                }
                farmMarketPairs[pairKey].transactions.push(transaction);
                
                // Group by food type
                const foodType = transaction.foodType;
                if (!farmMarketPairs[pairKey].byFoodType[foodType]) {
                    farmMarketPairs[pairKey].byFoodType[foodType] = 0;
                }
                farmMarketPairs[pairKey].byFoodType[foodType] += transaction.quantity;
            });
            
            // 2. Group Market-House transactions
            const marketHousePairs = {};
            transactions.filter(t => t.transactionType === 'market_to_house').forEach(transaction => {
                const marketKey = transaction.fromId || transaction.fromCoords;
                const houseKey = transaction.toId || transaction.toCoords;
                const pairKey = `${marketKey}-${houseKey}`;
                
                if (!marketHousePairs[pairKey]) {
                    marketHousePairs[pairKey] = {
                        marketKey,
                        marketCoords: transaction.fromCoords,
                        houseKey,
                        houseCoords: transaction.toCoords,
                        transactions: [],
                        byFoodType: {}
                    };
                }
                marketHousePairs[pairKey].transactions.push(transaction);
                
                // Group by food type
                const foodType = transaction.foodType;
                if (!marketHousePairs[pairKey].byFoodType[foodType]) {
                    marketHousePairs[pairKey].byFoodType[foodType] = 0;
                }
                marketHousePairs[pairKey].byFoodType[foodType] += transaction.quantity;
            });
            
            // 3. Get stocks before transactions (need to calculate from previous months)
            // For now, we'll use current stocks as approximation
            // TODO: Calculate stocks before by summing previous transactions
            
            // Build HTML sections
            const sections = [];
            
            // Farm-Market sections
            Object.values(farmMarketPairs).forEach(pair => {
                // Get stocks from calculated stocksByMonth
                const farmStocksBefore = stocksByMonth[pair.farmKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                const marketStocksBefore = stocksByMonth[pair.marketKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                // Calculate stocks AFTER this month's transactions
                const farmStocksAfter = { ...farmStocksBefore };
                const marketStocksAfter = { ...marketStocksBefore };
                
                // Apply transactions
                Object.entries(pair.byFoodType).forEach(([foodType, quantity]) => {
                    if (foodType === 'wheat') {
                        farmStocksAfter.wheat = Math.max(0, (farmStocksAfter.wheat || 0) - quantity);
                        marketStocksAfter.wheat = (marketStocksAfter.wheat || 0) + quantity;
                    } else if (foodType === 'carrot') {
                        farmStocksAfter.carrot = Math.max(0, (farmStocksAfter.carrot || 0) - quantity);
                        marketStocksAfter.carrot = (marketStocksAfter.carrot || 0) + quantity;
                    } else if (foodType === 'cabbage') {
                        farmStocksAfter.cabbage = Math.max(0, (farmStocksAfter.cabbage || 0) - quantity);
                        marketStocksAfter.cabbage = (marketStocksAfter.cabbage || 0) + quantity;
                    }
                });
                
                // Also account for market sales this month
                const marketSalesThisMonth = { wheat: 0, carrot: 0, cabbage: 0 };
                transactions.filter(t => 
                    t.transactionType === 'market_to_house' && 
                    (t.fromId === pair.marketKey || t.fromCoords === pair.marketCoords)
                ).forEach(t => {
                    if (t.foodType === 'wheat') marketSalesThisMonth.wheat += t.quantity;
                    else if (t.foodType === 'carrot') marketSalesThisMonth.carrot += t.quantity;
                    else if (t.foodType === 'cabbage') marketSalesThisMonth.cabbage += t.quantity;
                });
                
                marketStocksAfter.wheat = Math.max(0, (marketStocksAfter.wheat || 0) - marketSalesThisMonth.wheat);
                marketStocksAfter.carrot = Math.max(0, (marketStocksAfter.carrot || 0) - marketSalesThisMonth.carrot);
                marketStocksAfter.cabbage = Math.max(0, (marketStocksAfter.cabbage || 0) - marketSalesThisMonth.cabbage);
                
                farmStocksAfter.food = (farmStocksAfter.wheat || 0) + (farmStocksAfter.carrot || 0) + (farmStocksAfter.cabbage || 0);
                marketStocksAfter.food = (marketStocksAfter.wheat || 0) + (marketStocksAfter.carrot || 0) + (marketStocksAfter.cabbage || 0);
                
                sections.push(createFarmMarketSectionHTML(pair, farmStocksBefore, marketStocksBefore, pair.byFoodType, farmStocksAfter, marketStocksAfter));
            });
            
            // Market-House sections
            Object.values(marketHousePairs).forEach(pair => {
                // Get stocks from calculated stocksByMonth
                const marketStocksBefore = stocksByMonth[pair.marketKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                const houseStocksBefore = stocksByMonth[pair.houseKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                
                // Calculate stocks AFTER this month's transactions
                const marketStocksAfter = { ...marketStocksBefore };
                const houseStocksAfter = { ...houseStocksBefore };
                
                // Apply transactions
                Object.entries(pair.byFoodType).forEach(([foodType, quantity]) => {
                    if (foodType === 'wheat') {
                        marketStocksAfter.wheat = Math.max(0, (marketStocksAfter.wheat || 0) - quantity);
                        houseStocksAfter.wheat = (houseStocksAfter.wheat || 0) + quantity;
                    } else if (foodType === 'carrot') {
                        marketStocksAfter.carrot = Math.max(0, (marketStocksAfter.carrot || 0) - quantity);
                        houseStocksAfter.carrot = (houseStocksAfter.carrot || 0) + quantity;
                    } else if (foodType === 'cabbage') {
                        marketStocksAfter.cabbage = Math.max(0, (marketStocksAfter.cabbage || 0) - quantity);
                        houseStocksAfter.cabbage = (houseStocksAfter.cabbage || 0) + quantity;
                    }
                });
                
                // Also account for house consumption this month
                const houseConsumptionThisMonth = { wheat: 0, carrot: 0, cabbage: 0 };
                transactions.filter(t => 
                    t.transactionType === 'house_consumption' && 
                    (t.fromId === pair.houseKey || t.fromCoords === pair.houseCoords)
                ).forEach(t => {
                    if (t.foodType === 'wheat') houseConsumptionThisMonth.wheat += t.quantity;
                    else if (t.foodType === 'carrot') houseConsumptionThisMonth.carrot += t.quantity;
                    else if (t.foodType === 'cabbage') houseConsumptionThisMonth.cabbage += t.quantity;
                });
                
                houseStocksAfter.wheat = Math.max(0, (houseStocksAfter.wheat || 0) - houseConsumptionThisMonth.wheat);
                houseStocksAfter.carrot = Math.max(0, (houseStocksAfter.carrot || 0) - houseConsumptionThisMonth.carrot);
                houseStocksAfter.cabbage = Math.max(0, (houseStocksAfter.cabbage || 0) - houseConsumptionThisMonth.cabbage);
                
                marketStocksAfter.food = (marketStocksAfter.wheat || 0) + (marketStocksAfter.carrot || 0) + (marketStocksAfter.cabbage || 0);
                houseStocksAfter.food = (houseStocksAfter.wheat || 0) + (houseStocksAfter.carrot || 0) + (houseStocksAfter.cabbage || 0);
                
                sections.push(createMarketHouseSectionHTML(pair, marketStocksBefore, houseStocksBefore, pair.byFoodType, marketStocksAfter, houseStocksAfter));
            });
            
            // Also show farms with stocks but no sales (production not yet sold)
            // Show stocks for farms, markets, and houses for this month
            const stocksSections = [];
            
            // Show stocks for all farms this month
            allBuildingsData.forEach(building => {
                if (building.type && (building.type.includes('Farm') || building.type.includes('Farms'))) {
                    const farmKey = building.id || building.name;
                    const farmStocks = stocksByMonth[farmKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    const farmStocksAfter = stocksByMonth[farmKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    
                    // Apply transactions to get stocks after
                    transactions.filter(t => 
                        t.transactionType === 'farm_to_market' && 
                        (t.fromId === farmKey || t.fromCoords === building.x + ',' + building.y)
                    ).forEach(t => {
                        if (t.foodType === 'wheat') farmStocksAfter.wheat = Math.max(0, (farmStocksAfter.wheat || 0) - t.quantity);
                        else if (t.foodType === 'carrot') farmStocksAfter.carrot = Math.max(0, (farmStocksAfter.carrot || 0) - t.quantity);
                        else if (t.foodType === 'cabbage') farmStocksAfter.cabbage = Math.max(0, (farmStocksAfter.cabbage || 0) - t.quantity);
                    });
                    farmStocksAfter.food = (farmStocksAfter.wheat || 0) + (farmStocksAfter.carrot || 0) + (farmStocksAfter.cabbage || 0);
                    
                    if (farmStocksAfter.food > 0 || farmStocks.wheat > 0 || farmStocks.carrot > 0 || farmStocks.cabbage > 0) {
                        const hasTransactions = transactions.some(t => 
                            t.transactionType === 'farm_to_market' && 
                            (t.fromId === farmKey || t.fromCoords === building.x + ',' + building.y)
                        );
                        if (!hasTransactions) {
                            stocksSections.push(createBuildingStocksHTML('Ferme', `${building.x},${building.y}`, farmStocksAfter, 'farm'));
                        }
                    }
                }
            });
            
            // Show stocks for all markets this month
            allBuildingsData.forEach(building => {
                if (building.type && (building.type.includes('Market') || building.type.includes('Commerce'))) {
                    const marketKey = building.id || building.name;
                    const marketStocks = stocksByMonth[marketKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    const marketStocksAfter = { ...marketStocks };
                    
                    // Apply transactions
                    transactions.filter(t => 
                        t.transactionType === 'farm_to_market' && 
                        (t.toId === marketKey || t.toCoords === building.x + ',' + building.y)
                    ).forEach(t => {
                        if (t.foodType === 'wheat') marketStocksAfter.wheat = (marketStocksAfter.wheat || 0) + t.quantity;
                        else if (t.foodType === 'carrot') marketStocksAfter.carrot = (marketStocksAfter.carrot || 0) + t.quantity;
                        else if (t.foodType === 'cabbage') marketStocksAfter.cabbage = (marketStocksAfter.cabbage || 0) + t.quantity;
                    });
                    
                    transactions.filter(t => 
                        t.transactionType === 'market_to_house' && 
                        (t.fromId === marketKey || t.fromCoords === building.x + ',' + building.y)
                    ).forEach(t => {
                        if (t.foodType === 'wheat') marketStocksAfter.wheat = Math.max(0, (marketStocksAfter.wheat || 0) - t.quantity);
                        else if (t.foodType === 'carrot') marketStocksAfter.carrot = Math.max(0, (marketStocksAfter.carrot || 0) - t.quantity);
                        else if (t.foodType === 'cabbage') marketStocksAfter.cabbage = Math.max(0, (marketStocksAfter.cabbage || 0) - t.quantity);
                    });
                    
                    marketStocksAfter.food = (marketStocksAfter.wheat || 0) + (marketStocksAfter.carrot || 0) + (marketStocksAfter.cabbage || 0);
                    
                    if (marketStocksAfter.food > 0 || marketStocks.wheat > 0 || marketStocks.carrot > 0 || marketStocks.cabbage > 0) {
                        stocksSections.push(createBuildingStocksHTML('Marché', `${building.x},${building.y}`, marketStocksAfter, 'market'));
                    }
                }
            });
            
            // Show stocks for all houses this month
            allBuildingsData.forEach(building => {
                if (building.type && (building.type.includes('House') || building.type.includes('Maison'))) {
                    const houseKey = building.id || building.name;
                    const houseStocks = stocksByMonth[houseKey]?.[key] || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                    const houseStocksAfter = { ...houseStocks };
                    
                    // Apply transactions
                    transactions.filter(t => 
                        t.transactionType === 'market_to_house' && 
                        (t.toId === houseKey || t.toCoords === building.x + ',' + building.y)
                    ).forEach(t => {
                        if (t.foodType === 'wheat') houseStocksAfter.wheat = (houseStocksAfter.wheat || 0) + t.quantity;
                        else if (t.foodType === 'carrot') houseStocksAfter.carrot = (houseStocksAfter.carrot || 0) + t.quantity;
                        else if (t.foodType === 'cabbage') houseStocksAfter.cabbage = (houseStocksAfter.cabbage || 0) + t.quantity;
                    });
                    
                    transactions.filter(t => 
                        t.transactionType === 'house_consumption' && 
                        (t.fromId === houseKey || t.fromCoords === building.x + ',' + building.y)
                    ).forEach(t => {
                        if (t.foodType === 'wheat') houseStocksAfter.wheat = Math.max(0, (houseStocksAfter.wheat || 0) - t.quantity);
                        else if (t.foodType === 'carrot') houseStocksAfter.carrot = Math.max(0, (houseStocksAfter.carrot || 0) - t.quantity);
                        else if (t.foodType === 'cabbage') houseStocksAfter.cabbage = Math.max(0, (houseStocksAfter.cabbage || 0) - t.quantity);
                    });
                    
                    houseStocksAfter.food = (houseStocksAfter.wheat || 0) + (houseStocksAfter.carrot || 0) + (houseStocksAfter.cabbage || 0);
                    
                    if (houseStocksAfter.food > 0 || houseStocks.wheat > 0 || houseStocks.carrot > 0 || houseStocks.cabbage > 0) {
                        stocksSections.push(createBuildingStocksHTML('Maison', `${building.x},${building.y}`, houseStocksAfter, 'house'));
                    }
                }
            });
            
            const unsoldFarmsHTML = stocksSections.join('');
            
            return `
                <div class="food-traceability-month-group">
                    <h4 class="food-traceability-month-header">${monthName} ${yearDisplay}</h4>
                    <div class="food-traceability-month-content">
                        ${sections.join('')}
                        ${unsoldFarmsHTML}
                    </div>
                </div>
            `;
        }).join('');
        
        foodTraceabilityList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading food traceability entries:', error);
        foodTraceabilityList.innerHTML = `
            <div class="food-traceability-loading">
                <p>Erreur lors du chargement de la traçabilité: ${error.message}</p>
            </div>
        `;
    }
}

// Helper function to create Farm-Market section HTML with columns
function createFarmMarketSectionHTML(pair, farmStocksBefore, marketStocksBefore, byFoodType, farmStocksAfter, marketStocksAfter) {
    const foodTypeLabels = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou' };
    const transactionDetails = Object.entries(byFoodType).map(([foodType, quantity]) => {
        const label = foodTypeLabels[foodType] || foodType;
        return `<div>${label}: ${quantity} panier(s)</div>`;
    }).join('');
    
    return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">Ferme</span>
                <span class="food-traceability-coords-pill farm">${pair.farmCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">Marché</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Ferme</div>
                                <div class="food-traceability-stocks-details">
                                    ${farmStocksBefore.wheat > 0 ? `<div>Blé: ${farmStocksBefore.wheat}</div>` : ''}
                                    ${farmStocksBefore.carrot > 0 ? `<div>Carotte: ${farmStocksBefore.carrot}</div>` : ''}
                                    ${farmStocksBefore.cabbage > 0 ? `<div>Chou: ${farmStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksBefore.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
                                <div class="food-traceability-stocks-details">
                                    ${marketStocksBefore.wheat > 0 ? `<div>Blé: ${marketStocksBefore.wheat}</div>` : ''}
                                    ${marketStocksBefore.carrot > 0 ? `<div>Carotte: ${marketStocksBefore.carrot}</div>` : ''}
                                    ${marketStocksBefore.cabbage > 0 ? `<div>Chou: ${marketStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type farm-to-market">Vente</div>
                            <div class="food-traceability-transaction-subtitle">Vente au marché</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type farm-to-market">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat à la ferme</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Ferme</div>
                                <div class="food-traceability-stocks-details">
                                    ${farmStocksAfter.wheat > 0 ? `<div>Blé: ${farmStocksAfter.wheat}</div>` : ''}
                                    ${farmStocksAfter.carrot > 0 ? `<div>Carotte: ${farmStocksAfter.carrot}</div>` : ''}
                                    ${farmStocksAfter.cabbage > 0 ? `<div>Chou: ${farmStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksAfter.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
                                <div class="food-traceability-stocks-details">
                                    ${marketStocksAfter.wheat > 0 ? `<div>Blé: ${marketStocksAfter.wheat}</div>` : ''}
                                    ${marketStocksAfter.carrot > 0 ? `<div>Carotte: ${marketStocksAfter.carrot}</div>` : ''}
                                    ${marketStocksAfter.cabbage > 0 ? `<div>Chou: ${marketStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper function to create Market-House section HTML with columns
function createMarketHouseSectionHTML(pair, marketStocksBefore, houseStocksBefore, byFoodType, marketStocksAfter, houseStocksAfter) {
    const foodTypeLabels = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou' };
    const transactionDetails = Object.entries(byFoodType).map(([foodType, quantity]) => {
        const label = foodTypeLabels[foodType] || foodType;
        return `<div>${label}: ${quantity} panier(s)</div>`;
    }).join('');
    
    return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">Marché</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">Maison</span>
                <span class="food-traceability-coords-pill house">${pair.houseCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
                                <div class="food-traceability-stocks-details">
                                    ${marketStocksBefore.wheat > 0 ? `<div>Blé: ${marketStocksBefore.wheat}</div>` : ''}
                                    ${marketStocksBefore.carrot > 0 ? `<div>Carotte: ${marketStocksBefore.carrot}</div>` : ''}
                                    ${marketStocksBefore.cabbage > 0 ? `<div>Chou: ${marketStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Maison</div>
                                <div class="food-traceability-stocks-details">
                                    ${houseStocksBefore.wheat > 0 ? `<div>Blé: ${houseStocksBefore.wheat}</div>` : ''}
                                    ${houseStocksBefore.carrot > 0 ? `<div>Carotte: ${houseStocksBefore.carrot}</div>` : ''}
                                    ${houseStocksBefore.cabbage > 0 ? `<div>Chou: ${houseStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksBefore.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type market-to-house">Vente</div>
                            <div class="food-traceability-transaction-subtitle">Vente à la maison</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type market-to-house">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat au marché</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
                                <div class="food-traceability-stocks-details">
                                    ${marketStocksAfter.wheat > 0 ? `<div>Blé: ${marketStocksAfter.wheat}</div>` : ''}
                                    ${marketStocksAfter.carrot > 0 ? `<div>Carotte: ${marketStocksAfter.carrot}</div>` : ''}
                                    ${marketStocksAfter.cabbage > 0 ? `<div>Chou: ${marketStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Maison</div>
                                <div class="food-traceability-stocks-details">
                                    ${houseStocksAfter.wheat > 0 ? `<div>Blé: ${houseStocksAfter.wheat}</div>` : ''}
                                    ${houseStocksAfter.carrot > 0 ? `<div>Carotte: ${houseStocksAfter.carrot}</div>` : ''}
                                    ${houseStocksAfter.cabbage > 0 ? `<div>Chou: ${houseStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksAfter.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper function to create building stocks HTML
function createBuildingStocksHTML(buildingType, coords, stocks, pillClass) {
    return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">${buildingType}</span>
                <span class="food-traceability-coords-pill ${pillClass}">${coords || 'N/A'}</span>
                <span class="food-traceability-transaction-subtitle">(Stocks en fin de mois)</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks en fin de mois</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${buildingType}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stocks.wheat > 0 ? `<div>Blé: ${stocks.wheat}</div>` : ''}
                                    ${stocks.carrot > 0 ? `<div>Carotte: ${stocks.carrot}</div>` : ''}
                                    ${stocks.cabbage > 0 ? `<div>Chou: ${stocks.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${stocks.food || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">-</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">-</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createFoodTraceabilityTransactionHTML(transaction, displayMode = 'default') {
    const foodTypeLabels = {
        'wheat': 'Blé',
        'carrot': 'Carotte',
        'cabbage': 'Chou',
        'food': 'Nourriture'
    };
    
    const foodTypeLabel = foodTypeLabels[transaction.foodType] || transaction.foodType;
    const foodTypeClass = transaction.foodType;
    
    let transactionHTML = '';
    
    if (transaction.transactionType === 'farm_to_market') {
        // Farm sells to market
        const subtitle = displayMode === 'market_purchase' 
            ? '<div class="food-traceability-transaction-subtitle">Achat à la ferme</div>'
            : '<div class="food-traceability-transaction-subtitle">Vente au marché</div>';
        
        const sourceLabel = displayMode === 'market_purchase' ? 'Origine' : 'Destination';
        const sourceValue = displayMode === 'market_purchase'
            ? `Ferme ${transaction.fromCoords || 'N/A'}`
            : `Marché ${transaction.toCoords || 'N/A'}`;
        
        transactionHTML = `
            <div class="food-traceability-transaction">
                <div class="food-traceability-transaction-header">
                    <span class="food-traceability-transaction-type farm-to-market">${displayMode === 'market_purchase' ? 'Achat' : 'Vente'}</span>
                    <span class="food-traceability-food-type ${foodTypeClass}">${foodTypeLabel}</span>
                </div>
                ${subtitle}
                <div class="food-traceability-transaction-details">
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">Quantité:</span>
                        <span class="food-traceability-transaction-detail-value food-traceability-quantity">${transaction.quantity} panier(s)</span>
                    </div>
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">Prix:</span>
                        <span class="food-traceability-transaction-detail-value food-traceability-price">${transaction.totalPrice}€</span>
                    </div>
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">${sourceLabel}:</span>
                        <span class="food-traceability-transaction-detail-value">${sourceValue}</span>
                    </div>
                </div>
            </div>
        `;
    } else if (transaction.transactionType === 'market_to_house') {
        // Market sells to house
        const subtitle = displayMode === 'house_purchase' 
            ? '<div class="food-traceability-transaction-subtitle">Achat au marché</div>'
            : '<div class="food-traceability-transaction-subtitle">Vente à la maison</div>';
        
        const label = displayMode === 'house_purchase' ? 'Achat' : 'Vente';
        const sourceLabel = displayMode === 'house_purchase' ? 'Origine' : 'Destination';
        const sourceValue = displayMode === 'house_purchase' 
            ? `Marché ${transaction.fromCoords || 'N/A'}` 
            : `Maison ${transaction.toCoords || 'N/A'}`;
        
        transactionHTML = `
            <div class="food-traceability-transaction">
                <div class="food-traceability-transaction-header">
                    <span class="food-traceability-transaction-type market-to-house">${label}</span>
                    <span class="food-traceability-food-type ${foodTypeClass}">${foodTypeLabel}</span>
                </div>
                ${subtitle}
                <div class="food-traceability-transaction-details">
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">Quantité:</span>
                        <span class="food-traceability-transaction-detail-value food-traceability-quantity">${transaction.quantity} panier(s)</span>
                    </div>
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">Prix:</span>
                        <span class="food-traceability-transaction-detail-value food-traceability-price">${transaction.totalPrice}€</span>
                    </div>
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">${sourceLabel}:</span>
                        <span class="food-traceability-transaction-detail-value">${sourceValue}</span>
                    </div>
                </div>
            </div>
        `;
    } else if (transaction.transactionType === 'house_consumption') {
        transactionHTML = `
            <div class="food-traceability-transaction">
                <div class="food-traceability-transaction-header">
                    <span class="food-traceability-transaction-type house-consumption">Consommation</span>
                    <span class="food-traceability-food-type ${foodTypeClass}">${foodTypeLabel}</span>
                </div>
                <div class="food-traceability-transaction-details">
                    <div class="food-traceability-transaction-detail">
                        <span class="food-traceability-transaction-detail-label">Quantité:</span>
                        <span class="food-traceability-transaction-detail-value food-traceability-quantity">${transaction.quantity} panier(s)</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    return transactionHTML;
}

// Load and render food charts
async function loadFoodCharts() {
    const container = document.getElementById('food-stats-container');
    const yearSelect = document.getElementById('food-charts-year-select');
    
    if (!container || !yearSelect) return;
    
    container.innerHTML = `
        <div class="food-stats-loading">
            <div class="loading-spinner"></div>
            <p>Chargement des statistiques...</p>
        </div>
    `;
    
    try {
        if (!window.foodTraceabilityService) {
            throw new Error('FoodTraceabilityService not available');
        }
        
        if (!housesStore) {
            throw new Error('HousesStore not available');
        }
        
        const transactions = await window.foodTraceabilityService.getAllTransactions();
        
        // Get current houses data from IndexedDB to calculate current population
        const allHouses = await housesStore.listAllHouses();
        
        // Group consumption transactions by year and month to get fed population
        const dataByYearMonth = {};
        const years = new Set();
        
        // First pass: collect all months with transactions
        transactions.forEach(transaction => {
            const year = transaction.year !== undefined ? transaction.year : 0;
            years.add(year);
        });
        
        // Second pass: calculate fed/unfed for each month
        years.forEach(year => {
            for (let month = 0; month < 12; month++) {
                const key = `${year}-${month}`;
                
                // Get all consumption transactions for this month
                const monthConsumptions = transactions.filter(t => 
                    t.transactionType === 'house_consumption' &&
                    t.year === year &&
                    t.month === month
                );
                
                if (monthConsumptions.length === 0) {
                    // Skip months with no consumption data
                    continue;
                }
                
                // Group consumptions by house (one house can have multiple food types consumed)
                // Each consumption transaction represents citizens fed (quantity = citizens who consumed that food type)
                // But we need to group by house to avoid double counting
                const housesFed = {}; // { houseKey: maxQuantity } - max because all food types should have same quantity
                
                monthConsumptions.forEach(consumption => {
                    // Quantity represents citizens fed for this food type (1 basket = 1 citizen per month)
                    const houseKey = consumption.fromId || consumption.fromCoords;
                    if (houseKey) {
                        if (!housesFed[houseKey]) {
                            housesFed[houseKey] = 0;
                        }
                        // Take the maximum quantity per house (should be same for all food types, but use max to be safe)
                        housesFed[houseKey] = Math.max(housesFed[houseKey], consumption.quantity || 0);
                    }
                });
                
                // Fed population = sum of all unique houses that consumed
                const fedPopulation = Object.values(housesFed).reduce((sum, citizens) => sum + citizens, 0);
                
                // Calculate unfed population
                // Use current house data: houses with population but no consumption = unfed
                let unfedPopulation = 0;
                
                allHouses.forEach(house => {
                    if (house.type && (house.type.includes('House') || house.type.includes('Maison'))) {
                        const houseKey = house.id || house.name;
                        const houseCoords = house.x !== undefined && house.y !== undefined ? `${house.x},${house.y}` : null;
                        const housePop = house.pop || 0;
                        
                        if (housePop > 0) {
                            // Check if this house consumed in this month
                            const houseFedCount = housesFed[houseKey] || housesFed[houseCoords] || 0;
                            
                            if (houseFedCount === 0) {
                                // House has population but didn't consume = unfed
                                unfedPopulation += housePop;
                            } else if (housePop > houseFedCount) {
                                // House consumed but has more population than fed = difference is unfed
                                unfedPopulation += (housePop - houseFedCount);
                            }
                        }
                    }
                });
                
                dataByYearMonth[key] = {
                    year,
                    month,
                    fedPopulation: fedPopulation,
                    unfedPopulation: unfedPopulation
                };
            }
        });
        
        // Update year selector
        yearSelect.innerHTML = '<option value="all">Toutes les années</option>';
        Array.from(years).sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year.toString();
            yearSelect.appendChild(option);
        });
        
        // Filter by selected year
        const selectedYear = yearSelect.value === 'all' ? null : parseInt(yearSelect.value);
        const filteredData = Object.values(dataByYearMonth)
            .filter(d => selectedYear === null || d.year === selectedYear)
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year; // Newest first
                return b.month - a.month; // Newest month first
            });
        
        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="no-food-stats">
                    <div class="no-food-stats-icon">📊</div>
                    <div class="no-food-stats-text">Aucune donnée disponible</div>
                </div>
            `;
            return;
        }
        
        // Group by year for display
        const dataByYear = {};
        filteredData.forEach(d => {
            if (!dataByYear[d.year]) {
                dataByYear[d.year] = {
                    year: d.year,
                    months: []
                };
            }
            dataByYear[d.year].months.push(d);
        });
        
        // Render statistics
        renderFoodStats(container, dataByYear, selectedYear);
        
    } catch (error) {
        console.error('Error loading food statistics:', error);
        container.innerHTML = `
            <div class="no-food-stats">
                <div class="no-food-stats-icon">❌</div>
                <div class="no-food-stats-text">Erreur lors du chargement: ${error.message}</div>
            </div>
        `;
    }
}

// Render food statistics with icons and colors - simplified to show fed/unfed population
function renderFoodStats(container, dataByYear, selectedYear) {
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    const years = Object.keys(dataByYear).sort((a, b) => parseInt(b) - parseInt(a));
    
    let html = '';
    
    if (selectedYear === null) {
        // Show summary for all years
        let totalFed = 0;
        let totalUnfed = 0;
        
        years.forEach(year => {
            const yearData = dataByYear[year];
            yearData.months.forEach(month => {
                totalFed += month.fedPopulation || 0;
                totalUnfed += month.unfedPopulation || 0;
            });
        });
        
        const totalPopulation = totalFed + totalUnfed;
        
        html += `
            <div class="food-stats-summary">
                <h4 class="food-stats-summary-title">📊 Vue Globale (Toutes années)</h4>
                <div class="food-stats-summary-grid">
                    <div class="food-stat-card fed">
                        <div class="food-stat-icon">✅</div>
                        <div class="food-stat-label">Population Nourrie</div>
                        <div class="food-stat-value">${totalFed}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                    <div class="food-stat-card unfed">
                        <div class="food-stat-icon">⚠️</div>
                        <div class="food-stat-label">Population Non Nourrie</div>
                        <div class="food-stat-value">${totalUnfed}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                    <div class="food-stat-card total">
                        <div class="food-stat-icon">👥</div>
                        <div class="food-stat-label">Population Totale</div>
                        <div class="food-stat-value">${totalPopulation}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Show details by year
    years.forEach(year => {
        const yearData = dataByYear[year];
        let yearFed = 0;
        let yearUnfed = 0;
        
        yearData.months.forEach(month => {
            yearFed += month.fedPopulation || 0;
            yearUnfed += month.unfedPopulation || 0;
        });
        
        html += `
            <div class="food-stats-year-section">
                <div class="food-stats-year-header">
                    <h4 class="food-stats-year-title">Année ${year}</h4>
                    <div class="food-stats-year-summary">
                        <span class="food-stat-badge fed">✅ ${yearFed}</span>
                        <span class="food-stat-badge unfed">⚠️ ${yearUnfed}</span>
                        <span class="food-stat-badge total">👥 ${yearFed + yearUnfed}</span>
                    </div>
                </div>
                <div class="food-stats-months">
                    ${yearData.months.map(monthData => {
                        const totalPop = (monthData.fedPopulation || 0) + (monthData.unfedPopulation || 0);
                        return `
                            <div class="food-stat-month-card">
                                <div class="food-stat-month-header">
                                    <span class="food-stat-month-name">${monthNames[monthData.month] || `Mois ${monthData.month + 1}`}</span>
                                </div>
                                <div class="food-stat-month-details">
                                    <div class="food-stat-month-item fed">
                                        <span class="food-stat-month-icon">✅</span>
                                        <span class="food-stat-month-label">Nourris:</span>
                                        <span class="food-stat-month-value">${monthData.fedPopulation || 0}</span>
                                    </div>
                                    <div class="food-stat-month-item unfed">
                                        <span class="food-stat-month-icon">⚠️</span>
                                        <span class="food-stat-month-label">Non nourris:</span>
                                        <span class="food-stat-month-value">${monthData.unfedPopulation || 0}</span>
                                    </div>
                                    <div class="food-stat-month-item total">
                                        <span class="food-stat-month-icon">👥</span>
                                        <span class="food-stat-month-label">Total:</span>
                                        <span class="food-stat-month-value">${totalPop}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Initialize food traceability popup in window.onload