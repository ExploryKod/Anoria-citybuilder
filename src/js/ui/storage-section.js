import config from '../game/config.js';
import { getOrCreateSupplyContext } from '../acl/supply.js';

/**
 * StorageSectionManager - Manages the Storage Units (Unités de Stock) section
 * Displays and manages all windmills with their stocks, settings, and distribution
 */
class StorageSectionManager {
    constructor() {
        this.windmills = [];
        this.housesStore = null;
    }
    
    /**
     * Set the housesStore reference
     * @param {HousesStore} housesStore - Database store
     */
    setHousesStore(housesStore) {
        this.housesStore = housesStore;
    }
    
    /**
     * Initialize the storage section
     */
    async init() {
        this.setupEventListeners();
        await this.loadWindmills();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event listeners will be added dynamically when windmills are rendered
    }

    #resolveHousesStore() {
        if (this.housesStore) return this.housesStore;
        if (window.app && window.app.housesStore) return window.app.housesStore;
        if (window.housesStore) return window.housesStore;
        if (window.game && window.game.housesStore) return window.game.housesStore;
        return null;
    }
    
    /**
     * Load all windmills — Supply stocks via BC; settings/employees via Dexie (commerce/UI).
     */
    async loadWindmills() {
        this.housesStore = this.#resolveHousesStore();
        if (!this.housesStore) {
            console.warn('[StorageSection] housesStore not available');
            return;
        }
        
        try {
            const supply = getOrCreateSupplyContext(this.housesStore);
            const supplyViews = await supply.listWindmillSupplyViews();

            this.windmills = [];
            for (const view of supplyViews) {
                const raw = await this.housesStore.getHouse(view.buildingId);
                this.windmills.push({
                    ...(raw || {}),
                    name: view.buildingId,
                    id: view.buildingId,
                    type: view.type,
                    x: view.x,
                    y: view.y,
                    stocks: view.stocks,
                    maxStock: view.maxStock,
                    lastImportDetails: view.lastImportDetails || raw?.lastImportDetails || {},
                    lastExportDetails: raw?.lastExportDetails || {},
                    employees: raw?.employees,
                    isActive: raw?.isActive,
                    distributionEnabled: raw?.distributionEnabled,
                    commercializeEnabled: raw?.commercializeEnabled,
                    distributionMonth: raw?.distributionMonth,
                });
            }
            
            this.render();
        } catch (error) {
            console.error('[StorageSection] Error loading windmills:', error);
        }
    }
    
    /**
     * Render all windmills
     */
    render() {
        const windmillsList = document.getElementById('storage-windmills-list');
        if (!windmillsList) return;
        
        if (this.windmills.length === 0) {
            windmillsList.innerHTML = '<div class="storage-empty">Aucun moulin construit</div>';
            return;
        }
        
        windmillsList.innerHTML = '';
        
        this.windmills.forEach(windmill => {
            const windmillCard = this.createWindmillCard(windmill);
            windmillsList.appendChild(windmillCard);
        });
    }
    
    /**
     * Create a windmill card with all controls
     * @param {Object} windmill - Windmill data from IndexedDB
     * @returns {HTMLElement} Windmill card element
     */
    createWindmillCard(windmill) {
        const card = document.createElement('div');
        card.className = 'storage-windmill-card';
        card.dataset.windmillId = windmill.name;
        
        const stocks = windmill.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0, dattes: 0 };
        const maxStock = windmill.maxStock || 1000;
        const isActive = windmill.isActive !== false; // Default to true
        const distributionEnabled = windmill.distributionEnabled !== false; // Default to true
        const commercializeEnabled = windmill.commercializeEnabled !== false; // Default to true
        const distributionMonth = windmill.distributionMonth || 9; // Default to October (month 9)
        const lastImportDetails = windmill.lastImportDetails || {};
        const lastExportDetails = windmill.lastExportDetails || {};

        // Helper function to calculate total imports/exports for a product
        const getTotalImports = (productId) => {
            const partners = lastImportDetails[productId] || [];
            return partners.reduce((sum, p) => sum + (p.quantity || 0), 0);
        };

        const getTotalExports = (productId) => {
            const partners = lastExportDetails[productId] || [];
            return partners.reduce((sum, p) => sum + (p.quantity || 0), 0);
        };

        // Helper function to build partner details HTML
        const buildPartnerDetailsHTML = (productId, partners, type) => {
            if (!partners || partners.length === 0) return '';
            const productNames = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou', dattes: 'Dattes', wood: 'Bois' };
            const productName = productNames[productId] || productId;
            let html = '';
            partners.forEach(partnerInfo => {
                html += `
                    <div class="storage-partner-detail">
                        <span class="storage-partner-name">${partnerInfo.partnerName}:</span>
                        <span class="storage-partner-quantity">${type === 'import' ? '+' : '-'}${partnerInfo.quantity} paniers</span>
                    </div>
                `;
            });
            return html;
        };

        card.innerHTML = `
            <div class="storage-windmill-header">
                <div class="storage-windmill-id">
                    <strong>Moulin ID:</strong> ${windmill.name}
                </div>
                <div class="storage-windmill-location">
                    Position: x: ${windmill.x || 0} | y: ${windmill.y || 0}
                </div>
            </div>

            <div class="storage-windmill-stocks">
                <h4 class="storage-subtitle">Stocks</h4>
                <div class="storage-stock-item">
                    <label>Blé:</label>
                    <span class="storage-stock-value">${stocks.wheat || 0} / ${maxStock}</span>
                    <div class="storage-trade-info">
                        <span class="storage-export-info">Exportés: ${getTotalExports('wheat')}</span>
                        <span class="storage-import-info">Importés: ${getTotalImports('wheat')}</span>
                    </div>
                    <div class="storage-partner-details">
                        ${buildPartnerDetailsHTML('wheat', lastExportDetails['wheat'], 'export')}
                        ${buildPartnerDetailsHTML('wheat', lastImportDetails['wheat'], 'import')}
                    </div>
                </div>
                <div class="storage-stock-item">
                    <label>Chou:</label>
                    <span class="storage-stock-value">${stocks.cabbage || 0} / ${maxStock}</span>
                    <div class="storage-trade-info">
                        <span class="storage-export-info">Exportés: ${getTotalExports('cabbage')}</span>
                        <span class="storage-import-info">Importés: ${getTotalImports('cabbage')}</span>
                    </div>
                    <div class="storage-partner-details">
                        ${buildPartnerDetailsHTML('cabbage', lastExportDetails['cabbage'], 'export')}
                        ${buildPartnerDetailsHTML('cabbage', lastImportDetails['cabbage'], 'import')}
                    </div>
                </div>
                <div class="storage-stock-item">
                    <label>Carotte:</label>
                    <span class="storage-stock-value">${stocks.carrot || 0} / ${maxStock}</span>
                    <div class="storage-trade-info">
                        <span class="storage-export-info">Exportés: ${getTotalExports('carrot')}</span>
                        <span class="storage-import-info">Importés: ${getTotalImports('carrot')}</span>
                    </div>
                    <div class="storage-partner-details">
                        ${buildPartnerDetailsHTML('carrot', lastExportDetails['carrot'], 'export')}
                        ${buildPartnerDetailsHTML('carrot', lastImportDetails['carrot'], 'import')}
                    </div>
                </div>
                <div class="storage-stock-item">
                    <label>Dattes:</label>
                    <span class="storage-stock-value">${stocks.dattes || 0} / ${maxStock}</span>
                    <div class="storage-trade-info">
                        <span class="storage-export-info">Exportés: ${getTotalExports('dattes')}</span>
                        <span class="storage-import-info">Importés: ${getTotalImports('dattes')}</span>
                    </div>
                    <div class="storage-partner-details">
                        ${buildPartnerDetailsHTML('dattes', lastExportDetails['dattes'], 'export')}
                        ${buildPartnerDetailsHTML('dattes', lastImportDetails['dattes'], 'import')}
                    </div>
                </div>
                <div class="storage-stock-item">
                    <label>Bois:</label>
                    <span class="storage-stock-value">${stocks.wood || 0} / ${maxStock}</span>
                    <div class="storage-trade-info">
                        <span class="storage-export-info">Exportés: ${getTotalExports('wood')}</span>
                        <span class="storage-import-info">Importés: ${getTotalImports('wood')}</span>
                    </div>
                    <div class="storage-partner-details">
                        ${buildPartnerDetailsHTML('wood', lastExportDetails['wood'], 'export')}
                        ${buildPartnerDetailsHTML('wood', lastImportDetails['wood'], 'import')}
                    </div>
                </div>
            </div>

            <div class="storage-windmill-controls">
                <div class="storage-control-item">
                    <label class="storage-toggle-label">
                        <input type="checkbox" class="storage-toggle" data-windmill="${windmill.name}" data-setting="isActive" ${isActive ? 'checked' : ''}>
                        <span>Moulin actif</span>
                    </label>
                </div>
                
                <div class="storage-control-item">
                    <label class="storage-toggle-label">
                        <input type="checkbox" class="storage-toggle" data-windmill="${windmill.name}" data-setting="distributionEnabled" ${distributionEnabled ? 'checked' : ''}>
                        <span>Distribuer les stocks</span>
                    </label>
                </div>
                
                <div class="storage-control-item">
                    <label class="storage-toggle-label">
                        <input type="checkbox" class="storage-toggle" data-windmill="${windmill.name}" data-setting="commercializeEnabled" ${commercializeEnabled ? 'checked' : ''}>
                        <span>Commercialiser</span>
                    </label>
                </div>
                
                <div class="storage-control-item">
                    <label>Période de distribution:</label>
                    <select class="storage-month-select" data-windmill="${windmill.name}" data-setting="distributionMonth">
                        <option value="0" ${distributionMonth === 0 ? 'selected' : ''}>Janvier</option>
                        <option value="1" ${distributionMonth === 1 ? 'selected' : ''}>Février</option>
                        <option value="2" ${distributionMonth === 2 ? 'selected' : ''}>Mars</option>
                        <option value="3" ${distributionMonth === 3 ? 'selected' : ''}>Avril</option>
                        <option value="4" ${distributionMonth === 4 ? 'selected' : ''}>Mai</option>
                        <option value="5" ${distributionMonth === 5 ? 'selected' : ''}>Juin</option>
                        <option value="6" ${distributionMonth === 6 ? 'selected' : ''}>Juillet</option>
                        <option value="7" ${distributionMonth === 7 ? 'selected' : ''}>Août</option>
                        <option value="8" ${distributionMonth === 8 ? 'selected' : ''}>Septembre</option>
                        <option value="9" ${distributionMonth === 9 ? 'selected' : ''}>Octobre</option>
                        <option value="10" ${distributionMonth === 10 ? 'selected' : ''}>Novembre</option>
                        <option value="11" ${distributionMonth === 11 ? 'selected' : ''}>Décembre</option>
                    </select>
                </div>
            </div>
            
            <div class="storage-windmill-employees">
                <h4 class="storage-subtitle">Employés</h4>
                ${windmill.employees ? `
                    <div class="storage-employee-item">
                        <label>Ouvriers:</label>
                        <span class="storage-employee-value">${windmill.employees.worker || 0} / ${windmill.employees.worker_need || 0}</span>
                    </div>
                    <div class="storage-employee-item">
                        <label>Élites:</label>
                        <span class="storage-employee-value">${windmill.employees.elite || 0} / ${windmill.employees.elite_need || 0}</span>
                    </div>
                    <div class="storage-employee-status">
                        ${(windmill.employees.worker || 0) >= (windmill.employees.worker_need || 0) && 
                          (windmill.employees.elite || 0) >= (windmill.employees.elite_need || 0) 
                            ? '<span class="storage-status-success">✅ Le moulin a tout ce qu\'il faut pour fonctionner</span>'
                            : '<span class="storage-status-warning">⚠️ Le moulin ne peut fonctionner à sa pleine capacité</span>'}
                    </div>
                ` : '<div class="storage-employee-status">Aucune donnée d\'employés</div>'}
            </div>
        `;
        
        // Add event listeners to this card
        this.attachEventListeners(card, windmill);
        
        return card;
    }
    
    /**
     * Attach event listeners to a windmill card
     * @param {HTMLElement} card - Windmill card element
     * @param {Object} windmill - Windmill data
     */
    attachEventListeners(card, windmill) {
        const windmillId = windmill.name;
        
        // Max stock input (single input for total capacity)
        // Toggle switches
        const toggles = card.querySelectorAll('.storage-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.checked;
                await this.updateWindmillSetting(windmillId, setting, value);
                
                // If commercialize or isActive toggle changed, notify commerce service
                if (setting === 'commercializeEnabled' || setting === 'isActive') {
                    // The commerce service will check these settings when processing trades
                }
            });
        });
        
        // Month select
        const monthSelect = card.querySelector('.storage-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', async (e) => {
                const month = parseInt(e.target.value) || 9;
                await this.updateWindmillSetting(windmillId, 'distributionMonth', month);
            });
        }
    }
    
    /**
     * Update a windmill setting in IndexedDB
     * @param {string} windmillId - Windmill ID
     * @param {string} setting - Setting name
     * @param {*} value - Setting value
     */
    async updateWindmillSetting(windmillId, setting, value) {
        if (!this.housesStore) {
            console.warn('[StorageSection] Cannot update: housesStore not available');
            return;
        }
        
        try {
            await this.housesStore.updateHouseFields(windmillId, {
                [setting]: value
            });
            
            // Update local data
            const windmill = this.windmills.find(w => w.name === windmillId);
            if (windmill) {
                windmill[setting] = value;
            }
        } catch (error) {
            console.error('[StorageSection] Error updating windmill setting:', {
                windmillId,
                setting,
                error: error?.message || error
            });
        }
    }
    
    /**
     * Refresh windmill data and re-render
     */
    async refresh() {
        await this.loadWindmills();
    }
}

/**
 * Initialize the storage section
 */
function initStorageSection() {
    const storageSection = document.getElementById('admin-section-storage');
    if (!storageSection) return;
    
    const manager = new StorageSectionManager();
    
    // Try to get housesStore
    if (window.app && window.app.housesStore) {
        manager.setHousesStore(window.app.housesStore);
    } else if (window.housesStore) {
        manager.setHousesStore(window.housesStore);
    } else if (window.game && window.game.housesStore) {
        manager.setHousesStore(window.game.housesStore);
    }
    
    // Initialize when section becomes active
    const observer = new MutationObserver(() => {
        if (storageSection.classList.contains('active')) {
            // Refresh data when section becomes active
            manager.refresh();
        }
    });
    
    observer.observe(storageSection, { attributes: true, attributeFilter: ['class'] });
    
    // If already active, initialize immediately
    if (storageSection.classList.contains('active')) {
        manager.init();
    }
    
    // Make manager available globally
    window.storageSectionManager = manager;
    
    // Try to set housesStore from game if available
    const checkHousesStore = setInterval(() => {
        if (window.app && window.app.housesStore) {
            manager.setHousesStore(window.app.housesStore);
            clearInterval(checkHousesStore);
        } else if (window.housesStore) {
            manager.setHousesStore(window.housesStore);
            clearInterval(checkHousesStore);
        } else if (window.game && window.game.housesStore) {
            manager.setHousesStore(window.game.housesStore);
            clearInterval(checkHousesStore);
        }
    }, 100);
    
    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(checkHousesStore), 5000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStorageSection);
} else {
    initStorageSection();
}

