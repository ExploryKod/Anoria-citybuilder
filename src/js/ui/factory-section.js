import config from '../game/config.js';

class FactorySectionManager {
    constructor() {
        this.factories = [];
        this.housesStore = null;
    }
    
    setHousesStore(housesStore) {
        this.housesStore = housesStore;
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadFactories();
    }
    
    setupEventListeners() {
        const refreshBtn = document.getElementById('factory-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }
    }
    
    async loadFactories() {
        if (!this.housesStore) {
            if (window.app && window.app.housesStore) {
                this.housesStore = window.app.housesStore;
            } else if (window.housesStore) {
                this.housesStore = window.housesStore;
            } else if (window.game && window.game.housesStore) {
                this.housesStore = window.game.housesStore;
            } else {
                return;
            }
        }
        
        try {
            const allHouses = await this.housesStore.listAllHouses();
            this.factories = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Winery-001');
            });
            
            this.render();
        } catch (error) {
            // Error handling
        }
    }
    
    render() {
        const factoriesList = document.getElementById('factory-factories-list');
        if (!factoriesList) return;
        
        if (this.factories.length === 0) {
            factoriesList.innerHTML = '<div class="factory-empty">Aucune usine construite</div>';
            return;
        }
        
        factoriesList.innerHTML = '';
        
        this.factories.forEach(factory => {
            const factoryCard = this.createFactoryCard(factory);
            factoriesList.appendChild(factoryCard);
        });
    }
    
    createFactoryCard(factory) {
        const card = document.createElement('div');
        card.className = 'factory-card';
        card.dataset.factoryId = factory.name;
        
        const rawMaterials = factory.rawMaterials || {};
        const products = factory.products || {};
        const exports = factory.exports || {};
        const imports = factory.imports || {};
        const keepInStock = factory.keepInStock !== false;
        const factoryEmployees = factory.factoryEmployees || {};
        const employees = factory.employees || { worker: 0, worker_need: 0 };

        const rawMaterialNames = {
            wood: 'Bois',
            stone: 'Pierre',
            clay: 'Argile',
            iron: 'Fer',
            gold: 'Or'
        };

        const productNames = {
            furniture: 'Meubles',
            weapons: 'Armes',
            pottery: 'Poteries',
            jewelry: 'Bijoux'
        };

        const employeeTypeNames = {
            bucheron: 'Bûcheron',
            mineur: 'Mineur',
            creuseur: 'Creuseur',
            menuisier: 'Menuisier',
            armurier: 'Armurier',
            potier: 'Potier',
            bijoutier: 'Bijoutier'
        };

        const getMaxStorage = (type) => {
            return config.factoryMaxStorage?.[type] || 200;
        };

        const getEmployeeNeed = (type) => {
            return config.factoryEmployeeNeeds?.[type]?.worker_need || 2;
        };

        const getEmployeeType = (type) => {
            return config.factoryEmployeeNeeds?.[type]?.type || 'worker';
        };

        const getEmployeesForResource = (resourceType) => {
            const employeeType = getEmployeeType(resourceType);
            const emp = factoryEmployees[employeeType];
            if (emp) {
                return emp;
            }
            const singleNeed = getEmployeeNeed(resourceType);
            return { worker: 0, worker_need: singleNeed };
        };

        const getProductionStatus = (resourceType, isProduct = false) => {
            const employeeType = getEmployeeType(resourceType);
            const emp = factoryEmployees[employeeType];
            const singleNeed = getEmployeeNeed(resourceType);
            const workerNeed = emp?.worker_need || singleNeed;
            const worker = emp?.worker || 0;
            
            if (workerNeed === 0) return { status: 'full', max: getMaxStorage(resourceType) };
            
            const percentage = workerNeed > 0 ? (worker / workerNeed) : 1;
            const maxStorage = getMaxStorage(resourceType);
            const effectiveMax = Math.floor(maxStorage * percentage);
            
            if (percentage >= 1) {
                return { status: 'full', max: maxStorage, percentage: 100 };
            } else {
                return { status: 'reduced', max: effectiveMax, percentage: Math.floor(percentage * 100) };
            }
        };

        const getTotalExports = (productType) => {
            return exports[productType] || 0;
        };

        const getTotalImports = (materialType) => {
            return imports[materialType] || 0;
        };

        card.innerHTML = `
            <div class="factory-header">
                <div class="factory-id">
                    <strong>Usine ID:</strong> ${factory.name}
                </div>
                <div class="factory-location">
                    Position: x: ${factory.x || 0} | y: ${factory.y || 0}
                </div>
            </div>

            <div class="factory-raw-materials">
                <h4 class="factory-subtitle">Matières Premières</h4>
                ${Object.entries(rawMaterialNames).map(([key, name]) => {
                    const status = getProductionStatus(key, false);
                    const emp = getEmployeesForResource(key);
                    const employeeType = getEmployeeType(key);
                    const employeeTypeName = employeeTypeNames[employeeType] || employeeType;
                    const statusClass = status.status === 'full' ? 'factory-status-full' : 'factory-status-reduced';
                    const statusText = status.status === 'full' 
                        ? '<span class="factory-status-full">✓ Production à son maximum</span>'
                        : `<span class="factory-status-reduced">⚠ Production réduite (${status.percentage}%)</span>`;
                    
                    return `
                    <div class="factory-stock-item">
                        <div class="factory-stock-item-row">
                            <label>${name}:</label>
                            <span class="factory-stock-value">${rawMaterials[key] || 0} / ${status.max}</span>
                        </div>
                        <div class="factory-employee-info">
                            <span class="factory-employee-label">${employeeTypeName}:</span>
                            <span class="factory-employee-value">${emp.worker || 0} / ${emp.worker_need || 2}</span>
                        </div>
                        <div class="factory-production-status ${statusClass}">
                            ${statusText}
                        </div>
                        <div class="factory-trade-info">
                            <span class="factory-import-info">Importés: ${getTotalImports(key)}</span>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>

            <div class="factory-products">
                <h4 class="factory-subtitle">Produits Finis</h4>
                ${Object.entries(productNames).map(([key, name]) => {
                    const status = getProductionStatus(key, true);
                    const emp = getEmployeesForResource(key);
                    const employeeType = getEmployeeType(key);
                    const employeeTypeName = employeeTypeNames[employeeType] || employeeType;
                    const statusClass = status.status === 'full' ? 'factory-status-full' : 'factory-status-reduced';
                    const statusText = status.status === 'full' 
                        ? '<span class="factory-status-full">✓ Production à son maximum</span>'
                        : `<span class="factory-status-reduced">⚠ Production réduite (${status.percentage}%)</span>`;
                    
                    return `
                    <div class="factory-stock-item">
                        <div class="factory-stock-item-row">
                            <label>${name}:</label>
                            <span class="factory-stock-value">${products[key] || 0} / ${status.max}</span>
                        </div>
                        <div class="factory-employee-info">
                            <span class="factory-employee-label">${employeeTypeName}:</span>
                            <span class="factory-employee-value">${emp.worker || 0} / ${emp.worker_need || 2}</span>
                        </div>
                        <div class="factory-production-status ${statusClass}">
                            ${statusText}
                        </div>
                        <div class="factory-trade-info">
                            <span class="factory-export-info">Exportés: ${getTotalExports(key)}</span>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>

            <div class="factory-controls">
                <div class="factory-control-item">
                    <label class="factory-toggle-label">
                        <input type="checkbox" class="factory-toggle" data-factory="${factory.name}" data-setting="keepInStock" ${keepInStock ? 'checked' : ''}>
                        <span>Conserver en stock (ne pas exporter)</span>
                    </label>
                </div>
                <div class="factory-control-item">
                    <label class="factory-toggle-label">
                        <input type="checkbox" class="factory-toggle" data-factory="${factory.name}" data-setting="isActive" ${factory.isActive !== false ? 'checked' : ''}>
                        <span>Usine active</span>
                    </label>
                </div>
            </div>
        `;
        
        this.attachEventListeners(card, factory);
        
        return card;
    }
    
    attachEventListeners(card, factory) {
        const factoryId = factory.name;
        
        const toggles = card.querySelectorAll('.factory-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.checked;
                await this.updateFactorySetting(factoryId, setting, value);
            });
        });
    }
    
    async updateFactorySetting(factoryId, setting, value) {
        if (!this.housesStore) {
            return;
        }
        
        try {
            await this.housesStore.updateHouseFields(factoryId, {
                [setting]: value
            });
            
            const factory = this.factories.find(f => f.name === factoryId);
            if (factory) {
                factory[setting] = value;
            }
        } catch (error) {
            // Error handling
        }
    }
    
    async refresh() {
        await this.loadFactories();
    }
}

function initFactorySection() {
    const factorySection = document.getElementById('admin-section-factory');
    if (!factorySection) return;
    
    const manager = new FactorySectionManager();
    
    if (window.app && window.app.housesStore) {
        manager.setHousesStore(window.app.housesStore);
    } else if (window.housesStore) {
        manager.setHousesStore(window.housesStore);
    } else if (window.game && window.game.housesStore) {
        manager.setHousesStore(window.game.housesStore);
    }
    
    const observer = new MutationObserver(() => {
        if (factorySection.classList.contains('active')) {
            manager.refresh();
        }
    });
    
    observer.observe(factorySection, { attributes: true, attributeFilter: ['class'] });
    
    if (factorySection.classList.contains('active')) {
        manager.init();
    }
    
    window.factorySectionManager = manager;
    
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
    
    setTimeout(() => clearInterval(checkHousesStore), 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFactorySection);
} else {
    initFactorySection();
}

