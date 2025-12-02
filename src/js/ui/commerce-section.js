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
        document.addEventListener('click', (e) => {
            if (e.target.closest('.commerce-good-item') && !e.target.closest('.commerce-good-details')) {
                const goodItem = e.target.closest('.commerce-good-item');
                const goodId = goodItem.dataset.goodId;
                this.toggleGoodDetails(goodId);
            }
        });
    }

    async loadGoodsData() {
        this.goodsData = this.generatePlaceholderGoodsData();
        this.render();
    }

    generatePlaceholderGoodsData() {
        return [
            {
                id: 'wheat',
                name: 'Blé',
                sellingPrice: 15,
                buyingPrice: 12,
                marketPrice: 14,
                marketShare: 45,
                marketPosition: 'normal',
                stockpiling: false,
                sellingMax: 1000,
                sellingMin: 100,
                buyingMax: 500,
                buyingMin: 50,
                tax: 10,
                consumptionShare: 60,
                consumptionStatus: 'able'
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
                sellingMax: 800,
                sellingMin: 80,
                buyingMax: 400,
                buyingMin: 40,
                tax: 15,
                consumptionShare: 40,
                consumptionStatus: 'able'
            },
            {
                id: 'cabbage',
                name: 'Chou',
                sellingPrice: 20,
                buyingPrice: 17,
                marketPrice: 18,
                marketShare: 15,
                marketPosition: 'inferior',
                stockpiling: true,
                sellingMax: 600,
                sellingMin: 60,
                buyingMax: 300,
                buyingMin: 30,
                tax: 20,
                consumptionShare: 30,
                consumptionStatus: 'unable'
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
                sellingMax: 2000,
                sellingMin: 200,
                buyingMax: 1000,
                buyingMin: 100,
                tax: 5,
                consumptionShare: 80,
                consumptionStatus: 'exceeding'
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
                            <div class="commerce-details-title">Seuils de vente</div>
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Maximum</div>
                                <div class="commerce-threshold-controls">
                                    <div class="commerce-threshold-buttons">
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-max" data-action="decrease" aria-label="Diminuer le maximum de vente">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                                <path d="M5 12h14"/>
                                            </svg>
                                        </button>
                                        <span class="commerce-threshold-value" id="selling-max-${good.id}">${good.sellingMax}</span>
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-max" data-action="increase" aria-label="Augmenter le maximum de vente">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus">
                                                <path d="M5 12h14"/>
                                                <path d="M12 5v14"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Minimum</div>
                                <div class="commerce-threshold-controls">
                                    <div class="commerce-threshold-buttons">
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-min" data-action="decrease" aria-label="Diminuer le minimum de vente">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                                <path d="M5 12h14"/>
                                            </svg>
                                        </button>
                                        <span class="commerce-threshold-value" id="selling-min-${good.id}">${good.sellingMin}</span>
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="selling-min" data-action="increase" aria-label="Augmenter le minimum de vente">
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
                            <div class="commerce-details-row">
                                <div class="commerce-details-label">Minimum</div>
                                <div class="commerce-threshold-controls">
                                    <div class="commerce-threshold-buttons">
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="buying-min" data-action="decrease" aria-label="Diminuer le minimum d'achat">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus">
                                                <path d="M5 12h14"/>
                                            </svg>
                                        </button>
                                        <span class="commerce-threshold-value" id="buying-min-${good.id}">${good.buyingMin}</span>
                                        <button type="button" class="commerce-threshold-btn" data-good-id="${good.id}" data-type="buying-min" data-action="increase" aria-label="Augmenter le minimum d'achat">
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
    }

    updateTax(goodId, tax) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.tax = Math.max(0, Math.min(500, tax));
        }
    }

    updateStockpiling(goodId, stockpiling) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.stockpiling = stockpiling;
        }
    }
}

function initCommerceSection() {
    const commerceSection = document.getElementById('admin-section-commerce');
    if (!commerceSection) return;

    const manager = new CommerceSectionManager();
    
    const observer = new MutationObserver(() => {
        if (commerceSection.classList.contains('active')) {
            manager.init();
            observer.disconnect();
        }
    });

    observer.observe(commerceSection, { attributes: true, attributeFilter: ['class'] });

    if (commerceSection.classList.contains('active')) {
        manager.init();
        observer.disconnect();
    }

    window.commerceSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommerceSection);
} else {
    initCommerceSection();
}

