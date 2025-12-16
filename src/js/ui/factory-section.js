import config from '../game/config.js';
import productionJournalManager from '../stores/ProductionJournalManager.js';

class FactorySectionManager {
    constructor() {
        this.factories = [];
        this.naturalResources = [];
        this.housesStore = null;
        this.naturalResourcesExpanded = true; // Par défaut, le panneau est ouvert
        this.currentTab = 'factories'; // 'factories' ou 'production-journal'
    }
    
    setHousesStore(housesStore) {
        this.housesStore = housesStore;
    }
    
    async init() {
        await this.loadFactories();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const refreshBtn = document.getElementById('factory-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }
        
        // Bouton d'actualisation spécifique pour le journal de production
        const journalRefreshBtn = document.getElementById('production-journal-refresh-btn');
        if (journalRefreshBtn) {
            journalRefreshBtn.addEventListener('click', async () => {
                await this.renderProductionJournal();
            });
        }
        
        // Gestion des onglets - utiliser la délégation d'événements pour s'assurer que ça fonctionne
        const factoryBoard = document.getElementById('factory-board');
        if (factoryBoard) {
            // Supprimer les anciens listeners pour éviter les doublons
            if (this.handleTabClick) {
                factoryBoard.removeEventListener('click', this.handleTabClick);
            }
            // Créer une nouvelle fonction liée
            this.handleTabClick = (e) => {
                const tab = e.target.closest('.factory-tab');
                if (tab) {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabName = tab.dataset.tab;
                    if (tabName) {
                        this.switchTab(tabName);
                    }
                }
            };
            factoryBoard.addEventListener('click', this.handleTabClick);
        }
    }
    
    async switchTab(tabName) {
        this.currentTab = tabName;
        
        // Mettre à jour les onglets
        const tabs = document.querySelectorAll('.factory-tab');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Mettre à jour le contenu
        const tabContents = document.querySelectorAll('.factory-tab-content');
        tabContents.forEach(content => {
            if (content.id === `factory-tab-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Charger le contenu approprié
        if (tabName === 'production-journal') {
            await this.renderProductionJournal();
        } else {
            await this.render();
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
            
            // Charger les ressources naturelles (trees et boulders)
            this.naturalResources = allHouses.filter(house => {
                const category = house.category || '';
                return category === 'nature';
            });
            
            this.render();
        } catch (error) {
        }
    }
    
    async render() {
        const factoryBoard = document.getElementById('factory-board');
        if (!factoryBoard) return;
        
        // Rendre le panneau des ressources naturelles (async pour recharger depuis IndexedDB)
        await this.renderNaturalResources(factoryBoard);
        
        // Rendre les factories
        const factoriesList = document.getElementById('factory-factories-list');
        if (!factoriesList) return;
        
        if (this.factories.length === 0) {
            factoriesList.innerHTML = '<div class="factory-empty">Aucune usine construite</div>';
            return;
        }
        
        factoriesList.innerHTML = '';
        
        for (const factory of this.factories) {
            const factoryCard = await this.createFactoryCard(factory);
            factoriesList.appendChild(factoryCard);
        }
    }
    
    async renderNaturalResources(container) {
        // Créer ou récupérer le conteneur des ressources naturelles
        let naturalResourcesContainer = document.getElementById('factory-natural-resources');
        if (!naturalResourcesContainer) {
            naturalResourcesContainer = document.createElement('div');
            naturalResourcesContainer.id = 'factory-natural-resources';
            naturalResourcesContainer.className = 'factory-natural-resources';
            container.insertBefore(naturalResourcesContainer, container.firstChild);
        }
        
        // Recharger les ressources naturelles depuis IndexedDB pour avoir les données à jour
        if (this.housesStore) {
            try {
                const allHouses = await this.housesStore.listAllHouses();
                this.naturalResources = allHouses.filter(house => {
                    const category = house.category || '';
                    return category === 'nature';
                });
            } catch (error) {
            }
        }
        
        // Calculer les totaux par ressource
        const resourceTotals = {
            wood: { current: 0, max: 0 },
            rock: { current: 0, max: 0 },
            gold: { current: 0, max: 0 },
            iron: { current: 0, max: 0 }
        };
        
        this.naturalResources.forEach(resource => {
            const stocks = resource.stocks || {};
            const maxStocks = resource.maxStocks || {};
            
            // Trees ont du wood
            if (resource.type && resource.type.includes('Tree')) {
                resourceTotals.wood.current += stocks.wood || 0;
                resourceTotals.wood.max += maxStocks.wood || 0;
            }
            
            // Boulders ont rock, gold, iron
            if (resource.type && resource.type.includes('Boulder')) {
                resourceTotals.rock.current += stocks.rock || 0;
                resourceTotals.rock.max += maxStocks.rock || 0;
                resourceTotals.gold.current += stocks.gold || 0;
                resourceTotals.gold.max += maxStocks.gold || 0;
                resourceTotals.iron.current += stocks.iron || 0;
                resourceTotals.iron.max += maxStocks.iron || 0;
            }
        });
        
        const resourceNames = {
            wood: 'Bois',
            rock: 'Pierre',
            gold: 'Or',
            iron: 'Fer'
        };
        
        const isExpanded = this.naturalResourcesExpanded;
        
        naturalResourcesContainer.innerHTML = `
            <div class="factory-natural-resources-header">
                <h3 class="factory-natural-resources-title">Ressources naturelles disponibles</h3>
                <button class="factory-toggle-resources-btn" id="factory-toggle-resources-btn">
                    ${isExpanded ? '▼' : '▶'}
                </button>
            </div>
            <div class="factory-natural-resources-content" style="display: ${isExpanded ? 'block' : 'none'};">
                ${Object.entries(resourceNames).map(([key, name]) => {
                    const total = resourceTotals[key];
                    if (total.max === 0) return ''; // Ne pas afficher les ressources qui n'existent pas
                    return `
                        <div class="factory-natural-resource-item">
                            <span class="factory-natural-resource-name">${name}:</span>
                            <span class="factory-natural-resource-value">${total.current} / ${total.max}</span>
                        </div>
                    `;
                }).filter(html => html !== '').join('')}
                ${Object.values(resourceTotals).every(total => total.max === 0) 
                    ? '<div class="factory-empty">Aucune ressource naturelle disponible</div>' 
                    : ''}
            </div>
        `;
        
        // Ajouter l'event listener pour le toggle
        const toggleBtn = document.getElementById('factory-toggle-resources-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.naturalResourcesExpanded = !this.naturalResourcesExpanded;
                this.render();
            });
        }
    }
    
    async createFactoryCard(factory) {
        const card = document.createElement('div');
        card.className = 'factory-card';
        card.dataset.factoryId = factory.name;
        
        const rawMaterials = factory.rawMaterials || {};
        const products = factory.products || {};
        const exports = factory.exports || {};
        const imports = factory.imports || {};
        const keepInStock = factory.keepInStock !== false;
        const factoryEmployees = factory.factoryEmployees || {};
        const employees = factory.employees || { worker: 0, worker_need: 0, elite: 0, elite_need: 0 };
        // Répartition des workers par produit (stockée dans IndexedDB)
        const productWorkerDistribution = factory.productWorkerDistribution || {};
        // Pourcentages de production par produit (stockés dans IndexedDB)
        const productProductionPercentages = factory.productProductionPercentages || {};
        // Stock de bûches (logs)
        const logs = factory.logs || 0;
        // Messages de transformation et étapes de production
        const lastTransformationMessage = factory.lastTransformationMessage || '';
        const lastTransformationTurn = factory.lastTransformationTurn || 0;
        const lastProcessTurn = factory.lastProcessTurn || 0;
        
        // Récupérer les entrées du journal de production pour cette factory
        const factoryId = `${factory.name}-${factory.x || 0}-${factory.y || 0}`;
        const journalEntries = await productionJournalManager.getFactoryProductionEntries(factoryId);
        
        // Trouver la dernière transformation de bois en bûches
        const lastTransformEntry = journalEntries
            .filter(e => e.eventType === 'transform_wood_to_logs')
            .sort((a, b) => b.turn - a.turn)[0];
        
        // Déterminer le message de transformation précis
        let transformationMessage = '';
        if (lastTransformEntry) {
            const transformQuantity = lastTransformEntry.quantity;
            const transformStocks = lastTransformEntry.remainingStocks || {};
            const transformLogsAfter = transformStocks.logs || 0;
            
            // Trouver les entrées de production de meubles après cette transformation
            const furnitureEntries = journalEntries
                .filter(e => e.eventType === 'produce_furniture' && e.turn > lastTransformEntry.turn)
                .sort((a, b) => a.turn - b.turn);
            
            if (furnitureEntries.length > 0) {
                const totalFurniture = furnitureEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
                const totalLogsConsumed = furnitureEntries.reduce((sum, e) => sum + (e.logsConsumed || 0), 0);
                transformationMessage = `Les bûcherons ont transformé ${transformQuantity} bois en bûches. Les menuisiers ont transformé ${totalLogsConsumed} bûches en ${totalFurniture} meuble${totalFurniture > 1 ? 's' : ''}`;
            } else {
                transformationMessage = `Les bûcherons ont transformé ${transformQuantity} bois en bûches`;
            }
        } else if (lastTransformationMessage && lastTransformationTurn === lastProcessTurn) {
            transformationMessage = lastTransformationMessage;
        }

        const rawMaterialNames = {
            wood: 'Bois',
            rock: 'Pierre',
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
            // Utiliser les workers alloués via productWorkerDistribution
            const allocatedWorkers = getWorkersForProduct(resourceType);
            
            // Si aucun worker n'est alloué, pas de production possible (0/0)
            if (allocatedWorkers === 0) {
                return { status: 'no-workers', max: 0, percentage: 0 };
            }
            
            const maxWorkersPerProduct = 2; // Maximum de workers par produit
            
            // Utiliser le pourcentage stocké dans IndexedDB s'il existe, sinon le calculer
            let percentageDisplay = productProductionPercentages[resourceType];
            if (percentageDisplay === undefined) {
                // Calculer le pourcentage basé sur les workers alloués
                const percentage = maxWorkersPerProduct > 0 ? (allocatedWorkers / maxWorkersPerProduct) : 0;
                percentageDisplay = Math.floor(percentage * 100);
            }
            
            const percentage = percentageDisplay / 100;
            const maxStorage = getMaxStorage(resourceType);
            const effectiveMax = Math.floor(maxStorage * percentage);
            
            if (percentage >= 1) {
                return { status: 'full', max: maxStorage, percentage: 100 };
            } else {
                return { status: 'reduced', max: effectiveMax, percentage: percentageDisplay };
            }
        };

        const getTotalExports = (productType) => {
            return exports[productType] || 0;
        };

        const getTotalImports = (materialType) => {
            return imports[materialType] || 0;
        };

        // Calcul des workers disponibles pour distribution
        const getWorkersForProduct = (productKey) => {
            return productWorkerDistribution[productKey] || 0;
        };

        const getTotalDistributedWorkers = () => {
            return Object.values(productWorkerDistribution).reduce((sum, count) => sum + (count || 0), 0);
        };

        const getAvailableWorkers = () => {
            const totalWorkers = employees.worker || 0;
            const distributed = getTotalDistributedWorkers();
            return Math.max(0, totalWorkers - distributed);
        };

        const canRecruitForProduct = (productKey) => {
            const currentWorkers = getWorkersForProduct(productKey);
            const availableWorkers = getAvailableWorkers();
            // Maximum 2 workers par produit
            return currentWorkers < 2 && availableWorkers > 0;
        };

        const isRecruitButtonDisabled = (productKey) => {
            return !canRecruitForProduct(productKey);
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
                    const statusClass = status.status === 'full' ? 'factory-status-full' : 
                                      status.status === 'no-workers' ? 'factory-status-no-workers' : 
                                      'factory-status-reduced';
                    const statusText = status.status === 'full' 
                        ? '<span class="factory-status-full">✓ Production à son maximum</span>'
                        : status.status === 'no-workers'
                        ? '<span class="factory-status-no-workers">❌ Aucune production (pas de workers alloués)</span>'
                        : `<span class="factory-status-reduced">⚠ Production réduite (${status.percentage}%)</span>`;
                    
                    const productWorkers = getWorkersForProduct(key);
                    const isDisabled = isRecruitButtonDisabled(key);
                    const buttonOpacity = isDisabled ? '0.5' : '1';
                    
                    return `
                    <div class="factory-stock-item">
                        <div class="factory-stock-item-row">
                            <label>${name}:</label>
                            <span class="factory-stock-value">${rawMaterials[key] || 0} / ${status.max}</span>
                        </div>
                        <div class="factory-production-status ${statusClass}">
                            ${statusText}
                        </div>
                        <div class="factory-trade-info">
                            <span class="factory-import-info">Importés: ${getTotalImports(key)}</span>
                        </div>
                        <div class="factory-recruit-section">
                            <span class="factory-product-workers">Workers: ${productWorkers} / 2</span>
                            <button 
                                class="factory-recruit-btn" 
                                data-factory="${factory.name}" 
                                data-product="${key}"
                                data-product-type="rawMaterial"
                                ${isDisabled ? 'disabled' : ''}
                                style="opacity: ${buttonOpacity};"
                            >
                                Recruter
                            </button>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>

            <!-- Section Bûches (étape intermédiaire) -->
            ${logs > 0 || transformationMessage ? `
            <div class="factory-intermediate-products">
                <h4 class="factory-subtitle">Étapes de Transformation</h4>
                <div class="factory-stock-item">
                    <div class="factory-stock-item-row">
                        <label>Bûches:</label>
                        <span class="factory-stock-value">${logs} / ${getMaxStorage('logs')}</span>
                    </div>
                    ${transformationMessage ? `
                        <div class="factory-step-message">
                            <span class="factory-step-text">${transformationMessage}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div class="factory-products">
                <h4 class="factory-subtitle">Produits Finis</h4>
                ${Object.entries(productNames).map(([key, name]) => {
                    const status = getProductionStatus(key, true);
                    const statusClass = status.status === 'full' ? 'factory-status-full' : 
                                      status.status === 'no-workers' ? 'factory-status-no-workers' : 
                                      'factory-status-reduced';
                    const statusText = status.status === 'full' 
                        ? '<span class="factory-status-full">✓ Production à son maximum</span>'
                        : status.status === 'no-workers'
                        ? '<span class="factory-status-no-workers">❌ Aucune production (pas de workers alloués)</span>'
                        : `<span class="factory-status-reduced">⚠ Production réduite (${status.percentage}%)</span>`;
                    
                    const productWorkers = getWorkersForProduct(key);
                    const isDisabled = isRecruitButtonDisabled(key);
                    const buttonOpacity = isDisabled ? '0.5' : '1';
                    
                    // Récupérer la durée de production pour ce produit
                    const productionTurns = key === 'furniture' ? 1 : 1;
                    const lastProductionTurn = factory[`lastProductionTurn_${key}`] || 0;
                    const currentTurn = lastProcessTurn || 0;
                    const turnsSinceProduction = currentTurn - lastProductionTurn;
                    const turnsRemaining = Math.max(0, productionTurns - turnsSinceProduction);
                    
                    // Message d'étape pour les meubles
                    let stepMessage = '';
                    if (key === 'furniture' && productWorkers > 0) {
                        if (turnsRemaining > 0) {
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Production en cours: ${turnsRemaining} tour${turnsRemaining > 1 ? 's' : ''} restant${turnsRemaining > 1 ? 's' : ''}</span></div>`;
                        } else if (logs >= 4) {
                            const possibleFurniture = Math.floor(logs / 4);
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Les menuisiers peuvent fabriquer ${possibleFurniture} meuble${possibleFurniture > 1 ? 's' : ''} (${logs} bûches / 4)</span></div>`;
                        }
                    }
                    
                    return `
                    <div class="factory-stock-item">
                        <div class="factory-stock-item-row">
                            <label>${name}:</label>
                            <span class="factory-stock-value">${products[key] || 0} / ${status.max}</span>
                        </div>
                        <div class="factory-production-status ${statusClass}">
                            ${statusText}
                        </div>
                        ${stepMessage}
                        <div class="factory-trade-info">
                            <span class="factory-export-info">Exportés: ${getTotalExports(key)}</span>
                        </div>
                        <div class="factory-recruit-section">
                            <span class="factory-product-workers">Workers: ${productWorkers} / 2</span>
                            <button 
                                class="factory-recruit-btn" 
                                data-factory="${factory.name}" 
                                data-product="${key}"
                                data-product-type="product"
                                ${isDisabled ? 'disabled' : ''}
                                style="opacity: ${buttonOpacity};"
                            >
                                Recruter
                            </button>
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
            
            <div class="factory-employees">
                <h4 class="factory-subtitle">Employés</h4>
                ${employees ? `
                    <div class="factory-employee-item">
                        <label>Ouvriers:</label>
                        <span class="factory-employee-value">${employees.worker || 0} / ${employees.worker_need || 0}</span>
                    </div>
                    <div class="factory-employee-item">
                        <label>Élites:</label>
                        <span class="factory-employee-value">${employees.elite || 0} / ${employees.elite_need || 0}</span>
                    </div>
                    <div class="factory-employee-status">
                        ${(employees.worker || 0) >= (employees.worker_need || 0) && 
                          (employees.elite || 0) >= (employees.elite_need || 0) 
                            ? '<span class="factory-status-success">✅ L\'usine a tout ce qu\'il faut pour fonctionner</span>'
                            : '<span class="factory-status-warning">⚠️ L\'usine ne peut fonctionner à sa pleine capacité</span>'}
                    </div>
                ` : '<div class="factory-employee-status">Aucune donnée d\'employés</div>'}
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

        // Event listeners pour les boutons de recrutement
        const recruitButtons = card.querySelectorAll('.factory-recruit-btn');
        recruitButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const productKey = e.target.dataset.product;
                await this.recruitWorkerForProduct(factoryId, productKey);
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
        }
    }

    /**
     * Recrute un worker pour un produit spécifique
     * @param {string} factoryId - ID de la factory
     * @param {string} productKey - Clé du produit (ex: 'wood', 'furniture')
     */
    async recruitWorkerForProduct(factoryId, productKey) {
        if (!this.housesStore) {
            return;
        }

        try {
            // Récupérer les données actuelles de la factory depuis IndexedDB
            const factoryData = await this.housesStore.getHouse(factoryId);
            if (!factoryData) {
                return;
            }

            const employees = factoryData.employees || { worker: 0, worker_need: 0 };
            const productWorkerDistribution = factoryData.productWorkerDistribution || {};
            
            // Vérifier qu'on peut recruter
            const currentWorkers = productWorkerDistribution[productKey] || 0;
            const totalDistributed = Object.values(productWorkerDistribution).reduce((sum, count) => sum + (count || 0), 0);
            const availableWorkers = Math.max(0, (employees.worker || 0) - totalDistributed);

            // Vérifications
            if (currentWorkers >= 2) {
                return;
            }

            if (availableWorkers <= 0) {
                return;
            }

            // Ajouter un worker au produit
            const newWorkersForProduct = (currentWorkers || 0) + 1;
            const newDistribution = {
                ...productWorkerDistribution,
                [productKey]: newWorkersForProduct
            };

            // Calculer le pourcentage de production pour ce produit
            const maxWorkersPerProduct = 2;
            const productionPercentage = Math.floor((newWorkersForProduct / maxWorkersPerProduct) * 100);

            // Récupérer ou initialiser les pourcentages de production
            const productProductionPercentages = factoryData.productProductionPercentages || {};
            const newProductionPercentages = {
                ...productProductionPercentages,
                [productKey]: productionPercentage
            };

            // Sauvegarder dans IndexedDB : workers alloués + pourcentages de production
            await this.housesStore.updateHouseFields(factoryId, {
                productWorkerDistribution: newDistribution,
                productProductionPercentages: newProductionPercentages
            });

            // Mettre à jour les données locales
            const factory = this.factories.find(f => f.name === factoryId);
            if (factory) {
                factory.productWorkerDistribution = newDistribution;
                factory.productProductionPercentages = newProductionPercentages;
            }

            // Re-render la carte pour mettre à jour l'UI
            await this.refresh();
        } catch (error) {
        }
    }
    
    async refresh() {
        await this.loadFactories();
        if (this.currentTab === 'production-journal') {
            await this.renderProductionJournal();
        }
    }
    
    /**
     * Affiche le journal de production
     */
    async renderProductionJournal() {
        const journalContent = document.getElementById('production-journal-content');
        if (!journalContent) return;
        
        try {
            // Afficher un indicateur de chargement
            journalContent.innerHTML = '<div class="factory-loading">Chargement du journal...</div>';
            
            // Récupérer toutes les entrées du journal depuis IndexedDB
            const entries = await productionJournalManager.getProductionEntries();
            
            if (entries.length === 0) {
                journalContent.innerHTML = '<div class="factory-empty">Aucune entrée dans le journal de production</div>';
                return;
            }
            
            // Grouper par factory
            const entriesByFactory = {};
            entries.forEach(entry => {
                if (!entriesByFactory[entry.factoryId]) {
                    entriesByFactory[entry.factoryId] = [];
                }
                entriesByFactory[entry.factoryId].push(entry);
            });
            
            // Créer le HTML
            let html = '<div class="production-journal-list">';
            
            // Pour chaque factory
            for (const [factoryId, factoryEntries] of Object.entries(entriesByFactory)) {
                // Trier par tour décroissant
                factoryEntries.sort((a, b) => b.turn - a.turn);
                
                html += `<div class="production-journal-factory">`;
                html += `<h4 class="production-journal-factory-title">Factory: ${factoryId}</h4>`;
                html += `<div class="production-journal-entries">`;
                
                factoryEntries.forEach(entry => {
                    html += this.createProductionJournalEntryHTML(entry);
                });
                
                html += `</div></div>`;
            }
            
            html += '</div>';
            journalContent.innerHTML = html;
        } catch (error) {
            console.error('[FactorySectionManager] Error rendering production journal:', error);
            journalContent.innerHTML = '<div class="factory-empty">Erreur lors du chargement du journal</div>';
        }
    }
    
    /**
     * Crée le HTML pour une entrée du journal de production
     */
    createProductionJournalEntryHTML(entry) {
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Obtenir le mois et l'année depuis TimeManager
        let monthDisplay = '';
        let yearDisplay = '';
        if (window.TimeManager && entry.turn !== undefined) {
            const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
            monthDisplay = timeInfo.month;
            yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
        }
        
        // Créer le message selon le type d'événement
        let eventMessage = '';
        switch (entry.eventType) {
            case 'collect_wood':
                eventMessage = `Les bûcherons collectent ${entry.quantity} bois depuis les arbres de la carte`;
                break;
            case 'transform_wood_to_logs':
                eventMessage = `Les bûcherons transforment ${entry.quantity} bois en bûches`;
                break;
            case 'deliver_logs_to_carpenters':
                eventMessage = `Les bûcherons livrent ${entry.quantity} bûches aux menuisiers`;
                break;
            case 'produce_furniture':
                // Si logsConsumed est présent, regrouper les deux étapes
                if (entry.logsConsumed !== undefined && entry.logsConsumed !== null) {
                    let durationMessage = '';
                    // Si productionTurns est présent, afficher les tours de production
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        durationMessage = `<br>en ${turnsCount} tour${turnsCount > 1 ? 's' : ''} : ${turnsStr}`;
                    }
                    eventMessage = `Les bûcherons livrent ${entry.logsConsumed} bûches aux menuisiers<br>Les menuisiers fabriquent ${entry.quantity} meuble${entry.quantity > 1 ? 's' : ''} avec ${entry.logsConsumed} bûches${durationMessage}`;
                } else {
                    let durationMessage = '';
                    // Si productionTurns est présent, afficher les tours de production
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        durationMessage = ` en ${turnsCount} tour${turnsCount > 1 ? 's' : ''} : ${turnsStr}`;
                    }
                    eventMessage = `Les menuisiers fabriquent ${entry.quantity} meuble${entry.quantity > 1 ? 's' : ''} avec ${entry.quantity * 4} bûches${durationMessage}`;
                }
                break;
            default:
                eventMessage = `Événement: ${entry.eventType}`;
        }
        
        const stocks = entry.remainingStocks || {};
        const hasStocks = (stocks.wood || 0) > 0 || (stocks.logs || 0) > 0 || (stocks.furniture || 0) > 0;
        
        const stocksMessage = hasStocks ? `
            <div class="production-journal-stocks">
                <div class="production-journal-stocks-title">Stocks restants:</div>
                <div class="production-journal-stocks-items">
                    <span class="production-journal-stock-item">Bois: ${stocks.wood || 0}</span>
                    <span class="production-journal-stock-item">Bûches: ${stocks.logs || 0}</span>
                    <span class="production-journal-stock-item">Meubles: ${stocks.furniture || 0}</span>
                </div>
            </div>
        ` : '';
        
        return `
            <div class="production-journal-entry">
                <div class="production-journal-entry-header">
                    <span class="production-journal-turn">Tour ${entry.turn}</span>
                    <span class="production-journal-date">${monthDisplay} ${yearDisplay} - ${formattedDate}</span>
                </div>
                <div class="production-journal-event">
                    ${eventMessage}
                </div>
                <div class="production-journal-details">
                    <span class="production-journal-quantity">Quantité: ${entry.quantity}</span>
                    <span class="production-journal-price">Prix: ${entry.price}€</span>
                </div>
                ${stocksMessage}
            </div>
        `;
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
            // Réinitialiser les event listeners quand la section devient active
            manager.setupEventListeners();
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

