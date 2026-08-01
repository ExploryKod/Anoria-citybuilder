/**
 * FoodTraceabilityPanel — traçabilité alimentaire admin (DOM + événements).
 */
import { getOrCreateSupplyContext, getAllFoodTraceabilityTransactions } from "../../acl/supply.js";
import { tryResolveBuildingInstanceIdFromRef } from "../../acl/building-identity.js";

function buildingStockKey(building) {
    return tryResolveBuildingInstanceIdFromRef(building) ?? building?.id ?? null;
}

// Initialize food traceability tabs (separate function so it can be called when modal opens)
let tabsInitialized = false;

/**
 * Initialise le popup de traçabilité alimentaire
 */
export function initFoodTraceabilityPopup() {
    const foodTraceabilityRefreshBtn = document.getElementById('food-traceability-refresh-btn');
    const filterButtons = document.querySelectorAll('.food-traceability-filter-btn');
    
    if (!foodTraceabilityRefreshBtn) {
        console.warn('Food traceability refresh button not found');
        return;
    }
    
    // Refresh button (works in administrator panel)
    foodTraceabilityRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.food-traceability-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadFoodTraceabilityEntries(currentPeriod);
    });
    
    // Filter buttons (works in administrator panel)
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

/**
 * Initialise les onglets de traçabilité alimentaire
 */
export function initializeFoodTraceabilityTabs() {
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

/**
 * Charge et affiche les entrées de traçabilité alimentaire
 */
export async function loadFoodTraceabilityEntries(period = 'all') {
    const foodTraceabilityList = document.getElementById('food-traceability-list');
    if (!foodTraceabilityList) return;
    
    foodTraceabilityList.innerHTML = `
        <div class="food-traceability-loading">
            <div class="loading-spinner"></div>
            <p>Chargement de la traçabilité...</p>
        </div>
    `;
    
    try {
        let transactions = await getAllFoodTraceabilityTransactions();
        
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
        
        // Current stocks via Supply BC (not raw Dexie)
        let currentStocks = {};
        let allBuildingsData = [];
        try {
            const supply = getOrCreateSupplyContext();
            allBuildingsData = await supply.listSupplyStockSnapshots();
            allBuildingsData.forEach(building => {
                const buildingKey = buildingStockKey(building);
                if (buildingKey && building.stocks) {
                    currentStocks[buildingKey] = building.stocks;
                }
            });
        } catch (err) {
            console.warn('Could not fetch current stocks from Supply:', err);
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
            const buildingKey = buildingStockKey(building);
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
                if (building.kind === 'farm' || (building.type && (building.type.includes('Farm') || building.type.includes('Farms')))) {
                    const farmKey = buildingStockKey(building);
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
                if (building.kind === 'market' || (building.type && (building.type.includes('Market') || building.type.includes('Commerce')))) {
                    const marketKey = buildingStockKey(building);
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
                if (building.kind === 'house' || (building.type && (building.type.includes('House') || building.type.includes('Maison')))) {
                    const houseKey = buildingStockKey(building);
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

/**
 * Helper function to create Farm-Market section HTML with columns
 */
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

/**
 * Helper function to create Market-House section HTML with columns
 */
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

/**
 * Helper function to create building stocks HTML
 */
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

/**
 * Crée le HTML pour une transaction de traçabilité alimentaire
 */
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

/**
 * Charge et affiche les graphiques alimentaires
 */
export async function loadFoodCharts() {
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
        const transactions = await getAllFoodTraceabilityTransactions();
        
        // House pop via Supply BC (not raw Dexie)
        const supply = getOrCreateSupplyContext();
        const allHouses = (await supply.listSupplyStockSnapshots()).filter(
            (b) => b.kind === 'house' || (b.type && (b.type.includes('House') || b.type.includes('Maison')))
        );
        
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
                        const houseKey = buildingStockKey(house);
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

/**
 * Render food statistics with icons and colors - simplified to show fed/unfed population
 */
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

