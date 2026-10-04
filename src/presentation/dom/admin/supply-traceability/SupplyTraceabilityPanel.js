/**
 * SupplyTraceabilityPanel — traçabilité alimentaire admin (DOM + événements).
 * Rendu HTML : SupplyTraceabilityPresenter.js
 */

import { buildingName, goodLabel } from '../../shell/CatalogVocabulary.js';
import { listHamlets, requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import {
    buildingStockKey,
    createFarmMarketSectionHTML,
    createMarketHouseSectionHTML,
    createBuildingStocksHTML,
    renderDietStats,
    summarizeChain,
    buildSupplyTraceabilityExport,
    chainTotalKey,
    isChainGood,
    emptyGoodsTally,
    deductGoods,
    refreshChainTotal,
    hasChainGoods,
    STATE_TRANSACTION_TYPES,
} from './SupplyTraceabilityPresenter.js';
import { createEmptyStocks, getResourceStockShape, getSuppliedCategories, listQuantityConsumerNeeds } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

/** @type {{ supply: object } | null} */
let deps = null;

/** Category pill the player has selected, or null for all categories. */
let activeCategoryFilter = null;

/** Category pill selected in the Satisfaction tab, or null for food (default). */
let activeChartCategory = null;

/** Cached transactions for the Satisfaction tab — avoids re-fetching on year/pill change. */
let satisfactionCache = null;

// Initialize food traceability tabs (separate function so it can be called when modal opens)
let tabsInitialized = false;

/**
 * Initialise le popup de traçabilité alimentaire
 */
/**
 * @param {{ supply: object }} panelDeps
 */
export function initSupplyTraceabilityPopup(panelDeps) {
    deps = panelDeps;
    const supplyTraceabilityRefreshBtn = document.getElementById('supply-traceability-refresh-btn');
    const filterButtons = document.querySelectorAll('.supply-traceability-filter-btn');
    
    if (!supplyTraceabilityRefreshBtn) {
        console.warn('Food traceability refresh button not found');
        return;
    }
    
    // Refresh button (works in administrator panel)
    supplyTraceabilityRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.supply-traceability-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadSupplyTraceabilityEntries(currentPeriod);
    });
    
    // Filter buttons (works in administrator panel)
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadSupplyTraceabilityEntries(btn.dataset.period);
        });
    });
    
    // Initialize tabs (can be called multiple times safely)
    initializeSupplyTraceabilityTabs();
}

/**
 * Initialise les onglets de traçabilité alimentaire
 */
export function initializeSupplyTraceabilityTabs() {
    if (tabsInitialized) return; // Avoid duplicate listeners
    
    const tabs = document.querySelectorAll('.supply-traceability-tab');
    const tabContents = document.querySelectorAll('.supply-traceability-tab-content');
    
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
                const expectedId = `supply-traceability-${targetTab}-tab`;
                if (content.id === expectedId) {
                    content.classList.add('active');
                }
            });
            
            // Load charts if charts tab is selected
            if (targetTab === 'charts') {
                loadSatisfactionCharts();
            }
        });
    });
    
    // Charts refresh button
    const chartsRefreshBtn = document.getElementById('supply-charts-refresh-btn');
    if (chartsRefreshBtn) {
        chartsRefreshBtn.addEventListener('click', () => {
            loadSatisfactionCharts();
        });
    }
    
    // Export transactions tab as raw JSON
    const transactionsExportBtn = document.getElementById('supply-traceability-export-btn');
    if (transactionsExportBtn) {
        transactionsExportBtn.addEventListener('click', () => {
            exportTransactionsToJSON();
        });
    }

    // Export the traceability as JSON, like the accounting journal
    const chartsExportBtn = document.getElementById('supply-charts-export-btn');
    if (chartsExportBtn) {
        chartsExportBtn.addEventListener('click', () => {
            exportSupplyTraceabilityToJSON();
        });
    }

    // Year selector: only re-render the chart, not the full UI
    const yearSelect = document.getElementById('supply-charts-year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            renderSatisfactionChart();
        });
    }
    
    tabsInitialized = true;
}

/** The name the catalog gives a building type — what the player reads, whatever the origin (market, chapel, windmill…). */
function buildingLabelOf(type) {
    return type ? buildingName(type) : '—';
}

/**
 * Charge et affiche les entrées de traçabilité alimentaire
 */
/** The stock matrix and summaries cover the active hamlet: name it in the header. */
async function showActiveHamletLabel() {
    const labels = document.querySelectorAll('[data-hamlet-label]');
    if (labels.length === 0) throw new Error('[traceability] no hamlet label is present in the page');
    const activeId = requireActiveHamletId();
    const active = (await listHamlets()).find((hamlet) => hamlet.id === activeId);
    if (!active) throw new Error(`[traceability] active hamlet ${activeId} is not in the catalogue`);
    labels.forEach((label) => { label.textContent = active.name; });
}

/** One line per transaction of every hamlet, each naming the hamlet it took place in. */
async function renderTransactionLog() {
    const logs = document.querySelectorAll('[data-transaction-log]');
    if (logs.length === 0) throw new Error('[traceability] no transaction log is present in the page');
    const [transactions, hamlets] = await Promise.all([
        deps.supply.getAllSupplyTraceabilityTransactions(),
        listHamlets(),
    ]);
    const hamletsById = new Map(hamlets.map((hamlet) => [hamlet.id, hamlet]));
    const rows = [...transactions]
        .filter((transaction) => !STATE_TRANSACTION_TYPES.has(transaction.transactionType))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((transaction) => {
            const hamlet = hamletsById.get(transaction.hamletId);
            if (!hamlet) {
                throw new Error(`[traceability] transaction ${transaction.id} belongs to an unknown hamlet ${transaction.hamletId}`);
            }
            const row = document.createElement('div');
            row.className = 'supply-traceability-log-row';
            const cells = [
                ['supply-traceability-log-hamlet', hamlet.name],
                ['supply-traceability-log-date', new Date(transaction.date).toLocaleString('fr-FR')],
                ['supply-traceability-log-good', goodLabel(transaction.foodType) || transaction.foodType || ''],
                ['supply-traceability-log-quantity', String(transaction.quantity ?? '')],
                ['supply-traceability-log-route', `${buildingName(transaction.fromType)} → ${buildingName(transaction.toType)}`],
            ];
            for (const [className, text] of cells) {
                const cell = document.createElement('span');
                cell.className = className;
                cell.textContent = text;
                if (className === 'supply-traceability-log-hamlet') cell.style.setProperty('--hamlet-color', hamlet.color);
                row.append(cell);
            }
            return row;
        });
    logs.forEach((log) => log.replaceChildren(...rows.map((row) => row.cloneNode(true))));
}

export async function loadSupplyTraceabilityEntries(period = 'all') {
    const supplyTraceabilityList = document.getElementById('supply-traceability-list');
    if (!supplyTraceabilityList) return;
    await showActiveHamletLabel();
    
    supplyTraceabilityList.innerHTML = `
        <div class="supply-traceability-loading">
            <div class="loading-spinner"></div>
            <p>Chargement de la traçabilité...</p>
        </div>
    `;
    
    try {
        await renderTransactionLog();
        const hamletsById = new Map((await listHamlets()).map((hamlet) => [hamlet.id, hamlet]));
        const withHamletOf = (pair) => {
            const ids = [...new Set(pair.transactions.map((transaction) => transaction.hamletId))];
            if (ids.length !== 1) throw new Error(`[traceability] a pair mixes hamlets: ${ids.join(', ')}`);
            const hamlet = hamletsById.get(ids[0]);
            if (!hamlet) throw new Error(`[traceability] pair belongs to an unknown hamlet ${ids[0]}`);
            pair.hamletName = hamlet.name;
            pair.hamletColor = hamlet.color;
            return pair;
        };
        let transactions = await deps.supply.getAllSupplyTraceabilityTransactions(null, requireActiveHamletId());

        // Filter by period
        if (period !== 'all') {
            const now = new Date();
            const periodMs = parseInt(period) * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(now.getTime() - periodMs);

            transactions = transactions.filter(transaction => new Date(transaction.date) >= cutoffDate);
        }

        // All categories present in the log, in insertion order
        const allCategoriesInLog = [...new Set(
            transactions
                .filter(t => t.foodType && t.transactionType !== 'population_state' && t.transactionType !== 'building_state' && t.transactionType !== 'employment_summary')
                .map(t => t.foodType)
        )];

        // Active filter: keep if present in the log, reset otherwise
        if (activeCategoryFilter && !allCategoriesInLog.includes(activeCategoryFilter)) {
            activeCategoryFilter = null;
        }
        const activeCategoriesArr = activeCategoryFilter ? [activeCategoryFilter] : allCategoriesInLog;
        const { totalKeys } = getResourceStockShape();
        // The total key for the active category: use the first totalKey that matches a category in the filter
        // or fall back to the default chainTotalKey
        const activeTotalKey = chainTotalKey;

        // Render category pills
        const pillsContainer = document.getElementById('supply-traceability-category-pills');
        if (pillsContainer) {
            const allPill = `<button class="supply-traceability-category-pill${activeCategoryFilter === null ? ' active' : ''}" data-category="">Tous</button>`;
            const goodPills = allCategoriesInLog.map(cat => {
                const label = goodLabel(cat) || cat;
                return `<button class="supply-traceability-category-pill${activeCategoryFilter === cat ? ' active' : ''}" data-category="${cat}">${label}</button>`;
            }).join('');
            pillsContainer.innerHTML = allPill + goodPills;
            pillsContainer.querySelectorAll('.supply-traceability-category-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    activeCategoryFilter = btn.dataset.category || null;
                    loadSupplyTraceabilityEntries(period);
                });
            });
        }

        if (transactions.length === 0) {
            supplyTraceabilityList.innerHTML = `
                <div class="no-supply-traceability-entries">
                    <div class="no-supply-traceability-entries-icon">🌾</div>
                    <div class="no-supply-traceability-entries-text">Aucune transaction enregistrée</div>
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
            allBuildingsData = await deps.supply.listSupplyStockSnapshots();
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
            stocksByMonth[buildingKey][currentMonthKey] = { ...(currentStocks[buildingKey] || createEmptyStocks()) };
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
                const stocksAfter = stocksByMonth[buildingKey][previousMonthKey] || createEmptyStocks();
                
                // Calculate stocks before this month by reversing transactions
                const stocksBefore = { ...stocksAfter };
                
                // Helper to check if transaction matches building
                const matchesBuilding = (t, isFrom) => {
                    const id = isFrom ? t.fromId : t.toId;
                    const coords = isFrom ? t.fromCoords : t.toCoords;
                    return id === buildingKey || coords === buildingKey;
                };
                
                // Reverse producer-to-hub transactions (producer sold to hub)
                monthTransactions.filter(t =>
                    t.transactionType === 'source_to_hub' && matchesBuilding(t, true)
                ).forEach(t => {
                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = (stocksBefore[t.foodType] || 0) + t.quantity;
                });

                // Reverse hub receipt from producer (hub bought from producer)
                monthTransactions.filter(t =>
                    t.transactionType === 'source_to_hub' && matchesBuilding(t, false)
                ).forEach(t => {
                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = Math.max(0, (stocksBefore[t.foodType] || 0) - t.quantity);
                });

                // Reverse hub-to-distributor transactions (hub sold)
                monthTransactions.filter(t =>
                    t.transactionType === 'source_to_distributor' && matchesBuilding(t, true)
                ).forEach(t => {
                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = (stocksBefore[t.foodType] || 0) + t.quantity;
                });

                // Reverse distributor receipt from hub (distributor bought from hub)
                monthTransactions.filter(t =>
                    t.transactionType === 'source_to_distributor' && matchesBuilding(t, false)
                ).forEach(t => {
                    const salesThisMonth = monthTransactions.filter(st =>
                        st.transactionType === 'distributor_to_consumer' &&
                        matchesBuilding(st, true) &&
                        st.foodType === t.foodType
                    ).reduce((sum, st) => sum + st.quantity, 0);

                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = Math.max(0, (stocksBefore[t.foodType] || 0) - t.quantity + salesThisMonth);
                });

                // Reverse distributor-to-consumer transactions (distributor sold)
                monthTransactions.filter(t =>
                    t.transactionType === 'distributor_to_consumer' && matchesBuilding(t, true)
                ).forEach(t => {
                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = (stocksBefore[t.foodType] || 0) + t.quantity;
                });

                // Reverse consumer purchases (consumer bought)
                monthTransactions.filter(t =>
                    t.transactionType === 'distributor_to_consumer' && matchesBuilding(t, false)
                ).forEach(t => {
                    const consumptionThisMonth = monthTransactions.filter(ct =>
                        ct.transactionType === 'house_consumption' &&
                        matchesBuilding(ct, true) &&
                        ct.foodType === t.foodType
                    ).reduce((sum, ct) => sum + ct.quantity, 0);

                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = Math.max(0, (stocksBefore[t.foodType] || 0) - t.quantity + consumptionThisMonth);
                });

                // Reverse house consumption
                monthTransactions.filter(t =>
                    t.transactionType === 'house_consumption' && matchesBuilding(t, true)
                ).forEach(t => {
                    if (isChainGood(t.foodType, activeCategoriesArr)) stocksBefore[t.foodType] = (stocksBefore[t.foodType] || 0) + t.quantity;
                });

                refreshChainTotal(stocksBefore, activeCategoriesArr, activeTotalKey);
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
            
            // Group transactions by pair (Source→Hub, Hub→Distributeur, Distributeur→Consommateur)
            // Only the active category filter is considered.

            // 0. Group Producer-Hub transactions (source_to_hub)
            const producerHubPairs = {};
            transactions.filter(t => t.transactionType === 'source_to_hub' && isChainGood(t.foodType, activeCategoriesArr)).forEach(transaction => {
                const sourceKey = transaction.fromId || transaction.fromCoords;
                const hubKey = transaction.toId || transaction.toCoords;
                const pairKey = `${sourceKey}-${hubKey}`;
                if (!producerHubPairs[pairKey]) {
                    producerHubPairs[pairKey] = {
                        farmKey: sourceKey,
                        farmCoords: transaction.fromCoords,
                        fromLabel: buildingLabelOf(transaction.fromType),
                        marketKey: hubKey,
                        marketCoords: transaction.toCoords,
                        toLabel: buildingLabelOf(transaction.toType),
                        transactions: [],
                        byFoodType: {}
                    };
                }
                producerHubPairs[pairKey].transactions.push(transaction);
                const foodType = transaction.foodType;
                if (!producerHubPairs[pairKey].byFoodType[foodType]) producerHubPairs[pairKey].byFoodType[foodType] = 0;
                producerHubPairs[pairKey].byFoodType[foodType] += transaction.quantity;
            });

            // 1. Group Hub-Distributor transactions (source_to_distributor)
            const farmMarketPairs = {};
            transactions.filter(t => t.transactionType === 'source_to_distributor' && isChainGood(t.foodType, activeCategoriesArr)).forEach(transaction => {
                const farmKey = transaction.fromId || transaction.fromCoords;
                const marketKey = transaction.toId || transaction.toCoords;
                const pairKey = `${farmKey}-${marketKey}`;
                
                if (!farmMarketPairs[pairKey]) {
                    farmMarketPairs[pairKey] = {
                        farmKey,
                        farmCoords: transaction.fromCoords,
                        fromLabel: buildingLabelOf(transaction.fromType),
                        marketKey,
                        marketCoords: transaction.toCoords,
                        toLabel: buildingLabelOf(transaction.toType),
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
            
            // 2. Group Distributor-Consumer transactions
            const marketHousePairs = {};
            transactions.filter(t => t.transactionType === 'distributor_to_consumer' && isChainGood(t.foodType, activeCategoriesArr)).forEach(transaction => {
                const marketKey = transaction.fromId || transaction.fromCoords;
                const houseKey = transaction.toId || transaction.toCoords;
                const pairKey = `${marketKey}-${houseKey}`;
                
                if (!marketHousePairs[pairKey]) {
                    marketHousePairs[pairKey] = {
                        marketKey,
                        marketCoords: transaction.fromCoords,
                        fromLabel: buildingLabelOf(transaction.fromType),
                        houseKey,
                        houseCoords: transaction.toCoords,
                        toLabel: buildingLabelOf(transaction.toType),
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

            // Producer-Hub sections (source_to_hub)
            Object.values(producerHubPairs).forEach(pair => {
                const sourceStocksBefore = stocksByMonth[pair.farmKey]?.[key] || createEmptyStocks();
                const hubStocksBefore = stocksByMonth[pair.marketKey]?.[key] || createEmptyStocks();
                const sourceStocksAfter = { ...sourceStocksBefore };
                const hubStocksAfter = { ...hubStocksBefore };
                Object.entries(pair.byFoodType).forEach(([foodType, quantity]) => {
                    if (isChainGood(foodType, activeCategoriesArr)) {
                        sourceStocksAfter[foodType] = Math.max(0, (sourceStocksAfter[foodType] || 0) - quantity);
                        hubStocksAfter[foodType] = (hubStocksAfter[foodType] || 0) + quantity;
                    }
                });
                refreshChainTotal(sourceStocksAfter, activeCategoriesArr, activeTotalKey);
                refreshChainTotal(hubStocksAfter, activeCategoriesArr, activeTotalKey);
                sections.push(createFarmMarketSectionHTML(withHamletOf(pair), sourceStocksBefore, hubStocksBefore, pair.byFoodType, sourceStocksAfter, hubStocksAfter, { categories: activeCategoriesArr, totalKey: activeTotalKey }));
            });

            // Hub-Distributor sections (source_to_distributor)
            Object.values(farmMarketPairs).forEach(pair => {
                // Get stocks from calculated stocksByMonth
                const farmStocksBefore = stocksByMonth[pair.farmKey]?.[key] || createEmptyStocks();
                const marketStocksBefore = stocksByMonth[pair.marketKey]?.[key] || createEmptyStocks();
                
                // Calculate stocks AFTER this month's transactions
                const farmStocksAfter = { ...farmStocksBefore };
                const marketStocksAfter = { ...marketStocksBefore };
                
                // Apply transactions
                Object.entries(pair.byFoodType).forEach(([foodType, quantity]) => {
                    if (isChainGood(foodType, activeCategoriesArr)) {
                        farmStocksAfter[foodType] = Math.max(0, (farmStocksAfter[foodType] || 0) - quantity);
                        marketStocksAfter[foodType] = (marketStocksAfter[foodType] || 0) + quantity;
                    }
                });
                
                // Also account for distributor sales this month
                const marketSalesThisMonth = emptyGoodsTally(activeCategoriesArr);
                transactions.filter(t =>
                    t.transactionType === 'distributor_to_consumer' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === pair.marketKey || t.fromCoords === pair.marketCoords)
                ).forEach(t => {
                    marketSalesThisMonth[t.foodType] = (marketSalesThisMonth[t.foodType] || 0) + t.quantity;
                });

                deductGoods(marketStocksAfter, marketSalesThisMonth, activeCategoriesArr);

                refreshChainTotal(farmStocksAfter, activeCategoriesArr, activeTotalKey);
                refreshChainTotal(marketStocksAfter, activeCategoriesArr, activeTotalKey);

                sections.push(createFarmMarketSectionHTML(withHamletOf(pair), farmStocksBefore, marketStocksBefore, pair.byFoodType, farmStocksAfter, marketStocksAfter, { categories: activeCategoriesArr, totalKey: activeTotalKey }));
            });
            
            // Market-House sections
            Object.values(marketHousePairs).forEach(pair => {
                // Get stocks from calculated stocksByMonth
                const marketStocksBefore = stocksByMonth[pair.marketKey]?.[key] || createEmptyStocks();
                const houseStocksBefore = stocksByMonth[pair.houseKey]?.[key] || createEmptyStocks();
                
                // Calculate stocks AFTER this month's transactions
                const marketStocksAfter = { ...marketStocksBefore };
                const houseStocksAfter = { ...houseStocksBefore };
                
                // Apply transactions
                Object.entries(pair.byFoodType).forEach(([foodType, quantity]) => {
                    if (isChainGood(foodType, activeCategoriesArr)) {
                        marketStocksAfter[foodType] = Math.max(0, (marketStocksAfter[foodType] || 0) - quantity);
                        houseStocksAfter[foodType] = (houseStocksAfter[foodType] || 0) + quantity;
                    }
                });
                
                // Also account for house consumption this month
                const houseConsumptionThisMonth = emptyGoodsTally(activeCategoriesArr);
                transactions.filter(t =>
                    t.transactionType === 'house_consumption' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === pair.houseKey || t.fromCoords === pair.houseCoords)
                ).forEach(t => {
                    houseConsumptionThisMonth[t.foodType] = (houseConsumptionThisMonth[t.foodType] || 0) + t.quantity;
                });

                deductGoods(houseStocksAfter, houseConsumptionThisMonth, activeCategoriesArr);

                refreshChainTotal(marketStocksAfter, activeCategoriesArr, activeTotalKey);
                refreshChainTotal(houseStocksAfter, activeCategoriesArr, activeTotalKey);

                sections.push(createMarketHouseSectionHTML(withHamletOf(pair), marketStocksBefore, houseStocksBefore, pair.byFoodType, marketStocksAfter, houseStocksAfter, { categories: activeCategoriesArr, totalKey: activeTotalKey }));
            });
            
            // Also show farms with stocks but no sales (production not yet sold)
            // Show stocks for farms, markets, and houses for this month
            const stocksSections = [];
            
            const stockOpts = { categories: activeCategoriesArr, totalKey: activeTotalKey };

            // Show stocks for hubs (granaries, warehouses) this month
            allBuildingsData.forEach(building => {
                if (building.kind !== 'hub') return;
                const hubKey = buildingStockKey(building);
                const hubStocks = stocksByMonth[hubKey]?.[key] || createEmptyStocks();
                const hubStocksAfter = { ...hubStocks };

                transactions.filter(t =>
                    t.transactionType === 'source_to_hub' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.toId === hubKey || t.toCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    hubStocksAfter[t.foodType] = (hubStocksAfter[t.foodType] || 0) + t.quantity;
                });

                transactions.filter(t =>
                    t.transactionType === 'source_to_distributor' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === hubKey || t.fromCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    hubStocksAfter[t.foodType] = Math.max(0, (hubStocksAfter[t.foodType] || 0) - t.quantity);
                });

                refreshChainTotal(hubStocksAfter, activeCategoriesArr, activeTotalKey);
                if (hubStocksAfter[activeTotalKey] > 0 || hasChainGoods(hubStocks, activeCategoriesArr)) {
                    stocksSections.push(createBuildingStocksHTML(buildingName(building.type), `${building.x},${building.y}`, hubStocksAfter, 'hub', stockOpts));
                }
            });

            // Show stocks for all producers this month
            allBuildingsData.forEach(building => {
                if (building.kind !== 'farm') return;
                const farmKey = buildingStockKey(building);
                const farmStocks = stocksByMonth[farmKey]?.[key] || createEmptyStocks();
                const farmStocksAfter = { ...stocksByMonth[farmKey]?.[key] || createEmptyStocks() };

                transactions.filter(t =>
                    t.transactionType === 'source_to_distributor' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === farmKey || t.fromCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    farmStocksAfter[t.foodType] = Math.max(0, (farmStocksAfter[t.foodType] || 0) - t.quantity);
                });
                refreshChainTotal(farmStocksAfter, activeCategoriesArr, activeTotalKey);

                if (farmStocksAfter[activeTotalKey] > 0 || hasChainGoods(farmStocks, activeCategoriesArr)) {
                    const hasTransactions = transactions.some(t =>
                        t.transactionType === 'source_to_distributor' &&
                        isChainGood(t.foodType, activeCategoriesArr) &&
                        (t.fromId === farmKey || t.fromCoords === building.x + ',' + building.y)
                    );
                    if (!hasTransactions) {
                        stocksSections.push(createBuildingStocksHTML(buildingName(building.type), `${building.x},${building.y}`, farmStocksAfter, 'farm', stockOpts));
                    }
                }
            });

            // Show stocks for all distributors/markets this month
            allBuildingsData.forEach(building => {
                if (building.kind !== 'market' && building.kind !== 'service') return;
                const marketKey = buildingStockKey(building);
                const marketStocks = stocksByMonth[marketKey]?.[key] || createEmptyStocks();
                const marketStocksAfter = { ...marketStocks };

                transactions.filter(t =>
                    t.transactionType === 'source_to_distributor' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.toId === marketKey || t.toCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    marketStocksAfter[t.foodType] = (marketStocksAfter[t.foodType] || 0) + t.quantity;
                });

                transactions.filter(t =>
                    t.transactionType === 'distributor_to_consumer' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === marketKey || t.fromCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    marketStocksAfter[t.foodType] = Math.max(0, (marketStocksAfter[t.foodType] || 0) - t.quantity);
                });

                refreshChainTotal(marketStocksAfter, activeCategoriesArr, activeTotalKey);

                if (marketStocksAfter[activeTotalKey] > 0 || hasChainGoods(marketStocks, activeCategoriesArr)) {
                    stocksSections.push(createBuildingStocksHTML(buildingName(building.type), `${building.x},${building.y}`, marketStocksAfter, 'market', stockOpts));
                }
            });

            // Show stocks for all consumer houses this month
            allBuildingsData.forEach(building => {
                if (building.kind !== 'house') return;
                const houseKey = buildingStockKey(building);
                const houseStocks = stocksByMonth[houseKey]?.[key] || createEmptyStocks();
                const houseStocksAfter = { ...houseStocks };

                transactions.filter(t =>
                    t.transactionType === 'distributor_to_consumer' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.toId === houseKey || t.toCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    houseStocksAfter[t.foodType] = (houseStocksAfter[t.foodType] || 0) + t.quantity;
                });

                transactions.filter(t =>
                    t.transactionType === 'house_consumption' &&
                    isChainGood(t.foodType, activeCategoriesArr) &&
                    (t.fromId === houseKey || t.fromCoords === building.x + ',' + building.y)
                ).forEach(t => {
                    houseStocksAfter[t.foodType] = Math.max(0, (houseStocksAfter[t.foodType] || 0) - t.quantity);
                });

                refreshChainTotal(houseStocksAfter, activeCategoriesArr, activeTotalKey);

                if (houseStocksAfter[activeTotalKey] > 0 || hasChainGoods(houseStocks, activeCategoriesArr)) {
                    stocksSections.push(createBuildingStocksHTML(buildingName(building.type), `${building.x},${building.y}`, houseStocksAfter, 'house', stockOpts));
                }
            });
            
            const unsoldFarmsHTML = stocksSections.join('');
            
            return `
                <div class="supply-traceability-month-group">
                    <h4 class="supply-traceability-month-header">${monthName} ${yearDisplay}</h4>
                    <div class="supply-traceability-month-content">
                        ${sections.join('')}
                        ${unsoldFarmsHTML}
                    </div>
                </div>
            `;
        }).join('');
        
        supplyTraceabilityList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading food traceability entries:', error);
        supplyTraceabilityList.innerHTML = `
            <div class="supply-traceability-loading">
                <p>Erreur lors du chargement de la traçabilité: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Fed / unfed population of every month that has data, from the traceability log.
 * @param {Array<object>} transactions
 * @param {Array<object>} allHouses Current houses — only used for saves without a population log.
 * @returns {{ dataByYearMonth: Record<string, { year: number, month: number, fedPopulation: number, unfedPopulation: number }>, years: Set<number> }}
 */
export function computeMonthlyDietStats(transactions, allHouses) {
        // Group consumption transactions by year and month to get fed population
        const dataByYearMonth = {};
        const years = new Set();
        
        // First pass: collect all months with transactions
        transactions.forEach(transaction => {
            const year = transaction.year !== undefined ? transaction.year : 0;
            years.add(year);
        });
        
        // Oldest turn first, so "last tick of the month" really is the last
        const chronological = [...transactions].sort(
            (a, b) => (a.turn - b.turn) || (new Date(a.date) - new Date(b.date))
        );

        // Second pass: calculate fed/unfed for each month
        years.forEach(year => {
            for (let month = 0; month < 12; month++) {
                const key = `${year}-${month}`;
                
                // Get all consumption transactions for this month — food need only
                const monthConsumptions = transactions.filter(t =>
                    t.transactionType === 'house_consumption' &&
                    t.foodType === chainTotalKey &&
                    t.year === year &&
                    t.month === month
                );
                
                // Inhabitants each house really had that month (last tick of the month wins)
                const monthPopulation = {};
                chronological
                    .filter(t =>
                        t.transactionType === 'population_state' &&
                        t.year === year &&
                        t.month === month
                    )
                    .forEach(t => { monthPopulation[t.fromId || t.fromCoords] = t.quantity; });
                const hasPopulationLog = Object.keys(monthPopulation).length > 0;

                // A house that ate is counted at the size it had at the meal: people born
                // afterwards this month did not eat yet, they are not "unfed"
                monthConsumptions.forEach(consumption => {
                    const houseKey = consumption.fromId || consumption.fromCoords;
                    if (houseKey && Number.isFinite(consumption.pop) && houseKey in monthPopulation) {
                        monthPopulation[houseKey] = consumption.pop;
                    }
                });

                if (monthConsumptions.length === 0 && !hasPopulationLog) {
                    // Nothing recorded for this month
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
                
                let fedPopulation = Object.values(housesFed).reduce((sum, citizens) => sum + citizens, 0);
                let unfedPopulation = 0;

                if (hasPopulationLog) {
                    // Real population of that month, house by house — a house fed 2 of its 12 has 10 unfed
                    fedPopulation = 0;
                    Object.entries(monthPopulation).forEach(([houseKey, housePop]) => {
                        const houseFed = Math.min(housesFed[houseKey] || 0, housePop);
                        fedPopulation += houseFed;
                        unfedPopulation += housePop - houseFed;
                    });
                } else {
                // Older saves: no population log, fall back to today's houses
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
                }

                if (fedPopulation + unfedPopulation === 0) {
                    // No inhabitants that month (houses not yet populated)
                    continue;
                }

                dataByYearMonth[key] = {
                    year,
                    month,
                    fedPopulation: fedPopulation,
                    unfedPopulation: unfedPopulation
                };
            }
        });

        return { dataByYearMonth, years };
}

/**
 * Day plus time of day (2026-09-20-163045), so several exports never overwrite each other.
 * @returns {string}
 */
function nextExportStamp() {
    const now = new Date();
    return `${now.toISOString().split('T')[0]}-${now.toTimeString().slice(0, 8).replace(/:/g, '')}`;
}

/**
 * Downloads all raw traceability transactions as JSON — every row as stored, unprocessed.
 * Useful for debugging: the full picture without any panel-side filtering or aggregation.
 */
export async function exportTransactionsToJSON() {
    try {
        const transactions = await deps.supply.getAllSupplyTraceabilityTransactions(null, requireActiveHamletId());
        const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${nextExportStamp()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('[SupplyTraceability] Error exporting transactions to JSON:', error);
        alert("Erreur lors de l'export JSON: " + error.message);
    }
}

/**
 * Downloads the whole traceability (per-year balance and events) as JSON.
 */
export async function exportSupplyTraceabilityToJSON() {
    try {
        const transactions = await deps.supply.getAllSupplyTraceabilityTransactions(null, requireActiveHamletId());
        const allHouses = (await deps.supply.listSupplyStockSnapshots()).filter(
            (b) => b.kind === 'house' || (b.type && (b.type.includes('House') || b.type.includes('Maison')))
        );
        const { dataByYearMonth } = computeMonthlyDietStats(transactions, allHouses);
        const payload = buildSupplyTraceabilityExport(transactions, Object.values(dataByYearMonth));

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `supply-traceability-${nextExportStamp()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('[SupplyTraceability] Error exporting to JSON:', error);
        alert("Erreur lors de l'export JSON: " + error.message);
    }
}

/**
 * Per-month demand vs taken for any consumer need (goods, heat, light…), from house_consumption records
 * tagged with that need's totalKey. Returns the same shape as computeMonthlyDietStats.
 * @param {Array<object>} transactions
 * @param {string} needTotalKey  e.g. 'goods', 'heat', 'light'
 * @param {number} needAmount    per-capita monthly demand (from catalog need.amount)
 * @returns {{ dataByYearMonth: Record<string, object>, years: Set<number> }}
 */
export function computeMonthlyNeedStats(transactions, needTotalKey, needAmount) {
    const dataByYearMonth = {};
    const years = new Set();
    const chronological = [...transactions].sort((a, b) => (a.turn - b.turn) || (new Date(a.date) - new Date(b.date)));

    transactions.forEach(t => { if (t.year !== undefined) years.add(t.year); });

    years.forEach(year => {
        for (let month = 0; month < 12; month++) {
            // Population per house that month (last tick wins)
            const monthPopulation = {};
            chronological
                .filter(t => t.transactionType === 'population_state' && t.year === year && t.month === month)
                .forEach(t => { monthPopulation[t.fromId || t.fromCoords] = t.quantity; });

            // Taken per house for this need
            const houseTaken = {};
            transactions
                .filter(t => t.transactionType === 'house_consumption' && t.foodType === needTotalKey && t.year === year && t.month === month)
                .forEach(t => {
                    const key = t.fromId || t.fromCoords;
                    if (key) houseTaken[key] = (houseTaken[key] || 0) + (t.quantity || 0);
                    // Use recorded pop at consumption time if available
                    if (key && Number.isFinite(t.pop) && key in monthPopulation) monthPopulation[key] = t.pop;
                });

            if (Object.keys(monthPopulation).length === 0 && Object.keys(houseTaken).length === 0) continue;

            let totalDemand = 0, totalTaken = 0;
            const allHouseKeys = new Set([...Object.keys(monthPopulation), ...Object.keys(houseTaken)]);
            allHouseKeys.forEach(key => {
                const pop = monthPopulation[key] ?? 0;
                totalDemand += pop * needAmount;
                totalTaken += Math.min(houseTaken[key] || 0, pop * needAmount);
            });

            if (totalDemand === 0 && totalTaken === 0) continue;
            dataByYearMonth[`${year}-${month}`] = { year, month, totalDemand, totalTaken, deficit: Math.max(0, totalDemand - totalTaken) };
        }
    });
    return { dataByYearMonth, years };
}

const MONTHS_FR_NEED = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Demand/taken/deficit chart for a non-food consumer need.
 * @param {HTMLElement} container
 * @param {Array<object>} transactions
 * @param {string} needTotalKey
 * @param {number} needAmount  per-capita monthly demand
 * @param {string} needLabel
 * @param {number|null} selectedYear
 */
function renderNeedStats(container, transactions, needTotalKey, needAmount, needLabel, selectedYear) {
    const { dataByYearMonth } = computeMonthlyNeedStats(transactions, needTotalKey, needAmount);
    const filtered = Object.values(dataByYearMonth)
        .filter(d => selectedYear === null || d.year === selectedYear)
        .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="no-supply-stats"><div class="no-supply-stats-icon">📊</div><div class="no-supply-stats-text">Aucune donnée de consommation enregistrée pour ce besoin.</div></div>`;
        return;
    }

    const byYear = {};
    filtered.forEach(d => { (byYear[d.year] ??= { year: d.year, months: [] }).months.push(d); });

    let html = '';
    for (const yearData of Object.values(byYear).sort((a, b) => b.year - a.year)) {
        html += `<div class="supply-stats-year-section">
            <div class="supply-stats-year-header"><h4 class="supply-stats-year-title">Année ${yearData.year} — ${needLabel}</h4></div>
            <div class="supply-stats-months">`;
        for (const d of yearData.months) {
            const pct = d.totalDemand > 0 ? Math.round((d.totalTaken / d.totalDemand) * 100) : 100;
            const statusClass = pct >= 100 ? 'fed' : pct >= 50 ? 'partial' : 'unfed';
            html += `<div class="supply-stat-month-card">
                <div class="supply-stat-month-header"><span class="supply-stat-month-name">${MONTHS_FR_NEED[d.month]}</span></div>
                <div class="supply-stat-month-details">
                    <div class="supply-stat-month-item ${statusClass}">
                        <span class="supply-stat-month-icon">${pct >= 100 ? '✅' : pct >= 50 ? '⚠️' : '❌'}</span>
                        <span class="supply-stat-month-label">Livré:</span>
                        <span class="supply-stat-month-value">${d.totalTaken.toFixed(1)} / ${d.totalDemand.toFixed(1)}</span>
                    </div>
                    <div class="supply-stat-month-item ${d.deficit > 0 ? 'unfed' : 'fed'}">
                        <span class="supply-stat-month-icon">${d.deficit > 0 ? '📉' : '✔️'}</span>
                        <span class="supply-stat-month-label">Déficit:</span>
                        <span class="supply-stat-month-value">${d.deficit > 0 ? d.deficit.toFixed(1) + ' unités' : 'Aucun'}</span>
                    </div>
                    <div class="supply-stat-month-item total">
                        <span class="supply-stat-month-icon">📊</span>
                        <span class="supply-stat-month-label">Couverture:</span>
                        <span class="supply-stat-month-value">${pct}%</span>
                    </div>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

/**
 * Per-month production summary for goods that reach a hub but have no distributor (bandwidth, etc.).
 * Shows how much was collected into hubs per month, by producer.
 * @param {HTMLElement} container
 * @param {Array<object>} transactions
 * @param {string} category
 * @param {number|null} selectedYear
 */
function renderProductionStats(container, transactions, category, selectedYear) {
    const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const relevant = transactions.filter(t =>
        t.transactionType === 'source_to_hub' &&
        t.foodType === category &&
        (selectedYear === null || t.year === selectedYear)
    );

    if (relevant.length === 0) {
        container.innerHTML = `<div class="no-supply-stats"><div class="no-supply-stats-icon">📊</div><div class="no-supply-stats-text">Aucune production enregistrée pour ce bien.</div></div>`;
        return;
    }

    const byYear = {};
    for (const t of relevant) {
        const y = t.year ?? 0;
        const m = t.month ?? 0;
        const yData = (byYear[y] ??= {});
        const mData = (yData[m] ??= { producers: new Set(), hubs: new Set(), quantity: 0 });
        if (t.fromId || t.fromCoords) mData.producers.add(t.fromId || t.fromCoords);
        if (t.toId || t.toCoords) mData.hubs.add(t.toId || t.toCoords);
        mData.quantity += (t.quantity ?? 0);
    }

    const categoryLabel = goodLabel(category) || category;
    let html = '';
    for (const [year, months] of Object.entries(byYear).sort(([a], [b]) => b - a)) {
        html += `<div class="supply-stats-year-section">
            <div class="supply-stats-year-header"><h4 class="supply-stats-year-title">Année ${year} — ${categoryLabel}</h4></div>
            <div class="supply-stats-months">`;
        for (let m = 0; m < 12; m++) {
            const d = months[m];
            if (!d) continue;
            html += `<div class="supply-stat-month-card">
                <div class="supply-stat-month-header"><span class="supply-stat-month-name">${MONTHS_FR[m]}</span></div>
                <div class="supply-stat-month-details">
                    <div class="supply-stat-month-item fed">
                        <span class="supply-stat-month-icon">🏭</span>
                        <span class="supply-stat-month-label">Producteurs actifs:</span>
                        <span class="supply-stat-month-value">${d.producers.size}</span>
                    </div>
                    <div class="supply-stat-month-item total">
                        <span class="supply-stat-month-icon">🏛️</span>
                        <span class="supply-stat-month-label">Entrepôts destinataires:</span>
                        <span class="supply-stat-month-value">${d.hubs.size}</span>
                    </div>
                    <div class="supply-stat-month-item total">
                        <span class="supply-stat-month-icon">📦</span>
                        <span class="supply-stat-month-label">Quantité collectée:</span>
                        <span class="supply-stat-month-value">${d.quantity}</span>
                    </div>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

/**
 * Per-month delivery count for a non-food category, from distributor_to_consumer transactions.
 * Shows how many consumer buildings received the good, and how many unique distributors served them.
 * @param {HTMLElement} container
 * @param {Array<object>} transactions
 * @param {string} category
 * @param {number|null} selectedYear
 */
function renderDeliveryStats(container, transactions, category, selectedYear) {
    const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const relevant = transactions.filter(t =>
        t.transactionType === 'distributor_to_consumer' &&
        t.foodType === category &&
        (selectedYear === null || t.year === selectedYear)
    );

    if (relevant.length === 0) {
        container.innerHTML = `<div class="no-supply-stats"><div class="no-supply-stats-icon">📊</div><div class="no-supply-stats-text">Aucune livraison enregistrée pour ce besoin.</div></div>`;
        return;
    }

    // Group by year then month
    const byYear = {};
    for (const t of relevant) {
        const y = t.year ?? 0;
        const m = t.month ?? 0;
        const yData = (byYear[y] ??= {});
        const mData = (yData[m] ??= { consumers: new Set(), distributors: new Set(), deliveries: 0 });
        if (t.toId || t.toCoords) mData.consumers.add(t.toId || t.toCoords);
        if (t.fromId || t.fromCoords) mData.distributors.add(t.fromId || t.fromCoords);
        mData.deliveries += (t.quantity ?? 1);
    }

    const categoryLabel = goodLabel(category) || category;
    let html = '';
    for (const [year, months] of Object.entries(byYear).sort(([a], [b]) => b - a)) {
        html += `<div class="supply-stats-year-section">
            <div class="supply-stats-year-header"><h4 class="supply-stats-year-title">Année ${year} — ${categoryLabel}</h4></div>
            <div class="supply-stats-months">`;
        for (let m = 0; m < 12; m++) {
            const d = months[m];
            if (!d) continue;
            html += `<div class="supply-stat-month-card">
                <div class="supply-stat-month-header"><span class="supply-stat-month-name">${MONTHS_FR[m]}</span></div>
                <div class="supply-stat-month-details">
                    <div class="supply-stat-month-item fed">
                        <span class="supply-stat-month-icon">✅</span>
                        <span class="supply-stat-month-label">Servis:</span>
                        <span class="supply-stat-month-value">${d.consumers.size}</span>
                    </div>
                    <div class="supply-stat-month-item total">
                        <span class="supply-stat-month-icon">🏛️</span>
                        <span class="supply-stat-month-label">Bâtiments sources:</span>
                        <span class="supply-stat-month-value">${d.distributors.size}</span>
                    </div>
                    <div class="supply-stat-month-item total">
                        <span class="supply-stat-month-icon">📦</span>
                        <span class="supply-stat-month-label">Quantité livrée:</span>
                        <span class="supply-stat-month-value">${d.deliveries}</span>
                    </div>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

/**
 * Charge et affiche les statistiques de satisfaction (anciennement "graphiques alimentaires").
 */
export async function loadSatisfactionCharts() {
    const container = document.getElementById('supply-stats-container');
    const yearSelect = document.getElementById('supply-charts-year-select');
    const pillsContainer = document.getElementById('supply-charts-category-pills');

    if (!container || !yearSelect) return;

    container.innerHTML = `
        <div class="supply-stats-loading">
            <div class="loading-spinner"></div>
            <p>Chargement des statistiques...</p>
        </div>
    `;

    try {
        const transactions = await deps.supply.getAllSupplyTraceabilityTransactions(null, requireActiveHamletId());
        satisfactionCache = { transactions };

        // Categories that have any transaction in the log
        const categoriesInLog = new Set(
            transactions
                .filter(t => t.foodType && t.transactionType !== 'population_state' && t.transactionType !== 'building_state' && t.transactionType !== 'employment_summary')
                .map(t => t.foodType)
        );

        // Pills: one per declared consumer need that has data in the log
        const consumerNeeds = listQuantityConsumerNeeds();
        const pillEntries = consumerNeeds
            .filter(need => need.categories.some(cat => categoriesInLog.has(cat)))
            .map(need => ({ key: need.totalKey, label: goodLabel(need.totalKey) || need.totalKey, categories: need.categories }));

        // Migrate old raw-good state → need totalKey
        if (activeChartCategory !== null && !pillEntries.some(e => e.key === activeChartCategory)) {
            const matchingNeed = pillEntries.find(e => e.categories?.includes(activeChartCategory));
            activeChartCategory = matchingNeed?.key ?? pillEntries[0]?.key ?? null;
        }
        if (activeChartCategory === null && pillEntries.length > 0) {
            activeChartCategory = pillEntries[0].key;
        }

        // Build pills — clicking only re-renders the chart, no full reload
        if (pillsContainer) {
            pillsContainer.innerHTML = pillEntries.map(({ key, label }) =>
                `<button class="supply-traceability-category-pill${activeChartCategory === key ? ' active' : ''}" data-category="${key}">${label}</button>`
            ).join('');
            pillsContainer.querySelectorAll('.supply-traceability-category-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    activeChartCategory = btn.dataset.category || null;
                    // Update active class without rebuilding pills
                    pillsContainer.querySelectorAll('.supply-traceability-category-pill').forEach(b =>
                        b.classList.toggle('active', b.dataset.category === activeChartCategory)
                    );
                    renderSatisfactionChart();
                });
            });
        }

        // Populate year selector
        const allYears = new Set(
            transactions
                .filter(t => t.transactionType === 'distributor_to_consumer' || t.transactionType === 'house_consumption')
                .map(t => t.year)
        );
        const previousYear = yearSelect.value;
        yearSelect.innerHTML = '<option value="all">Toutes les années</option>';
        Array.from(allYears).sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year.toString();
            yearSelect.appendChild(option);
        });
        if (previousYear && previousYear !== 'all' && allYears.has(parseInt(previousYear))) {
            yearSelect.value = previousYear;
        }

        renderSatisfactionChart();

    } catch (error) {
        console.error('Error loading supply statistics:', error);
        container.innerHTML = `
            <div class="no-supply-stats">
                <div class="no-supply-stats-icon">❌</div>
                <div class="no-supply-stats-text">Erreur lors du chargement: ${error.message}</div>
            </div>
        `;
    }
}

/**
 * Renders only the chart area of the Satisfaction tab, using cached transactions.
 * Called on year change or pill click — no fetch, no pill rebuild.
 */
async function renderSatisfactionChart() {
    const container = document.getElementById('supply-stats-container');
    const yearSelect = document.getElementById('supply-charts-year-select');
    if (!container || !yearSelect || !satisfactionCache) return;

    const { transactions } = satisfactionCache;
    const selectedYear = yearSelect.value === 'all' ? null : parseInt(yearSelect.value);
    const consumerNeeds = listQuantityConsumerNeeds();

    if (!activeChartCategory) {
        container.innerHTML = `<div class="no-supply-stats"><div class="no-supply-stats-icon">📊</div><div class="no-supply-stats-text">Aucune donnée disponible</div></div>`;
        return;
    }

    const selectedNeed = consumerNeeds.find(n => n.totalKey === activeChartCategory);
    const needCategories = selectedNeed?.categories ?? [];
    const isFoodNeed = activeChartCategory === chainTotalKey;

    // Demand banner for non-food needs
    container.innerHTML = '';
    if (!isFoodNeed && selectedNeed?.amount > 0) {
        const allBuildings = await deps.supply.listSupplyStockSnapshots();
        const totalPop = allBuildings.filter(b => b.kind === 'house').reduce((sum, b) => sum + (b.pop ?? 0), 0);
        const monthlyDemand = totalPop * selectedNeed.amount;
        const annualDemand = monthlyDemand * 12;
        const needLabel = goodLabel(activeChartCategory) || activeChartCategory;
        const banner = document.createElement('div');
        banner.className = 'supply-need-demand-banner';
        banner.innerHTML = `
            <span class="supply-need-demand-label">Besoin actuel de la ville :</span>
            <span class="supply-need-demand-value">${monthlyDemand % 1 === 0 ? monthlyDemand : monthlyDemand.toFixed(1)} unités de <strong>${needLabel}</strong> / mois</span>
            <span class="supply-need-demand-annual">(${annualDemand % 1 === 0 ? annualDemand : annualDemand.toFixed(0)} / an — pour ${totalPop} habitants)</span>
        `;
        container.appendChild(banner);
    }

    if (isFoodNeed) {
        const allHouses = (await deps.supply.listSupplyStockSnapshots()).filter(
            (b) => b.kind === 'house' || (b.type && (b.type.includes('House') || b.type.includes('Maison')))
        );
        const { dataByYearMonth } = computeMonthlyDietStats(transactions, allHouses);
        const filteredData = Object.values(dataByYearMonth)
            .filter(d => selectedYear === null || d.year === selectedYear)
            .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
        if (filteredData.length === 0) {
            container.innerHTML = `<div class="no-supply-stats"><div class="no-supply-stats-icon">📊</div><div class="no-supply-stats-text">Aucune donnée disponible</div></div>`;
            return;
        }
        const dataByYear = {};
        filteredData.forEach(d => { (dataByYear[d.year] ??= { year: d.year, months: [] }).months.push(d); });
        Object.values(dataByYear).forEach(yearData => { yearData.chain = summarizeChain(transactions, yearData.year); });
        renderDietStats(container, dataByYear);
    } else {
        const hasConsumptionLog = transactions.some(t =>
            t.transactionType === 'house_consumption' && t.foodType === activeChartCategory
        );
        if (hasConsumptionLog) {
            renderNeedStats(container, transactions, activeChartCategory, selectedNeed.amount, goodLabel(activeChartCategory) || activeChartCategory, selectedYear);
        } else {
            const hasDeliveries = transactions.some(t =>
                t.transactionType === 'distributor_to_consumer' && needCategories.includes(t.foodType)
            );
            if (hasDeliveries) {
                for (const cat of needCategories.filter(cat => transactions.some(t => t.transactionType === 'distributor_to_consumer' && t.foodType === cat))) {
                    const section = document.createElement('div');
                    container.appendChild(section);
                    renderDeliveryStats(section, transactions, cat, selectedYear);
                }
            } else {
                for (const cat of needCategories.filter(cat => transactions.some(t => t.transactionType === 'source_to_hub' && t.foodType === cat))) {
                    const section = document.createElement('div');
                    container.appendChild(section);
                    renderProductionStats(section, transactions, cat, selectedYear);
                }
            }
        }
    }
}

