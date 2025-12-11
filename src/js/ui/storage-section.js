import config from '../game/config.js';

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
        // No automatic refresh - data is read directly from IndexedDB when panel opens
        // Just like info panel, it shows current state at that moment
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event listeners will be added dynamically when windmills are rendered
    }
    
    /**
     * Load all windmills from IndexedDB
     */
    async loadWindmills() {
        if (!this.housesStore) {
            // Try to get housesStore from window
            if (window.app && window.app.housesStore) {
                this.housesStore = window.app.housesStore;
            } else if (window.housesStore) {
                this.housesStore = window.housesStore;
            } else if (window.game && window.game.housesStore) {
                this.housesStore = window.game.housesStore;
            } else {
                console.warn('[StorageSection] housesStore not available');
                return;
            }
        }
        
        try {
            const allHouses = await this.housesStore.listAllHouses();
            this.windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
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
        const maxStock = windmill.maxStock || 1000; // Default max stock (total capacity)
        const isActive = windmill.isActive !== false; // Default to true
        const distributionEnabled = windmill.distributionEnabled !== false; // Default to true
        const commercializeEnabled = windmill.commercializeEnabled !== false; // Default to true
        const distributionMonth = windmill.distributionMonth || 9; // Default to October (month 9)
        const sellAmounts = windmill.sellAmounts || { wheat: 0, carrot: 0, cabbage: 0 };
        const lastImportDetails = windmill.lastImportDetails || {};

        // Build imports by partner HTML
        let importsByPartnerHTML = '';
        if (Object.keys(lastImportDetails).length > 0) {
            const productNames = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou', dattes: 'Dattes' };
            importsByPartnerHTML = '<div class="storage-imports-by-partner"><h4 class="storage-subtitle">Imports par partenaire</h4>';

            for (const [productId, partners] of Object.entries(lastImportDetails)) {
                if (partners && partners.length > 0) {
                    const productName = productNames[productId] || productId;
                    partners.forEach(partnerInfo => {
                        importsByPartnerHTML += `
                            <div class="storage-import-item">
                                <label>${productName} depuis ${partnerInfo.partnerName}:</label>
                                <span class="storage-import-value">+${partnerInfo.quantity} paniers</span>
                            </div>
                        `;
                    });
                }
            }

            importsByPartnerHTML += '</div>';
        }

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
                </div>
                <div class="storage-stock-item">
                    <label>Chou:</label>
                    <span class="storage-stock-value">${stocks.cabbage || 0} / ${maxStock}</span>
                </div>
                <div class="storage-stock-item">
                    <label>Carotte:</label>
                    <span class="storage-stock-value">${stocks.carrot || 0} / ${maxStock}</span>
                </div>
                <div class="storage-stock-item">
                    <label>Dattes:</label>
                    <span class="storage-stock-value">${stocks.dattes || 0} / ${maxStock}</span>
                </div>
                <div class="storage-stock-item">
                    <label>Total:</label>
                    <span class="storage-stock-value">${stocks.food || 0} / <input type="number" class="storage-max-input" data-windmill="${windmill.name}" value="${maxStock}" min="0" step="10"></span>
                </div>
            </div>

            ${importsByPartnerHTML}

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
            
            <div class="storage-windmill-sell ${!commercializeEnabled ? 'storage-sell-disabled' : ''}">
                <h4 class="storage-subtitle">Quantités de vente</h4>
                <div class="storage-sell-item">
                    <label>Blé:</label>
                    <input type="number" class="storage-sell-input" data-windmill="${windmill.name}" data-type="wheat" value="${sellAmounts.wheat || 0}" min="0" step="1" ${!commercializeEnabled ? 'disabled' : ''}>
                </div>
                <div class="storage-sell-item">
                    <label>Légumes verts:</label>
                    <input type="number" class="storage-sell-input" data-windmill="${windmill.name}" data-type="cabbage" value="${sellAmounts.cabbage || 0}" min="0" step="1" ${!commercializeEnabled ? 'disabled' : ''}>
                </div>
                <div class="storage-sell-item">
                    <label>Autres légumes:</label>
                    <input type="number" class="storage-sell-input" data-windmill="${windmill.name}" data-type="carrot" value="${sellAmounts.carrot || 0}" min="0" step="1" ${!commercializeEnabled ? 'disabled' : ''}>
                </div>
            </div>
        `;
        
        // Add event listeners to this card
        this.attachEventListeners(card, windmill);
        
        // Set initial state of sell inputs based on commercializeEnabled
        this.updateSellInputsState(card, commercializeEnabled);
        
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
        const maxInput = card.querySelector('.storage-max-input');
        if (maxInput) {
            maxInput.addEventListener('change', async (e) => {
                const maxValue = parseInt(e.target.value) || 0;
                await this.updateWindmillSetting(windmillId, 'maxStock', maxValue);
                // Update display to show new max for all products
                const stockItems = card.querySelectorAll('.storage-stock-item');
                stockItems.forEach((item, index) => {
                    if (index < 3) { // First 3 items (wheat, cabbage, carrot)
                        const valueSpan = item.querySelector('.storage-stock-value');
                        if (valueSpan) {
                            const currentAmount = valueSpan.textContent.split(' / ')[0];
                            valueSpan.textContent = `${currentAmount} / ${maxValue}`;
                        }
                    }
                });
            });
        }
        
        // Toggle switches
        const toggles = card.querySelectorAll('.storage-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.checked;
                await this.updateWindmillSetting(windmillId, setting, value);
                
                // If commercialize toggle changed, update sell inputs state
                if (setting === 'commercializeEnabled') {
                    this.updateSellInputsState(card, value);
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
        
        // Sell amount inputs
        const sellInputs = card.querySelectorAll('.storage-sell-input');
        sellInputs.forEach(input => {
            input.addEventListener('change', async (e) => {
                const type = e.target.dataset.type;
                const amount = parseInt(e.target.value) || 0;
                
                // Get current sellAmounts or create new
                const windmill = this.windmills.find(w => w.name === windmillId);
                const currentSellAmounts = windmill?.sellAmounts || { wheat: 0, carrot: 0, cabbage: 0 };
                
                // Update specific type
                const newSellAmounts = {
                    ...currentSellAmounts,
                    [type]: amount
                };
                
                await this.updateWindmillSetting(windmillId, 'sellAmounts', newSellAmounts);
            });
        });
    }
    
    /**
     * Update sell inputs state based on commercialize toggle
     * @param {HTMLElement} card - Windmill card element
     * @param {boolean} enabled - Whether commercialize is enabled
     */
    updateSellInputsState(card, enabled) {
        const sellSection = card.querySelector('.storage-windmill-sell');
        const sellInputs = card.querySelectorAll('.storage-sell-input');
        
        if (sellSection) {
            if (enabled) {
                sellSection.classList.remove('storage-sell-disabled');
            } else {
                sellSection.classList.add('storage-sell-disabled');
            }
        }
        
        sellInputs.forEach(input => {
            input.disabled = !enabled;
        });
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
            
            console.log('[StorageSection] Updated windmill setting:', {
                windmillId,
                setting,
                value
            });
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

