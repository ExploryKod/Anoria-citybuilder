import {
  getFactoryMaxStorage,
  getFactoryWorkerNeed,
  getFactoryEmployeeRoleType,
} from '../../../js/acl/supply.js';
import { getTimeInfo } from '../../../js/acl/appRuntime.js';
import {
    instanceIdFromHouseRow,
    displayLabelFromHouseRow,
} from '../../../js/acl/building-identity.js';
import {
    listCityFactories,
    listNatureResources,
    getFactoryById,
    updateFactoryFields,
    listProductionJournalEntries,
    getFactoryProductionJournalEntries,
} from '../../../js/acl/supply.js';

function factoryInstanceId(factory) {
    return instanceIdFromHouseRow(factory);
}

function factoryDisplayLabel(factory) {
    return displayLabelFromHouseRow(factory);
}

async function loadFactoryJournalEntries(factoryData) {
    return getFactoryProductionJournalEntries(factoryInstanceId(factoryData));
}

export class FactorySectionPresenter {
    constructor() {
        this.factories = [];
        this.naturalResources = [];
        this.naturalResourcesExpanded = true; // Par défaut, le panneau est ouvert
        this.currentTab = 'factories'; // 'factories' ou 'production-journal'
        this.selectedFactoryId = 'all'; // ID de la factory sélectionnée, 'all' pour toutes
        this.selectedJournalFactoryId = 'all'; // ID de la factory sélectionnée dans le journal, 'all' pour toutes
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
        
        // Gestion du select de factory - supprimer l'ancien listener avant d'en ajouter un nouveau
        const factorySelect = document.getElementById('factory-select');
        if (factorySelect) {
            // Supprimer l'ancien listener s'il existe
            if (this.handleFactorySelectChange) {
                factorySelect.removeEventListener('change', this.handleFactorySelectChange);
            }
            // Créer une nouvelle fonction liée
            this.handleFactorySelectChange = (e) => {
                this.selectedFactoryId = e.target.value;
                this.render();
            };
            factorySelect.addEventListener('change', this.handleFactorySelectChange);
        }
        
        // Gestion du select de factory pour le journal de production
        const journalFactorySelect = document.getElementById('production-journal-factory-select');
        if (journalFactorySelect) {
            // Supprimer l'ancien listener s'il existe
            if (this.handleJournalFactorySelectChange) {
                journalFactorySelect.removeEventListener('change', this.handleJournalFactorySelectChange);
            }
            // Créer une nouvelle fonction liée
            this.handleJournalFactorySelectChange = (e) => {
                this.selectedJournalFactoryId = e.target.value;
                this.renderProductionJournal();
            };
            journalFactorySelect.addEventListener('change', this.handleJournalFactorySelectChange);
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
        
        // Charger le contenu approprié - chaque onglet gère son propre select
        if (tabName === 'production-journal') {
            await this.renderProductionJournal();
        } else {
            await this.render();
        }
    }
    
    async loadFactories() {
        try {
            const filteredFactories = await listCityFactories();
            
            // Éviter les doublons basés sur le nom de la factory
            const uniqueFactories = [];
            const seenFactories = new Set();
            filteredFactories.forEach(factory => {
                const factoryKey = factoryInstanceId(factory);
                if (!seenFactories.has(factoryKey)) {
                    seenFactories.add(factoryKey);
                    uniqueFactories.push(factory);
                }
            });
            
            this.factories = uniqueFactories;

            this.naturalResources = await listNatureResources();

            this.render();
        } catch (error) {
        }
    }
    
    async render() {
        const factoryBoard = document.getElementById('factory-board');
        if (!factoryBoard) return;
        
        // Rendre le panneau des ressources naturelles (async pour recharger depuis IndexedDB)
        await this.renderNaturalResources(factoryBoard);
        
        // Mettre à jour uniquement le select de la vue par factory (pas celui du journal)
        this.updateFactorySelect();
        
        // Rendre les factories
        const factoriesList = document.getElementById('factory-factories-list');
        if (!factoriesList) return;
        
        if (this.factories.length === 0) {
            factoriesList.innerHTML = '<div class="factory-empty">Aucune usine construite</div>';
            return;
        }
        
        // Filtrer les factories selon la sélection
        let factoriesToDisplay = this.factories;
        if (this.selectedFactoryId !== 'all') {
            factoriesToDisplay = this.factories.filter(
                (f) => factoryInstanceId(f) === this.selectedFactoryId
            );
        }
        
        if (factoriesToDisplay.length === 0) {
            factoriesList.innerHTML = '<div class="factory-empty">Aucune usine sélectionnée</div>';
            return;
        }
        
        // Vider complètement la liste avant d'ajouter les nouvelles factories
        factoriesList.innerHTML = '';
        
        // S'assurer qu'il n'y a pas de doublons dans factoriesToDisplay
        const displayedFactories = new Set();
        for (const factory of factoriesToDisplay) {
            const factoryKey = factoryInstanceId(factory);
            if (!displayedFactories.has(factoryKey)) {
                displayedFactories.add(factoryKey);
                const factoryCard = await this.createFactoryCard(factory);
                factoriesList.appendChild(factoryCard);
            }
        }
    }
    
    /**
     * Met à jour le select de factory pour la vue par factory (onglet "Vue par Factory")
     * Ce select est complètement indépendant du select du journal de production
     */
    updateFactorySelect() {
        const factorySelect = document.getElementById('factory-select');
        if (!factorySelect) return;
        
        // Sauvegarder la valeur actuelle
        const currentValue = factorySelect.value;
        
        // Vider le select (garder l'option "Toutes les usines")
        factorySelect.innerHTML = '<option value="all">Toutes les usines</option>';
        
        // Ajouter chaque factory au select (s'assurer qu'il n'y a pas de doublons)
        const addedFactories = new Set();
        this.factories.forEach(factory => {
            // Éviter les doublons basés sur le nom
            if (!addedFactories.has(factoryInstanceId(factory))) {
                const option = document.createElement('option');
                option.value = factoryInstanceId(factory);
                option.textContent = `${factoryDisplayLabel(factory)} (x: ${factory.x || 0}, y: ${factory.y || 0})`;
                factorySelect.appendChild(option);
                addedFactories.add(factoryInstanceId(factory));
            }
        });
        
        // Restaurer la valeur précédente si elle existe toujours
        if (currentValue && Array.from(factorySelect.options).some(opt => opt.value === currentValue)) {
            factorySelect.value = currentValue;
            this.selectedFactoryId = currentValue;
        } else {
            // Si la factory précédemment sélectionnée n'existe plus, revenir à "all"
            factorySelect.value = 'all';
            this.selectedFactoryId = 'all';
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
        try {
            this.naturalResources = await listNatureResources();
        } catch (_error) {
            // preserve silent failure
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
        card.dataset.factoryId = factoryInstanceId(factory);
        
        // Recharger les données depuis IndexedDB pour avoir les données à jour (notamment employees et productWorkerDistribution)
        let factoryData = factory;
        try {
            const freshData = await getFactoryById(factoryInstanceId(factory));
            if (freshData) {
                factoryData = freshData;
            }
        } catch (error) {
            console.warn('[FactorySectionPresenter] Failed to reload factory data:', error);
        }
        
        const rawMaterials = factoryData.rawMaterials || {};
        const products = factoryData.products || {};
        const exports = factoryData.exports || {};
        const imports = factoryData.imports || {};
        const keepInStock = factoryData.keepInStock !== false;
        const factoryEmployees = factoryData.factoryEmployees || {};
        const employees = factoryData.employees || { worker: 0, worker_need: 0, elite: 0, elite_need: 0 };
        // Répartition des workers par produit (stockée dans IndexedDB)
        const productWorkerDistribution = factoryData.productWorkerDistribution || {};
        // Pourcentages de production par produit (stockés dans IndexedDB)
        const productProductionPercentages = factoryData.productProductionPercentages || {};
        // Stock de matériaux raffinés
        const logs = factoryData.logs || 0;
        const refinedGold = factoryData.refinedGold || 0;
        const refinedClay = factoryData.refinedClay || 0;
        const refinedIron = factoryData.refinedIron || 0;
        // Messages de transformation et étapes de production
        const lastTransformationMessage = factoryData.lastTransformationMessage || '';
        const lastTransformationTurn = factoryData.lastTransformationTurn || 0;
        const lastProcessTurn = factoryData.lastProcessTurn || 0;
        
        // Récupérer les entrées du journal de production pour cette factory
        const journalEntries = await loadFactoryJournalEntries(factoryData);
        
        // Trouver les dernières transformations
        const lastWoodTransformEntry = journalEntries
            .filter(e => e.eventType === 'transform_wood_to_logs')
            .sort((a, b) => b.turn - a.turn)[0];
        const lastGoldTransformEntry = journalEntries
            .filter(e => e.eventType === 'transform_gold_to_refined_gold')
            .sort((a, b) => b.turn - a.turn)[0];
        const lastClayTransformEntry = journalEntries
            .filter(e => e.eventType === 'transform_clay_to_refined_clay')
            .sort((a, b) => b.turn - a.turn)[0];
        const lastIronTransformEntry = journalEntries
            .filter(e => e.eventType === 'transform_iron_to_refined_iron')
            .sort((a, b) => b.turn - a.turn)[0];
        
        // Déterminer les messages de transformation
        const transformationMessages = [];
        
        if (lastWoodTransformEntry) {
            const transformQuantity = lastWoodTransformEntry.quantity;
            const furnitureEntries = journalEntries
                .filter(e => e.eventType === 'produce_furniture' && e.turn > lastWoodTransformEntry.turn)
                .sort((a, b) => a.turn - b.turn);
            
            if (furnitureEntries.length > 0) {
                const totalFurniture = furnitureEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
                const totalLogsConsumed = furnitureEntries.reduce((sum, e) => sum + ((e.logsConsumed || e.materialConsumed) || 0), 0);
                transformationMessages.push(`Les bûcherons ont transformé ${transformQuantity} bois en bûches. Les menuisiers ont transformé ${totalLogsConsumed} bûches en ${totalFurniture} meuble${totalFurniture > 1 ? 's' : ''}`);
            } else {
                transformationMessages.push(`Les bûcherons ont transformé ${transformQuantity} bois en bûches`);
            }
        }
        
        if (lastGoldTransformEntry) {
            const transformQuantity = lastGoldTransformEntry.quantity;
            const jewelryEntries = journalEntries
                .filter(e => e.eventType === 'produce_jewelry' && e.turn > lastGoldTransformEntry.turn)
                .sort((a, b) => a.turn - b.turn);
            
            if (jewelryEntries.length > 0) {
                const totalJewelry = jewelryEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
                const totalRefinedGoldConsumed = jewelryEntries.reduce((sum, e) => sum + ((e.materialConsumed) || 0), 0);
                transformationMessages.push(`Les mineurs ont transformé ${transformQuantity} or en or raffiné. Les bijoutiers ont transformé ${totalRefinedGoldConsumed} or raffiné en ${totalJewelry} bijou${totalJewelry > 1 ? 'x' : ''}`);
            } else {
                transformationMessages.push(`Les mineurs ont transformé ${transformQuantity} or en or raffiné`);
            }
        }
        
        if (lastClayTransformEntry) {
            const transformQuantity = lastClayTransformEntry.quantity;
            const potteryEntries = journalEntries
                .filter(e => e.eventType === 'produce_pottery' && e.turn > lastClayTransformEntry.turn)
                .sort((a, b) => a.turn - b.turn);
            
            if (potteryEntries.length > 0) {
                const totalPottery = potteryEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
                const totalRefinedClayConsumed = potteryEntries.reduce((sum, e) => sum + ((e.materialConsumed) || 0), 0);
                transformationMessages.push(`Les creuseurs ont transformé ${transformQuantity} argile en argile raffinée. Les potiers ont transformé ${totalRefinedClayConsumed} argile raffinée en ${totalPottery} poterie${totalPottery > 1 ? 's' : ''}`);
            } else {
                transformationMessages.push(`Les creuseurs ont transformé ${transformQuantity} argile en argile raffinée`);
            }
        }
        
        if (lastIronTransformEntry) {
            const transformQuantity = lastIronTransformEntry.quantity;
            const weaponsEntries = journalEntries
                .filter(e => e.eventType === 'produce_weapons' && e.turn > lastIronTransformEntry.turn)
                .sort((a, b) => a.turn - b.turn);
            
            if (weaponsEntries.length > 0) {
                const totalWeapons = weaponsEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
                const totalRefinedIronConsumed = weaponsEntries.reduce((sum, e) => sum + ((e.materialConsumed) || 0), 0);
                transformationMessages.push(`Les mineurs ont transformé ${transformQuantity} fer en fer raffiné. Les armuriers ont transformé ${totalRefinedIronConsumed} fer raffiné en ${totalWeapons} arme${totalWeapons > 1 ? 's' : ''}`);
            } else {
                transformationMessages.push(`Les mineurs ont transformé ${transformQuantity} fer en fer raffiné`);
            }
        }
        
        const transformationMessage = transformationMessages.join('. ');

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

        const getMaxStorage = (type) => getFactoryMaxStorage(type);

        const getEmployeeNeed = (type) => getFactoryWorkerNeed(type);

        const getEmployeeType = (type) => getFactoryEmployeeRoleType(type);

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
                    <strong>Usine:</strong> ${factoryDisplayLabel(factoryData)}
                </div>
                <div class="factory-location">
                    Position: x: ${factoryData.x || 0} | y: ${factoryData.y || 0}
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
                                data-factory="${factoryInstanceId(factoryData)}" 
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

            <!-- Section Matériaux raffinés (étapes intermédiaires) -->
            ${logs > 0 || refinedGold > 0 || refinedClay > 0 || refinedIron > 0 || transformationMessage ? `
            <div class="factory-intermediate-products">
                <h4 class="factory-subtitle">Étapes de Transformation</h4>
                ${logs > 0 ? `
                <div class="factory-stock-item">
                    <div class="factory-stock-item-row">
                        <label>Bûches:</label>
                        <span class="factory-stock-value">${logs} / ${getMaxStorage('logs')}</span>
                    </div>
                </div>
                ` : ''}
                ${refinedGold > 0 ? `
                <div class="factory-stock-item">
                    <div class="factory-stock-item-row">
                        <label>Or raffiné:</label>
                        <span class="factory-stock-value">${refinedGold} / ${getMaxStorage('refinedGold')}</span>
                    </div>
                </div>
                ` : ''}
                ${refinedClay > 0 ? `
                <div class="factory-stock-item">
                    <div class="factory-stock-item-row">
                        <label>Argile raffinée:</label>
                        <span class="factory-stock-value">${refinedClay} / ${getMaxStorage('refinedClay')}</span>
                    </div>
                </div>
                ` : ''}
                ${refinedIron > 0 ? `
                <div class="factory-stock-item">
                    <div class="factory-stock-item-row">
                        <label>Fer raffiné:</label>
                        <span class="factory-stock-value">${refinedIron} / ${getMaxStorage('refinedIron')}</span>
                    </div>
                </div>
                ` : ''}
                ${transformationMessage ? `
                    <div class="factory-step-message">
                        <span class="factory-step-text">${transformationMessage}</span>
                    </div>
                ` : ''}
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
                    const lastProductionTurn = factoryData[`lastProductionTurn_${key}`] || 0;
                    const currentTurn = lastProcessTurn || 0;
                    const turnsSinceProduction = currentTurn - lastProductionTurn;
                    const turnsRemaining = Math.max(0, productionTurns - turnsSinceProduction);
                    
                    // Message d'étape pour tous les produits
                    let stepMessage = '';
                    if (productWorkers > 0) {
                        if (turnsRemaining > 0) {
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Production en cours: ${turnsRemaining} tour${turnsRemaining > 1 ? 's' : ''} restant${turnsRemaining > 1 ? 's' : ''}</span></div>`;
                        } else if (key === 'furniture' && logs >= 4) {
                            const possibleFurniture = Math.floor(logs / 4);
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Les menuisiers peuvent fabriquer ${possibleFurniture} meuble${possibleFurniture > 1 ? 's' : ''} (${logs} bûches / 4)</span></div>`;
                        } else if (key === 'jewelry' && refinedGold >= 4) {
                            const possibleJewelry = Math.floor(refinedGold / 4);
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Les bijoutiers peuvent fabriquer ${possibleJewelry} bijou${possibleJewelry > 1 ? 'x' : ''} (${refinedGold} or raffiné / 4)</span></div>`;
                        } else if (key === 'pottery' && refinedClay >= 4) {
                            const possiblePottery = Math.floor(refinedClay / 4);
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Les potiers peuvent fabriquer ${possiblePottery} poterie${possiblePottery > 1 ? 's' : ''} (${refinedClay} argile raffinée / 4)</span></div>`;
                        } else if (key === 'weapons' && refinedIron >= 4) {
                            const possibleWeapons = Math.floor(refinedIron / 4);
                            stepMessage = `<div class="factory-step-message"><span class="factory-step-text">Les armuriers peuvent fabriquer ${possibleWeapons} arme${possibleWeapons > 1 ? 's' : ''} (${refinedIron} fer raffiné / 4)</span></div>`;
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
                                data-factory="${factoryInstanceId(factoryData)}" 
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
                        <input type="checkbox" class="factory-toggle" data-factory="${factoryInstanceId(factoryData)}" data-setting="keepInStock" ${keepInStock ? 'checked' : ''}>
                        <span>Conserver en stock (ne pas exporter)</span>
                    </label>
                </div>
                <div class="factory-control-item">
                    <label class="factory-toggle-label">
                        <input type="checkbox" class="factory-toggle" data-factory="${factoryInstanceId(factoryData)}" data-setting="isActive" ${factoryData.isActive !== false ? 'checked' : ''}>
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
        
        this.attachEventListeners(card, factoryData);
        
        return card;
    }
    
    attachEventListeners(card, factory) {
        const factoryId = factoryInstanceId(factory);
        
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
        try {
            await updateFactoryFields(factoryId, {
                [setting]: value,
            });
            
            const factory = this.factories.find((f) => factoryInstanceId(f) === factoryId);
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
        try {
            const factoryData = await getFactoryById(factoryId);
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
            await updateFactoryFields(factoryId, {
                productWorkerDistribution: newDistribution,
                productProductionPercentages: newProductionPercentages,
            });

            // Mettre à jour les données locales
            const factory = this.factories.find((f) => factoryInstanceId(f) === factoryId);
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
        
        // Mettre à jour le select avec toutes les factories disponibles dans le journal
        await this.updateJournalFactorySelect();
        
        try {
            // Afficher un indicateur de chargement
            journalContent.innerHTML = '<div class="factory-loading">Chargement du journal...</div>';
            
            // Récupérer toutes les entrées du journal depuis IndexedDB
            const entries = await listProductionJournalEntries();
            
            if (entries.length === 0) {
                journalContent.innerHTML = '<div class="factory-empty">Aucune entrée dans le journal de production</div>';
                return;
            }
            
            // Filtrer les entrées selon la sélection
            let filteredEntries = entries;
            if (this.selectedJournalFactoryId !== 'all') {
                filteredEntries = entries.filter(entry => entry.factoryId === this.selectedJournalFactoryId);
            }
            
            if (filteredEntries.length === 0) {
                journalContent.innerHTML = '<div class="factory-empty">Aucune entrée pour l\'usine sélectionnée</div>';
                return;
            }
            
            // Grouper par factory
            const entriesByFactory = {};
            filteredEntries.forEach(entry => {
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
            console.error('[FactorySectionPresenter] Error rendering production journal:', error);
            journalContent.innerHTML = '<div class="factory-empty">Erreur lors du chargement du journal</div>';
        }
    }
    
    /**
     * Met à jour le select de factory pour le journal de production (onglet "Journal de Production")
     * Ce select est complètement indépendant du select de la vue par factory
     * Il liste uniquement les factories qui ont des entrées dans le journal
     */
    async updateJournalFactorySelect() {
        const journalFactorySelect = document.getElementById('production-journal-factory-select');
        if (!journalFactorySelect) return;
        
        // Récupérer toutes les entrées du journal pour obtenir la liste des factories
        const entries = await listProductionJournalEntries();
        
        // Extraire les IDs de factories uniques
        const factoryIds = new Set();
        entries.forEach(entry => {
            if (entry.factoryId) {
                factoryIds.add(entry.factoryId);
            }
        });
        
        // Sauvegarder la valeur actuelle
        const currentValue = journalFactorySelect.value;
        
        // Vider le select (garder l'option "Toutes les usines")
        journalFactorySelect.innerHTML = '<option value="all">Toutes les usines</option>';
        
        // Ajouter chaque factory au select
        Array.from(factoryIds).sort().forEach(factoryId => {
            const option = document.createElement('option');
            option.value = factoryId;
            option.textContent = factoryId;
            journalFactorySelect.appendChild(option);
        });
        
        // Restaurer la valeur précédente si elle existe toujours
        if (currentValue && Array.from(journalFactorySelect.options).some(opt => opt.value === currentValue)) {
            journalFactorySelect.value = currentValue;
            this.selectedJournalFactoryId = currentValue;
        } else {
            // Si la factory précédemment sélectionnée n'existe plus, revenir à "all"
            journalFactorySelect.value = 'all';
            this.selectedJournalFactoryId = 'all';
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
        if (entry.turn !== undefined) {
            const timeInfo = getTimeInfo(entry.turn);
            monthDisplay = timeInfo.month;
            yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
        }
        
        // Mapping des noms de produits
        const productNames = {
            furniture: 'meuble',
            weapons: 'arme',
            pottery: 'poterie',
            jewelry: 'bijou'
        };
        
        // Créer le message selon le type d'événement
        let eventMessage = '';
        switch (entry.eventType) {
            case 'collect_wood':
                eventMessage = `Les bûcherons collectent ${entry.quantity} bois depuis les arbres de la carte`;
                break;
            case 'transform_wood_to_logs':
                eventMessage = `Les bûcherons transforment ${entry.quantity} bois en bûches`;
                break;
            case 'transform_gold_to_refined_gold':
                eventMessage = `Les mineurs transforment ${entry.quantity} or en or raffiné`;
                break;
            case 'transform_clay_to_refined_clay':
                eventMessage = `Les creuseurs transforment ${entry.quantity} argile en argile raffinée`;
                break;
            case 'transform_iron_to_refined_iron':
                eventMessage = `Les mineurs transforment ${entry.quantity} fer en fer raffiné`;
                break;
            case 'deliver_logs_to_carpenters':
                eventMessage = `Les bûcherons livrent ${entry.quantity} bûches aux menuisiers`;
                break;
            case 'produce_furniture':
                const furnitureName = productNames['furniture'] || 'meuble';
                const furnitureNamePlural = 'meubles';
                const materialConsumed = entry.logsConsumed || entry.materialConsumed || 0;
                if (materialConsumed > 0) {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = `<br>Production de ${entry.quantity} ${entry.quantity > 1 ? furnitureNamePlural : furnitureName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = `<br>Production de ${entry.quantity} ${furnitureNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les bûcherons livrent ${materialConsumed} bûches aux menuisiers<br>Les menuisiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? furnitureNamePlural : furnitureName} avec ${materialConsumed} bûches${durationMessage}`;
                } else {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = ` Production de ${entry.quantity} ${entry.quantity > 1 ? furnitureNamePlural : furnitureName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = ` Production de ${entry.quantity} ${furnitureNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les menuisiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? furnitureNamePlural : furnitureName} avec ${entry.quantity * 4} bûches${durationMessage}`;
                }
                break;
            case 'produce_jewelry':
                const jewelryName = productNames['jewelry'] || 'bijou';
                const jewelryNamePlural = 'bijoux';
                const refinedGoldConsumed = entry.materialConsumed || 0;
                if (refinedGoldConsumed > 0) {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = `<br>Production de ${entry.quantity} ${entry.quantity > 1 ? jewelryNamePlural : jewelryName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = `<br>Production de ${entry.quantity} ${jewelryNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les mineurs livrent ${refinedGoldConsumed} or raffiné aux bijoutiers<br>Les bijoutiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? jewelryNamePlural : jewelryName} avec ${refinedGoldConsumed} or raffiné${durationMessage}`;
                } else {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = ` Production de ${entry.quantity} ${entry.quantity > 1 ? jewelryNamePlural : jewelryName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = ` Production de ${entry.quantity} ${jewelryNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les bijoutiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? jewelryNamePlural : jewelryName} avec ${entry.quantity * 4} or raffiné${durationMessage}`;
                }
                break;
            case 'produce_pottery':
                const potteryName = productNames['pottery'] || 'poterie';
                const potteryNamePlural = 'poteries';
                const refinedClayConsumed = entry.materialConsumed || 0;
                if (refinedClayConsumed > 0) {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = `<br>Production de ${entry.quantity} ${entry.quantity > 1 ? potteryNamePlural : potteryName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = `<br>Production de ${entry.quantity} ${potteryNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les creuseurs livrent ${refinedClayConsumed} argile raffinée aux potiers<br>Les potiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? potteryNamePlural : potteryName} avec ${refinedClayConsumed} argile raffinée${durationMessage}`;
                } else {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = ` Production de ${entry.quantity} ${entry.quantity > 1 ? potteryNamePlural : potteryName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = ` Production de ${entry.quantity} ${potteryNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les potiers fabriquent ${entry.quantity} ${entry.quantity > 1 ? potteryNamePlural : potteryName} avec ${entry.quantity * 4} argile raffinée${durationMessage}`;
                }
                break;
            case 'produce_weapons':
                const weaponsName = productNames['weapons'] || 'arme';
                const weaponsNamePlural = 'armes';
                const refinedIronConsumed = entry.materialConsumed || 0;
                if (refinedIronConsumed > 0) {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = `<br>Production de ${entry.quantity} ${entry.quantity > 1 ? weaponsNamePlural : weaponsName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = `<br>Production de ${entry.quantity} ${weaponsNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les mineurs livrent ${refinedIronConsumed} fer raffiné aux armuriers<br>Les armuriers fabriquent ${entry.quantity} ${entry.quantity > 1 ? weaponsNamePlural : weaponsName} avec ${refinedIronConsumed} fer raffiné${durationMessage}`;
                } else {
                    let durationMessage = '';
                    if (entry.productionTurns && Array.isArray(entry.productionTurns) && entry.productionTurns.length > 0) {
                        const turnsStr = entry.productionTurns.join(', ');
                        const turnsCount = entry.productionTurns.length;
                        if (turnsCount === 1) {
                            durationMessage = ` Production de ${entry.quantity} ${entry.quantity > 1 ? weaponsNamePlural : weaponsName} au tour ${turnsStr}`;
                        } else {
                            durationMessage = ` Production de ${entry.quantity} ${weaponsNamePlural} en ${turnsCount} tours (tours ${turnsStr})`;
                        }
                    }
                    eventMessage = `Les armuriers fabriquent ${entry.quantity} ${entry.quantity > 1 ? weaponsNamePlural : weaponsName} avec ${entry.quantity * 4} fer raffiné${durationMessage}`;
                }
                break;
            default:
                eventMessage = `Événement: ${entry.eventType}`;
        }
        
        const stocks = entry.remainingStocks || {};
        const hasStocks = (stocks.wood || 0) > 0 || (stocks.logs || 0) > 0 || (stocks.furniture || 0) > 0 ||
                         (stocks.gold || 0) > 0 || (stocks.refinedGold || 0) > 0 || (stocks.jewelry || 0) > 0 ||
                         (stocks.clay || 0) > 0 || (stocks.refinedClay || 0) > 0 || (stocks.pottery || 0) > 0 ||
                         (stocks.iron || 0) > 0 || (stocks.refinedIron || 0) > 0 || (stocks.weapons || 0) > 0;
        
        const stocksMessage = hasStocks ? `
            <div class="production-journal-stocks">
                <div class="production-journal-stocks-title">Stocks restants:</div>
                <div class="production-journal-stocks-items">
                    ${(stocks.wood || 0) > 0 ? `<span class="production-journal-stock-item">Bois: ${stocks.wood || 0}</span>` : ''}
                    ${(stocks.logs || 0) > 0 ? `<span class="production-journal-stock-item">Bûches: ${stocks.logs || 0}</span>` : ''}
                    ${(stocks.furniture || 0) > 0 ? `<span class="production-journal-stock-item">Meubles: ${stocks.furniture || 0}</span>` : ''}
                    ${(stocks.gold || 0) > 0 ? `<span class="production-journal-stock-item">Or: ${stocks.gold || 0}</span>` : ''}
                    ${(stocks.refinedGold || 0) > 0 ? `<span class="production-journal-stock-item">Or raffiné: ${stocks.refinedGold || 0}</span>` : ''}
                    ${(stocks.jewelry || 0) > 0 ? `<span class="production-journal-stock-item">Bijoux: ${stocks.jewelry || 0}</span>` : ''}
                    ${(stocks.clay || 0) > 0 ? `<span class="production-journal-stock-item">Argile: ${stocks.clay || 0}</span>` : ''}
                    ${(stocks.refinedClay || 0) > 0 ? `<span class="production-journal-stock-item">Argile raffinée: ${stocks.refinedClay || 0}</span>` : ''}
                    ${(stocks.pottery || 0) > 0 ? `<span class="production-journal-stock-item">Poteries: ${stocks.pottery || 0}</span>` : ''}
                    ${(stocks.iron || 0) > 0 ? `<span class="production-journal-stock-item">Fer: ${stocks.iron || 0}</span>` : ''}
                    ${(stocks.refinedIron || 0) > 0 ? `<span class="production-journal-stock-item">Fer raffiné: ${stocks.refinedIron || 0}</span>` : ''}
                    ${(stocks.weapons || 0) > 0 ? `<span class="production-journal-stock-item">Armes: ${stocks.weapons || 0}</span>` : ''}
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

