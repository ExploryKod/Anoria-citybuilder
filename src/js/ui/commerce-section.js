import commerceStore from '../stores/CommerceStore.js';

class CommerceSectionManager {
    constructor() {
        this.selectedGood = null;
        this.goodsData = null;
        this.partnersData = null;
        this.currentTab = 'products';
    }

    async init() {
        this.setupEventListeners();
        this.setupTabs();
        await this.loadGoodsData();
        this.loadPartnersData();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.commerce-tab');
        const tabContents = document.querySelectorAll('.commerce-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = tab.dataset.tab;
                
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    const expectedId = `commerce-${targetTab}-tab`;
                    if (content.id === expectedId) {
                        content.classList.add('active');
                    }
                });
                
                this.currentTab = targetTab;
                
                if (targetTab === 'partners') {
                    this.renderPartners();
                }
            });
        });
    }

    /**
     * Generate initial partners data
     * @returns {Array<Object>} Partners with trade configurations
     * Dependencies: None
     */
    generatePartnersData() {
        return [
            {
                id: 'deserta',
                name: 'Deserta',
                description: 'Ville désertique spécialisée dans les dattes',
                isActive: false, // Relation commerciale désactivée par défaut
                activationConditions: [], // Conditions requises pour activer (vide = aucune condition)
                imports: [
                    {
                        productId: 'carrot',
                        productName: 'Carotte',
                        months: [7, 8, 11],
                        maxPerTurn: 8,
                        maxOccurrences: 9,
                        currentOccurrences: 0,
                        currentYearly: 0
                    },
                    {
                        productId: 'wood',
                        productName: 'Bois',
                        months: [11],
                        maxPerTurn: 5,
                        maxOccurrences: 2,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ],
                exports: [
                    {
                        productId: 'dattes',
                        productName: 'Dattes',
                        months: [0, 2],
                        maxOccurrences: 2,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ]
            },
            {
                id: 'tropicala',
                name: 'Tropicala',
                description: 'Ville tropicale aux ressources exotiques',
                isActive: false,
                activationConditions: [],
                imports: [
                    {
                        productId: 'wheat',
                        productName: 'Blé',
                        months: [3, 4, 9],
                        maxPerTurn: 6,
                        maxOccurrences: 8,
                        currentOccurrences: 0,
                        currentYearly: 0
                    },
                    {
                        productId: 'cabbage',
                        productName: 'Chou',
                        months: [5, 6, 10],
                        maxPerTurn: 4,
                        maxOccurrences: 6,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ],
                exports: [
                    {
                        productId: 'wood',
                        productName: 'Bois tropical',
                        months: [1, 2, 8],
                        maxOccurrences: 4,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ]
            },
            {
                id: 'arctica',
                name: 'Arctica',
                description: 'Ville du nord aux ressources rares',
                isActive: false,
                activationConditions: [],
                imports: [
                    {
                        productId: 'carrot',
                        productName: 'Carotte',
                        months: [1, 2, 6, 10],
                        maxPerTurn: 5,
                        maxOccurrences: 10,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ],
                exports: [
                    {
                        productId: 'wood',
                        productName: 'Bois du nord',
                        months: [4, 5, 9, 11],
                        maxOccurrences: 6,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ]
            }
        ];
    }

    /**
     * Load partners data from localStorage
     * Dependencies: localStorage
     */
    loadPartnersData() {
        const stored = localStorage.getItem('commerce_partners');
        if (stored) {
            try {
                this.partnersData = JSON.parse(stored);
            } catch (e) {
                this.partnersData = this.generatePartnersData();
                this.savePartnersData();
            }
        } else {
            this.partnersData = this.generatePartnersData();
            this.savePartnersData();
        }
    }

    /**
     * Check if partner activation conditions are met
     * @param {Object} partner - Partner object
     * @returns {Object} { canActivate: boolean, unmetConditions: Array<string> }
     * Dependencies: None (extensible for future conditions)
     */
    checkPartnerActivationConditions(partner) {
        if (!partner.activationConditions || partner.activationConditions.length === 0) {
            return { canActivate: true, unmetConditions: [] };
        }

        const unmetConditions = [];

        // Exemple de conditions futures (à implémenter) :
        // - 'population_min_100': Nécessite 100 habitants minimum
        // - 'building_windmill': Nécessite un moulin construit
        // - 'funds_min_500': Nécessite 500€ en trésorerie

        for (const condition of partner.activationConditions) {
            // TODO: Implémenter la vérification des conditions ici
            // Pour l'instant, on considère toutes les conditions comme non remplies
            unmetConditions.push(condition);
        }

        return {
            canActivate: unmetConditions.length === 0,
            unmetConditions
        };
    }

    /**
     * Toggle partner active status
     * @param {string} partnerId - Partner ID
     * @returns {boolean} New active status or false if activation failed
     * Dependencies: localStorage
     */
    togglePartnerActivation(partnerId) {
        const partner = this.partnersData.find(p => p.id === partnerId);
        if (!partner) return false;

        const conditionCheck = this.checkPartnerActivationConditions(partner);

        // Si on active, vérifier les conditions
        if (!partner.isActive && !conditionCheck.canActivate) {
            console.warn(`Cannot activate partner ${partnerId}: conditions not met`, conditionCheck.unmetConditions);
            return false;
        }

        partner.isActive = !partner.isActive;
        this.savePartnersData();

        return partner.isActive;
    }

    savePartnersData() {
        localStorage.setItem('commerce_partners', JSON.stringify(this.partnersData));
    }

    /**
     * Render partners list with activation controls
     * Dependencies: commerceStore
     */
    renderPartners() {
        const partnersList = document.getElementById('commerce-partners-list');
        if (!partnersList || !this.partnersData) return;

        // Initialiser les champs manquants pour compatibilité avec anciennes données
        let needsSave = false;
        this.partnersData.forEach(partner => {
            if (partner.isActive === undefined) {
                partner.isActive = false;
                needsSave = true;
            }
            if (!partner.activationConditions) {
                partner.activationConditions = [];
                needsSave = true;
            }
        });
        if (needsSave) this.savePartnersData();

        const stats = commerceStore.loadStats();
        const yearlyExports = stats?.yearlyExports || {};
        const yearlyImports = stats?.yearlyImports || {};

        partnersList.innerHTML = this.partnersData.map(partner => {
            const importsHTML = partner.imports.map(imp => {
                const monthsNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                const monthsText = imp.months.map(m => monthsNames[m]).join(', ');
                const isPartnerLimitReached = imp.currentOccurrences >= imp.maxOccurrences;
                
                const productConfig = this.goodsData?.find(g => g.id === imp.productId);
                const internalLimit = productConfig?.sellingMax || 0;
                const currentYearly = yearlyExports[imp.productId] || 0;
                const isInternalLimitReached = currentYearly >= internalLimit;
                
                const statusClass = (isPartnerLimitReached || isInternalLimitReached) ? 'limit-reached' : 'active';
                const statusText = isPartnerLimitReached ? 'Limite partenaire atteinte' : 
                                  isInternalLimitReached ? 'Seuil interne dépassé' : 'Actif';
                
                return `
                    <div class="partner-trade-item ${statusClass}">
                        <div class="partner-trade-header">
                            <span class="partner-trade-product">${imp.productName}</span>
                            <span class="partner-trade-status ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        <div class="partner-trade-details">
                            <div class="partner-trade-detail">
                                <span class="detail-label">Mois:</span>
                                <span class="detail-value">${monthsText}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Max/tour:</span>
                                <span class="detail-value">${imp.maxPerTurn}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Nombre d'imports avant fin du contrat:</span>
                                <span class="detail-value">${imp.currentOccurrences}/${imp.maxOccurrences}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Seuil interne:</span>
                                <span class="detail-value ${isInternalLimitReached ? 'limit-reached' : ''}">${currentYearly}/${internalLimit}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const exportsHTML = partner.exports.map(exp => {
                const monthsNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                const monthsText = exp.months.map(m => monthsNames[m]).join(', ');
                const isPartnerLimitReached = exp.currentOccurrences >= exp.maxOccurrences;
                
                const productConfig = this.goodsData?.find(g => g.id === exp.productId);
                const internalLimit = productConfig?.buyingMax || 0;
                const currentYearly = yearlyImports[exp.productId] || 0;
                const isInternalLimitReached = currentYearly >= internalLimit;
                
                const statusClass = (isPartnerLimitReached || isInternalLimitReached) ? 'limit-reached' : 'active';
                const statusText = isPartnerLimitReached ? 'Limite partenaire atteinte' : 
                                  isInternalLimitReached ? 'Seuil interne dépassé' : 'Actif';
                
                return `
                    <div class="partner-trade-item ${statusClass}">
                        <div class="partner-trade-header">
                            <span class="partner-trade-product">${exp.productName}</span>
                            <span class="partner-trade-status ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        <div class="partner-trade-details">
                            <div class="partner-trade-detail">
                                <span class="detail-label">Mois:</span>
                                <span class="detail-value">${monthsText}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Nombre d'exports avant fin du contrat:</span>
                                <span class="detail-value">${exp.currentOccurrences}/${exp.maxOccurrences}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Seuil interne:</span>
                                <span class="detail-value ${isInternalLimitReached ? 'limit-reached' : ''}">${currentYearly}/${internalLimit}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Vérifier les conditions d'activation
            const conditionCheck = this.checkPartnerActivationConditions(partner);
            const canActivate = conditionCheck.canActivate;
            const conditionsText = partner.activationConditions.length === 0
                ? 'Aucune condition'
                : conditionCheck.unmetConditions.join(', ');

            return `
                <div class="commerce-partner-item ${partner.isActive ? 'active' : 'inactive'}" data-partner-id="${partner.id}">
                    <div class="commerce-partner-header">
                        <h4 class="commerce-partner-name">${partner.name}</h4>
                        <p class="commerce-partner-description">${partner.description}</p>
                    </div>

                    <div class="commerce-partner-activation">
                        <div class="partner-activation-status">
                            <span class="status-label">Statut:</span>
                            <span class="status-value ${partner.isActive ? 'active' : 'inactive'}">
                                ${partner.isActive ? '✅ Relation active' : '❌ Relation inactive'}
                            </span>
                        </div>
                        <button class="partner-activation-btn ${!canActivate && !partner.isActive ? 'disabled' : ''}"
                                data-partner-id="${partner.id}"
                                ${!canActivate && !partner.isActive ? 'disabled' : ''}>
                            ${partner.isActive ? 'Désactiver la relation' : 'Activer la relation'}
                        </button>
                        <div class="partner-activation-conditions">
                            <span class="conditions-label">Conditions d'activation:</span>
                            <span class="conditions-value">${conditionsText}</span>
                        </div>
                    </div>

                    <div class="commerce-partner-trades ${!partner.isActive ? 'disabled' : ''}">
                        ${partner.imports.length > 0 ? `
                            <div class="partner-trades-section">
                                <h5 class="partner-trades-title">Importe (nos exports)</h5>
                                ${importsHTML}
                            </div>
                        ` : ''}
                        ${partner.exports.length > 0 ? `
                            <div class="partner-trades-section">
                                <h5 class="partner-trades-title">Exporte (nos imports)</h5>
                                ${exportsHTML}
                            </div>
                        ` : ''}
                        ${partner.imports.length === 0 && partner.exports.length === 0 ? `
                            <div class="partner-no-trades">
                                <p>Aucun accord commercial actif</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    setupEventListeners() {
        // Utiliser la délégation d'événements pour gérer les clics sur les éléments dynamiques
        // Écouter sur le conteneur parent qui existe toujours
        const commerceBoard = document.getElementById('admin-section-commerce');
        if (!commerceBoard) return;

        // Supprimer l'ancien listener s'il existe pour éviter les doublons
        if (this.clickHandler) {
            commerceBoard.removeEventListener('click', this.clickHandler);
        }

        // Créer un nouveau handler
        this.clickHandler = (e) => {
            // Gérer les clics sur les boutons d'activation des partenaires
            const activationBtn = e.target.closest('.partner-activation-btn');
            if (activationBtn) {
                const partnerId = activationBtn.dataset.partnerId;
                const newStatus = this.togglePartnerActivation(partnerId);
                if (newStatus !== false) {
                    this.renderPartners();
                }
                return;
            }

            // Vérifier si on clique sur un commerce-good-item
            const goodItem = e.target.closest('.commerce-good-item');
            if (!goodItem) return;
            
            // Ne pas ouvrir si on clique directement sur les détails ou leurs enfants
            if (e.target.closest('.commerce-good-details')) return;
            
            // Ne pas ouvrir si on clique sur les boutons de contrôle
            if (e.target.closest('.commerce-threshold-btn') || 
                e.target.closest('.commerce-price-btn') ||
                e.target.closest('.commerce-switch-input') ||
                e.target.closest('input') ||
                e.target.closest('button')) {
                return;
            }

            const goodId = goodItem.dataset.goodId;
            if (goodId) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleGoodDetails(goodId);
            }
        };

        commerceBoard.addEventListener('click', this.clickHandler);
    }

    async loadGoodsData() {
        // Charger depuis le store (ou générer si première fois)
        const storedConfig = commerceStore.loadConfig();
        if (storedConfig) {
            this.goodsData = storedConfig;
        } else {
            this.goodsData = this.generatePlaceholderGoodsData();
            commerceStore.saveConfig(this.goodsData);
        }
        
        // Charger les stats dynamiques depuis le store
        this.loadDynamicStats();
        
        // Calculer les statuts de consommation pour les produits alimentaires
        await this.updateConsumptionStatuses();
        
        this.render();
    }

    /**
     * Met à jour les statuts de consommation pour tous les produits alimentaires
     */
    async updateConsumptionStatuses() {
        if (!this.goodsData) return;

        // Récupérer housesStore et foodTraceabilityService
        let housesStore = null;
        if (window.app && window.app.housesStore) {
            housesStore = window.app.housesStore;
        } else if (window.housesStore) {
            housesStore = window.housesStore;
        } else if (window.game && window.game.housesStore) {
            housesStore = window.game.housesStore;
        }

        const foodTraceabilityService = window.foodTraceabilityService || null;

        // Mettre à jour chaque produit alimentaire
        for (const good of this.goodsData) {
            if (['wheat', 'carrot', 'cabbage'].includes(good.id)) {
                const status = await this.calculateConsumptionStatus(good.id, housesStore, foodTraceabilityService);
                good.consumptionShare = status.consumptionShare;
                good.consumptionStatus = status.consumptionStatus;
            }
        }

        // Sauvegarder la configuration mise à jour
        commerceStore.saveConfig(this.goodsData);
    }

    /**
     * Charge les statistiques dynamiques depuis le store (écrites par CommerceService)
     */
    loadDynamicStats() {
        const stats = commerceStore.loadStats();
        if (!stats || !this.goodsData) return;

        // Mettre à jour les données avec les stats
        this.goodsData.forEach(good => {
            if (stats.yearlyImports && stats.yearlyImports[good.id] !== undefined) {
                good.yearlyImports = stats.yearlyImports[good.id];
            }
            if (stats.yearlyExports && stats.yearlyExports[good.id] !== undefined) {
                good.yearlyExports = stats.yearlyExports[good.id];
            }
        });
    }

    /**
     * Calcule la consommation et le statut d'export pour un produit alimentaire
     * @param {string} productId - ID du produit (wheat, carrot, cabbage)
     * @param {HousesStore} housesStore - Store des maisons
     * @param {FoodTraceabilityService} foodTraceabilityService - Service de traçabilité
     * @returns {Promise<Object>} { consumptionShare, consumptionStatus, annualConsumption, annualProduction, netAvailable }
     */
    async calculateConsumptionStatus(productId, housesStore, foodTraceabilityService) {
        // Seulement pour les produits alimentaires
        const foodProducts = ['wheat', 'carrot', 'cabbage'];
        if (!foodProducts.includes(productId)) {
            return {
                consumptionShare: 0,
                consumptionStatus: 'able',
                annualConsumption: 0,
                annualProduction: 0,
                netAvailable: 0
            };
        }

        try {
            // 1. Calculer la consommation annuelle réelle
            let annualConsumption = 0;
            if (foodTraceabilityService && typeof foodTraceabilityService.getAllTransactions === 'function') {
                const allTransactions = await foodTraceabilityService.getAllTransactions();
                // Obtenir l'année actuelle depuis TimeManager ou utiliser la dernière année dans les transactions
                let currentYear = 0;
                if (window.TimeManager && typeof window.TimeManager.getTimeInfo === 'function') {
                    // Essayer d'obtenir le temps depuis le jeu si disponible
                    const gameTime = window.game?.city?.time || window.game?.time || 0;
                    const timeInfo = window.TimeManager.getTimeInfo(gameTime);
                    currentYear = timeInfo.year;
                } else if (allTransactions.length > 0) {
                    // Utiliser la dernière année dans les transactions
                    currentYear = Math.max(...allTransactions.map(t => t.year || 0));
                }
                
                // Filtrer les transactions de consommation de l'année en cours
                const consumptionTransactions = allTransactions.filter(t => 
                    t.transactionType === 'house_consumption' &&
                    t.foodType === productId &&
                    t.year === currentYear
                );
                
                // Somme de toutes les consommations de l'année
                annualConsumption = consumptionTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
            }

            // Si pas de données de traçabilité, estimer depuis la population
            if (annualConsumption === 0 && housesStore) {
                const totalPopulation = await housesStore.getGlobalPopulation();
                // Estimation : chaque citoyen consomme 1 panier/mois = 12 paniers/an
                // Répartition approximative : 40% wheat, 30% carrot, 30% cabbage
                const consumptionRatios = {
                    wheat: 0.4,
                    carrot: 0.3,
                    cabbage: 0.3
                };
                annualConsumption = Math.round(totalPopulation * 12 * (consumptionRatios[productId] || 0.33));
            }

            // 2. Calculer la production annuelle locale
            let annualProduction = 0;
            if (housesStore) {
                const allBuildings = await housesStore.listAllHouses();
                const farmTypeMap = {
                    'wheat': ['Farm-Wheat', 'Farms-Wheat'],
                    'carrot': ['Farm-Carrot', 'Farms-Carrot'],
                    'cabbage': ['Farm-Cabbage', 'Farms-Cabbage']
                };
                const farmTypes = farmTypeMap[productId] || [];
                
                // Compter les fermes de ce type
                const farms = allBuildings.filter(b => {
                    if (!b.type) return false;
                    return farmTypes.some(type => b.type === type) ||
                           (b.type.includes('Farm') && b.type.toLowerCase().includes(productId));
                });
                
                // Chaque ferme produit 78 paniers/an
                annualProduction = farms.length * 78;
            }

            // 3. Récupérer les imports/exports actuels
            const stats = commerceStore.loadStats();
            const yearlyImports = stats?.yearlyImports?.[productId] || 0;
            const yearlyExports = stats?.yearlyExports?.[productId] || 0;

            // 4. Calculer le disponible net
            // Disponible = Production locale + Imports - Exports actuels
            const netAvailable = annualProduction + yearlyImports - yearlyExports;

            // 5. Calculer le pourcentage de couverture
            let consumptionShare = 0;
            if (annualConsumption > 0) {
                consumptionShare = Math.round((netAvailable / annualConsumption) * 100);
            } else {
                // Si pas de consommation, on considère qu'on peut exporter
                consumptionShare = netAvailable > 0 ? 200 : 0;
            }

            // 6. Déterminer le statut
            let consumptionStatus = 'able';
            if (netAvailable >= annualConsumption * 1.2) {
                // Dépasse largement (20% de marge)
                consumptionStatus = 'exceeding';
            } else if (netAvailable >= annualConsumption) {
                // Capable de répondre aux besoins
                consumptionStatus = 'able';
            } else {
                // Incapable de répondre aux besoins
                consumptionStatus = 'unable';
            }

            return {
                consumptionShare,
                consumptionStatus,
                annualConsumption,
                annualProduction,
                netAvailable,
                yearlyImports,
                yearlyExports
            };
        } catch (error) {
            console.error('[CommerceSectionManager] Error calculating consumption status:', error);
            return {
                consumptionShare: 0,
                consumptionStatus: 'unable',
                annualConsumption: 0,
                annualProduction: 0,
                netAvailable: 0
            };
        }
    }

    generatePlaceholderGoodsData() {
        return [
            {
                id: 'wheat',
                name: 'Blé',
                sellingPrice: 15,
                buyingPrice: 5,  // Prix par défaut : 5€
                marketPrice: 14,
                marketShare: 45,
                marketPosition: 'normal',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel (8 paniers)
                // sellingMin supprimé
                buyingMax: 8,  // Seuil maximum d'achat annuel (8 paniers)
                // buyingMin supprimé
                tax: 10,
                consumptionShare: 60,
                consumptionStatus: 'able',
                yearlyImports: 0,  // Stats dynamiques
                yearlyExports: 0
            },
            {
                id: 'carrot',
                name: 'Carotte',
                sellingPrice: 18,
                buyingPrice: 15,
                marketPrice: 16,
                marketShare: 25,
                marketPosition: 'few',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 400,
                // buyingMin supprimé
                tax: 15,
                consumptionShare: 40,
                consumptionStatus: 'able',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'cabbage',
                name: 'Chou',
                sellingPrice: 20,
                buyingPrice: 17,
                marketPrice: 18,
                marketShare: 15,
                marketPosition: 'inferior',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 300,
                // buyingMin supprimé
                tax: 20,
                consumptionShare: 30,
                consumptionStatus: 'unable',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'wood',
                name: 'Bois',
                sellingPrice: 25,
                buyingPrice: 20,
                marketPrice: 22,
                marketShare: 70,
                marketPosition: 'dominant',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 1000,
                // buyingMin supprimé
                tax: 5,
                consumptionShare: 80,
                consumptionStatus: 'exceeding',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'dattes',
                name: 'Dattes',
                sellingPrice: 22,
                buyingPrice: 12,
                marketPrice: 16,
                marketShare: 5,
                marketPosition: 'inferior',
                stockpiling: false,
                sellingMax: 0,  // On n'exporte pas de dattes (produit exotique importé)
                buyingMax: 200,
                tax: 8,
                consumptionShare: 15,
                consumptionStatus: 'unable',
                yearlyImports: 0,
                yearlyExports: 0
            }
        ];
    }

    toggleGoodDetails(goodId) {
        const goodItem = document.querySelector(`[data-good-id="${goodId}"]`);
        const detailsPanel = goodItem?.querySelector('.commerce-good-details');

        if (!goodItem || !detailsPanel) return;

        if (this.selectedGood === goodId) {
            this.selectedGood = null;
            goodItem.classList.remove('active');
            detailsPanel.classList.remove('active');
        } else {
            if (this.selectedGood) {
                const prevItem = document.querySelector(`[data-good-id="${this.selectedGood}"]`);
                if (prevItem) {
                    prevItem.classList.remove('active');
                    prevItem.querySelector('.commerce-good-details')?.classList.remove('active');
                }
            }

            this.selectedGood = goodId;
            goodItem.classList.add('active');
            detailsPanel.classList.add('active');
        }
    }

    getPriceStatus(price, marketPrice, type) {
        const diff = Math.abs(price - marketPrice);
        const percentDiff = (diff / marketPrice) * 100;

        if (type === 'selling') {
            if (price < marketPrice * 0.7) return 'generous';
            if (price > marketPrice * 1.5) return 'unacceptable';
        } else if (type === 'buying') {
            if (price > marketPrice * 1.3) return 'generous';
            if (price < marketPrice * 0.5) return 'unacceptable';
        }

        return '';
    }

    getMarketPositionClass(marketShare) {
        if (marketShare >= 50) return 'dominant';
        if (marketShare >= 25) return 'normal';
        if (marketShare >= 10) return 'few';
        return 'inferior';
    }

    getConsumptionStatusClass(status) {
        return status || 'able';
    }

    getConsumptionStatusText(status) {
        const texts = {
            'unable': 'Incapable de répondre aux besoins',
            'able': 'Capable de répondre aux besoins',
            'exceeding': 'Dépasse largement ses besoins'
        };
        return texts[status] || texts['able'];
    }

    async render() {
        if (!this.goodsData) return;

        const goodsList = document.getElementById('commerce-goods-list');
        if (!goodsList) return;
        
        // Mettre à jour les statuts de consommation avant le rendu
        await this.updateConsumptionStatuses();
        
        // Ré-attacher les listeners après le rendu (le DOM est recréé)
        this.setupEventListeners();

        goodsList.innerHTML = this.goodsData.map(good => {
            const marketPositionClass = this.getMarketPositionClass(good.marketShare);
            const sellingStatus = this.getPriceStatus(good.sellingPrice, good.marketPrice, 'selling');
            const buyingStatus = this.getPriceStatus(good.buyingPrice, good.marketPrice, 'buying');
            const consumptionStatusClass = this.getConsumptionStatusClass(good.consumptionStatus);

            return `
                <div class="commerce-good-item ${marketPositionClass}" data-good-id="${good.id}">
                    <div class="commerce-good-name ${marketPositionClass}">${good.name}</div>
                    <div class="commerce-good-prices">
                        <div class="commerce-price-item">
                            <span class="commerce-price-label">Prix marché</span>
                            <span class="commerce-price-value market">${good.marketPrice} Dn</span>
                        </div>
                        <div class="commerce-price-item">
                            <span class="commerce-price-label">Prix vente</span>
                            <div class="commerce-price-control">
                                <button type="button" class="commerce-price-btn" data-good-id="${good.id}" data-type="selling" data-action="decrease" aria-label="Diminuer le prix de vente">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                        <path d="M5 12h14"/>
                                    </svg>
                                </button>
                                <input type="number" class="commerce-price-input selling ${sellingStatus}" id="selling-price-${good.id}" value="${good.sellingPrice}" min="0" step="1" data-good-id="${good.id}" data-type="selling">
                                <button type="button" class="commerce-price-btn" data-good-id="${good.id}" data-type="selling" data-action="increase" aria-label="Augmenter le prix de vente">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus">
                                        <path d="M5 12h14"/>
                                        <path d="M12 5v14"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="commerce-price-item">
                            <span class="commerce-price-label">Prix achat</span>
                            <div class="commerce-price-control">
                                <button type="button" class="commerce-price-btn" data-good-id="${good.id}" data-type="buying" data-action="decrease" aria-label="Diminuer le prix d'achat">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                        <path d="M5 12h14"/>
                                    </svg>
                                </button>
                                <input type="number" class="commerce-price-input buying ${buyingStatus}" id="buying-price-${good.id}" value="${good.buyingPrice}" min="0" step="1" data-good-id="${good.id}" data-type="buying">
                                <button type="button" class="commerce-price-btn" data-good-id="${good.id}" data-type="buying" data-action="increase" aria-label="Augmenter le prix d'achat">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus">
                                        <path d="M5 12h14"/>
                                        <path d="M12 5v14"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="commerce-good-market-share">
                        <span class="commerce-market-share-label">Part de marché</span>
                        <span class="commerce-market-share-value ${marketPositionClass}">${good.marketShare}%</span>
                    </div>

                    <div class="commerce-good-details" data-details-good-id="${good.id}">
                        <div class="commerce-details-section">
                            <div class="commerce-details-row">
                                <div class="commerce-switch-wrapper">
                                    <label class="commerce-switch">
                                        <input type="checkbox" class="commerce-switch-input" id="stockpiling-${good.id}" ${good.stockpiling ? 'checked' : ''} data-good-id="${good.id}">
                                        <span class="commerce-switch-slider"></span>
                                    </label>
                                    <span class="commerce-switch-label" id="stockpiling-label-${good.id}">
                                        ${good.stockpiling ? 'Libre circulation' : 'Stocker (aucun commerce)'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="commerce-details-section">
                            <div class="commerce-details-title">Seuils d'export</div>
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Maximum</div>
                                <div class="commerce-threshold-controls">
                                    <div class="commerce-threshold-buttons">
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-max" data-action="decrease" aria-label="Diminuer le maximum d'export">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                                <path d="M5 12h14"/>
                                            </svg>
                                        </button>
                                        <span class="commerce-threshold-value" id="selling-max-${good.id}">${good.sellingMax}</span>
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-max" data-action="increase" aria-label="Augmenter le maximum d'export">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus">
                                                <path d="M5 12h14"/>
                                                <path d="M12 5v14"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="commerce-details-section">
                            <div class="commerce-details-title">Seuils d'achat</div>
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Maximum</div>
                                <div class="commerce-threshold-controls">
                                    <div class="commerce-threshold-buttons">
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="buying-max" data-action="decrease" aria-label="Diminuer le maximum d'achat">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                                <path d="M5 12h14"/>
                                            </svg>
                                        </button>
                                        <span class="commerce-threshold-value" id="buying-max-${good.id}">${good.buyingMax}</span>
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="buying-max" data-action="increase" aria-label="Augmenter le maximum d'achat">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus">
                                                <path d="M5 12h14"/>
                                                <path d="M12 5v14"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="commerce-details-section">
                            <div class="commerce-details-title">Droit de douane</div>
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Taux d'imposition</div>
                                <div class="commerce-tax-control">
                                    <input type="number" class="commerce-tax-input" id="tax-${good.id}" min="0" max="500" value="${good.tax}" data-good-id="${good.id}">
                                    <span>%</span>
                                </div>
                            </div>
                        </div>

                        <div class="commerce-details-section">
                            <div class="commerce-details-title">Consommation de la ville</div>
                            <div class="commerce-details-row">
                                <div class="commerce-consumption-indicator ${consumptionStatusClass}">
                                    <span class="commerce-consumption-percentage">${good.consumptionShare}%</span>
                                    <span class="commerce-consumption-text ${consumptionStatusClass}">
                                        ${this.getConsumptionStatusText(good.consumptionStatus)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.setupDetailsEventListeners();
    }

    setupDetailsEventListeners() {
        const thresholdButtons = document.querySelectorAll('.commerce-threshold-btn');
        const taxInputs = document.querySelectorAll('.commerce-tax-input');
        const stockpilingCheckboxes = document.querySelectorAll('.commerce-switch-input');
        const priceButtons = document.querySelectorAll('.commerce-price-btn');
        const priceInputs = document.querySelectorAll('.commerce-price-input');

        thresholdButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const goodId = btn.dataset.goodId;
                const type = btn.dataset.type;
                const action = btn.dataset.action;
                this.adjustThreshold(goodId, type, action);
            });
        });

        taxInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const goodId = e.target.dataset.goodId;
                const tax = parseFloat(e.target.value) || 0;
                this.updateTax(goodId, tax);
            });
        });

        stockpilingCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const goodId = e.target.dataset.goodId;
                const stockpiling = e.target.checked;
                this.updateStockpiling(goodId, stockpiling);
                
                const labelElement = document.getElementById(`stockpiling-label-${goodId}`);
                if (labelElement) {
                    labelElement.textContent = stockpiling ? 'Libre circulation' : 'Stocker (aucun commerce)';
                }
            });
        });

        priceButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const goodId = btn.dataset.goodId;
                const type = btn.dataset.type;
                const action = btn.dataset.action;
                this.adjustPrice(goodId, type, action);
            });
        });

        priceInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const goodId = e.target.dataset.goodId;
                const type = e.target.dataset.type;
                const price = parseFloat(e.target.value) || 0;
                this.updatePrice(goodId, type, price);
            });
        });
    }

    adjustPrice(goodId, type, action) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (!good) return;

        const step = 1;
        const currentPrice = type === 'selling' ? good.sellingPrice : good.buyingPrice;
        const newPrice = action === 'increase' 
            ? currentPrice + step 
            : Math.max(0, currentPrice - step);

        if (type === 'selling') {
            good.sellingPrice = newPrice;
        } else {
            good.buyingPrice = newPrice;
        }

        const inputElement = document.getElementById(`${type}-price-${goodId}`);
        if (inputElement) {
            inputElement.value = newPrice;
            this.updatePriceStatus(goodId, type, newPrice, good.marketPrice);
        }

        // Sauvegarder dans le store
        commerceStore.saveConfig(this.goodsData);
    }

    updatePrice(goodId, type, price) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            if (type === 'selling') {
                good.sellingPrice = Math.max(0, price);
            } else {
                good.buyingPrice = Math.max(0, price);
            }
            this.updatePriceStatus(goodId, type, price, good.marketPrice);
            
            // Sauvegarder dans le store
            commerceStore.saveConfig(this.goodsData);
        }
    }

    updatePriceStatus(goodId, type, price, marketPrice) {
        const inputElement = document.getElementById(`${type}-price-${goodId}`);
        if (!inputElement) return;

        const status = this.getPriceStatus(price, marketPrice, type);
        inputElement.className = `commerce-price-input ${type} ${status}`;
    }

    adjustThreshold(goodId, type, action) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (!good) return;

        const step = 10;
        const currentValue = good[type] || 0;
        const newValue = action === 'increase' 
            ? currentValue + step 
            : Math.max(0, currentValue - step);

        good[type] = newValue;

        const valueElement = document.getElementById(`${type}-${goodId}`);
        if (valueElement) {
            valueElement.textContent = newValue;
        }

        // Sauvegarder dans le store
        commerceStore.saveConfig(this.goodsData);
    }

    updateTax(goodId, tax) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.tax = Math.max(0, Math.min(500, tax));
            // Sauvegarder dans le store
            commerceStore.saveConfig(this.goodsData);
        }
    }

    updateStockpiling(goodId, stockpiling) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.stockpiling = stockpiling;
            // Sauvegarder dans le store
            commerceStore.saveConfig(this.goodsData);
        }
    }
}

async function initCommerceSection() {
    const commerceSection = document.getElementById('admin-section-commerce');
    if (!commerceSection) return;

    const manager = new CommerceSectionManager();
    
    // Initialiser la configuration au démarrage (même si le panneau n'est pas ouvert)
    // Cela garantit que CommerceService peut trouver la config dès le début
    await manager.loadGoodsData();
    
    const observer = new MutationObserver(async () => {
        if (commerceSection.classList.contains('active')) {
            // Recharger les données à chaque activation (pour mettre à jour les stats dynamiques)
            await manager.loadGoodsData();
        }
    });

    observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

    // Initialiser si déjà actif
    if (commerceSection.classList.contains('active')) {
        await manager.init();
    } else {
        // Même si le panneau n'est pas actif, initialiser les event listeners et les tabs
        manager.setupEventListeners();
        manager.setupTabs();
        manager.loadPartnersData();
    }

    window.commerceSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommerceSection);
} else {
    initCommerceSection();
}

