import commerceStore from '../stores/CommerceStore.js';

class CommerceSectionManager {
    constructor() {
        this.selectedGood = null;
        this.goodsData = null;
    }

    init() {
        this.setupEventListeners();
        this.loadGoodsData();
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
        
        this.render();
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

    render() {
        if (!this.goodsData) return;

        const goodsList = document.getElementById('commerce-goods-list');
        if (!goodsList) return;
        
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

function initCommerceSection() {
    const commerceSection = document.getElementById('admin-section-commerce');
    if (!commerceSection) return;

    const manager = new CommerceSectionManager();
    
    // Initialiser la configuration au démarrage (même si le panneau n'est pas ouvert)
    // Cela garantit que CommerceService peut trouver la config dès le début
    manager.loadGoodsData();
    
    const observer = new MutationObserver(() => {
        if (commerceSection.classList.contains('active')) {
            // Recharger les données à chaque activation (pour mettre à jour les stats dynamiques)
            manager.loadGoodsData();
        }
    });

    observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

    // Initialiser si déjà actif
    if (commerceSection.classList.contains('active')) {
        manager.init();
    } else {
        // Même si le panneau n'est pas actif, initialiser les event listeners
        manager.setupEventListeners();
    }

    window.commerceSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommerceSection);
} else {
    initCommerceSection();
}

