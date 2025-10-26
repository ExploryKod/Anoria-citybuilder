import {
    bullDozeButton,
    displaySpeed,
    speedChangeIndicator,
    farmsButton,
    fasterButton,
    housesButton,
    infrastructureButton,
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
    publicButton,
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

function updateSpeedDisplay(changeDirection = '') {
    const speedMs = parseInt(localStorage.getItem('speed'), 10) || 3000;
    
    // Convert milliseconds to a more user-friendly unit
    // Show as "X.Yx" format for speeds (where 1x = 1000ms)
    const speedMultiplier = (1000 / speedMs).toFixed(2);
    
    displaySpeed.textContent = `Vitesse: ${speedMultiplier}x`;
    
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
    console.log('Budget elements are now static in HTML');
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
        
        // Debug: Log actual building prices
        console.log('Actual building prices from housesStore:', buildingPrices);
        console.log('Building analysis:', buildingAnalysis);
        console.log('Calculated prices:', { housePrices, farmPrices, marketPrice, roadPrice });
        console.log('All houses data:', houses.map(h => ({ type: h.type, name: h.name, price: h.price })));
        
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
        case 'others':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createOthersButtons(buttonData)
                
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
    console.log('[FARMS] Creating farm buttons with buttonData:', buttonData);
    console.log('[FARMS] toolIds.farms:', toolIds.farms);
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
    const svgWindmill = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cog"><circle cx="12" cy="12" r="3"/><path d="M12 5L7 7l2 5M12 5l5 2-2 5M7 17l2-5M17 17l-2-5M7 7L2 7l5 10M17 7l5 0-5 10"/></svg>`
    const svgBarn = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>`
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
            } else if (buttonInfo.tool === 'Windmill-001') {
                makeNewButton(buttonInfo, svgWindmill)
            } else if (buttonInfo.tool === 'Barn-001') {
                makeNewButton(buttonInfo, svgBarn)
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
    await assetManager.initializeBuildings('infrastructure')
    await assetManager.initializeBuildings('public')
    buttonData = assetManager.getButtonData();
    toolIds = assetManager.getToolIds();
    
    // Create budget elements dynamically if they don't exist
    if (!document.getElementById('budget-btn')) {
        //console.log('Creating budget button dynamically...');
        createBudgetElements();
        console.info('Balance sheets is a new feature, not implemented yet...');
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

    housesButton.addEventListener('click', toggleModal)

    farmsButton.addEventListener('click', toggleModal)

    marketButton.addEventListener('click', toggleModal)

    othersButton.addEventListener('click', toggleModal)
    
    infrastructureButton.addEventListener('click', toggleModal)
    
    publicButton.addEventListener('click', toggleModal)

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
            
            // Utiliser PopupManager pour gérer les événements
            if (window.popupManager) {
                console.log('PopupManager available, opening budget-panel');
                window.popupManager.forceOpenPopup('budget-panel');
            } else {
                console.warn('PopupManager not available, falling back to manual pause');
                // Fallback: pause manuel si PopupManager n'est pas disponible
                if (window.game) {
                    window.game.pause();
                    console.log('Game paused manually for budget panel');
                }
            }
            
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
                    
                    // Pause the game when opening budget panel
                    if (window.game) {
                        window.game.pause();
                        console.log('Game paused for budget panel (retry)');
                    }
                    
                    updateBudgetDisplay();
                });
                console.log('Budget button event listener added on retry');
            }
            
            if (retryBudgetPanelCloseBtnEl) {
                retryBudgetPanelCloseBtnEl.addEventListener('click', () => {
                    retryBudgetPanelEl.classList.remove('active');
                    
                    // Resume the game when closing budget panel
                    if (window.game) {
                        window.game.play();
                        console.log('Game resumed after closing budget panel (retry)');
                    }
                });
            }
            
            if (retryBudgetPanelEl) {
                retryBudgetPanelEl.addEventListener('click', (e) => {
                    if (e.target === retryBudgetPanelEl) {
                        retryBudgetPanelEl.classList.remove('active');
                        
                        // Resume the game when clicking outside budget panel
                        if (window.game) {
                            window.game.play();
                            console.log('Game resumed after clicking outside budget panel (retry)');
                        }
                    }
                });
            }
        }, 1000);
    }
    
    if (budgetPanelCloseBtnEl) {
        budgetPanelCloseBtnEl.addEventListener('click', () => {
            budgetPanelEl.classList.remove('active');
            
            // Utiliser PopupManager pour gérer les événements
            if (window.popupManager) {
                console.log('PopupManager available, closing budget-panel');
                window.popupManager.forceClosePopup('budget-panel');
            } else {
                console.warn('PopupManager not available, falling back to manual resume');
                // Fallback: resume manuel si PopupManager n'est pas disponible
                if (window.game) {
                    window.game.play();
                    console.log('Game resumed manually after closing budget panel');
                }
            }
        });
    }
    
    if (budgetPanelEl) {
        // Close budget panel when clicking outside
        budgetPanelEl.addEventListener('click', (e) => {
            if (e.target === budgetPanelEl) {
                budgetPanelEl.classList.remove('active');
                
                // Utiliser PopupManager pour gérer les événements
                if (window.popupManager) {
                    console.log('PopupManager available, closing budget-panel (outside click)');
                    window.popupManager.forceClosePopup('budget-panel');
                } else {
                    console.warn('PopupManager not available, falling back to manual resume (outside click)');
                    // Fallback: resume manuel si PopupManager n'est pas disponible
                    if (window.game) {
                        window.game.play();
                        console.log('Game resumed manually after clicking outside budget panel');
                    }
                }
            }
        });
    }
    
    window.gameStore = gameStore;
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

    // Initialize urban advice center
    initUrbanAdviceCenter();
    
    // Initialize budget states popup
    initBudgetStatesPopup();
    
    // Initialize loans popup
    initLoansPopup();
    
    // Initialize loan payment system
    initLoanPaymentSystem();
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
            
            // Get population data from game table
            let population = null;
            let populationError = false;
            if (window.gameStore) {
                try {
                    population = await window.gameStore.getLatestGameItemByField('population');
                    if (population === null || population === undefined) {
                        // Keep previous value if available, otherwise show loading
                        const currentPop = realtimePopulationEl ? realtimePopulationEl.textContent : '0';
                        if (currentPop === 'Chargement...' || currentPop === '0') {
                            population = '0'; // Show 0 instead of "Chargement..."
                        } else {
                            population = currentPop; // Keep previous value
                        }
                    }
                } catch (error) {
                    console.error('Error fetching population:', error);
                    population = 'Erreur';
                    populationError = true;
                }
            } else {
                population = '0'; // Show 0 instead of "Chargement..."
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
                        realtimePopulationEl.title = 'Population actuelle';
                    }
                } else {
                    realtimePopulationEl.textContent = population.toString();
                }
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
            console.log('No budget states available for filter labels');
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

        console.log(`📊 Updated filter labels for actual budget states:`, 
            last3States.map(s => `Turn ${s.turn}`).join(', '));
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
                        <span class="statement-label">Impôts (${population} habitants)</span>
                        <span class="statement-value positive">${(state.totalTaxes || 0).toLocaleString('fr-FR')}€</span>
                    </div>
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
        console.warn('Urban Advice Center elements not found');
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

        console.log('🏘️ Urban analysis loaded:', {
            socialClasses,
            markets: markets.length,
            fieldTypes
        });

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

        // Check for road connectivity
        const housesWithoutRoads = houses.filter(house => {
            if (!house.type || !house.type.includes('House')) return false;
            return !house.neighbors || house.neighbors.filter(n => n.name === 'roads').length === 0;
        });

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
        
        activeLoansList.innerHTML = activeLoans.map(loan => `
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
            </div>
        `).join('');
        
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

// Loan Management System
async function processLoanPayments() {
    try {
        const activeLoans = await budgetManager.getActiveLoans();
        if (activeLoans.length === 0) return;
        
        const loansToRemove = [];
        
        for (let i = 0; i < activeLoans.length; i++) {
            const loan = activeLoans[i];
            
            // Calculate monthly payment (principal + interest)
            const monthlyPayment = Math.round(loan.total / loan.duration);
            const interestPayment = Math.round(loan.amount * (loan.interestRate / 100) / loan.duration);
            const principalPayment = monthlyPayment - interestPayment;
            
            // Check if we have enough funds
            const currentBudget = await budgetManager.getCurrentBudget();
            if (currentBudget.funds >= monthlyPayment) {
                // Pay interest first
                await budgetManager.addLoanInterest(interestPayment, `Intérêts prêt ${loan.type} (${loan.id})`);
                
                // Pay principal
                await budgetManager.repayLoan(principalPayment, `Remboursement prêt ${loan.type} (${loan.id})`, loan.id);
                
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
                } else {
                    // Can't even pay interest - loan goes into default
                    console.warn(`Loan ${loan.id} in default - cannot pay interest`);
                    loan.remainingTurns--;
                }
            }
        }
        
        // Update displays
        updateBudgetDisplay();
        
    } catch (error) {
        console.error('Error processing loan payments:', error);
    }
}

// Initialize loan payment system
function initLoanPaymentSystem() {
    // Expose processLoanPayments globally for scene.js
    window.processLoanPayments = processLoanPayments;
    
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

// Global refresh function for budget states modal
async function refreshBudgetStatesModal() {
    console.log('🔄 Refreshing budget states modal...');
    
    // Get current active filter button
    const activeFilterBtn = document.querySelector('.budget-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : '3';
    
    // Reload budget states with current period
    await loadBudgetStates(currentPeriod, true);
    
    // Update filter button labels
    await updateFilterButtonLabels();
    
    console.log('✅ Budget states modal refreshed');
}

// Make refresh function globally accessible
window.refreshBudgetStatesModal = refreshBudgetStatesModal;