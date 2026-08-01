import { updateDisplayedFunds, getGameTime, getTimeInfo } from '../acl/appRuntime.js';
import {
  loadOrSeedCommercePartners,
  saveCommercePartners,
  loadCommerceStats,
  loadOrSeedCommerceConfig,
  saveCommerceConfig,
  clearCommercePersistence,
} from '../acl/commerce.js';
import { getCityEmploymentSummary } from '../acl/employment.js';
import { getCityTotalPopulation } from '../acl/housing.js';
import {
  listCommercializableWindmills,
  listSupplyMapBuildings,
  listWindmillSupplyViews,
  getAllFoodTraceabilityTransactions,
} from '../acl/supply.js';
import { getTreasuryBalance, getTreasurySnapshot, recordCommercialRouteFee, getCommercialRouteFee } from '../acl/accountingGame.js';
import {
    getPriceStatus as resolvePriceStatus,
    getContractStatus as resolvePartnerContractStatus,
    getProductStockKey,
    getProductDisplayName,
    evaluatePartnerActivationConditions,
    setCommercePartnerContractFinishedHandler,
} from '../acl/commerce.js';

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
                    // Setup refresh button when partners tab is opened
                    this.setupRefreshButton();
                    this.renderPartners().catch(error => {
                        console.error('[CommerceSectionManager] Error rendering partners:', error);
                    });
                }
            });
        });
    }

    /**
     * Setup refresh button for partners tab
     */
    setupRefreshButton() {
        const refreshBtn = document.getElementById('commerce-refresh-btn');
        if (!refreshBtn) return;

        // Remove existing listener by cloning the button
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', async () => {
            // Disable button during refresh
            newRefreshBtn.disabled = true;
            const originalHTML = newRefreshBtn.innerHTML;
            newRefreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Actualisation...';
            
            try {
                // Re-render partners to refresh all data (population, unemployment, stocks, etc.)
                await this.renderPartners();
                this.showPartnerMessage('Données actualisées avec succès', 'success');
            } catch (error) {
                console.error('[CommerceSectionManager] Error refreshing partners:', error);
                this.showPartnerMessage('Erreur lors de l\'actualisation', 'error');
            } finally {
                // Re-enable button
                newRefreshBtn.disabled = false;
                newRefreshBtn.innerHTML = originalHTML;
            }
        });
    }

    loadPartnersData() {
        this.partnersData = loadOrSeedCommercePartners();
    }


    /**
     * Check if windmills have sufficient stocks for partner's required products
     * @param {Object} partner - Partner object
     * @returns {Promise<Object>} { hasStocks: boolean, missingProducts: Array<string> }
     */
    async checkWindmillStocks(partner) {
        try {
            const allWindmills = await listWindmillSupplyViews();
            const commercializableWindmills = await listCommercializableWindmills();

            if (allWindmills.length === 0) {
                return { hasStocks: false, missingProducts: ['Aucun moulin construit'], noCommercializableWindmills: false };
            }

            if (commercializableWindmills.length === 0) {
                return { hasStocks: false, missingProducts: ['Commerce impossible : aucun moulin'], noCommercializableWindmills: true };
            }

            // Get products required for exports (partner imports from us)
            const requiredProducts = partner.imports.map(imp => imp.productId);
            const missingProducts = [];

            // Check each required product
            for (const productId of requiredProducts) {
                const stockKey = getProductStockKey(productId);
                if (!stockKey) continue;

                // Sum stocks from commercializable windmills only
                let totalStock = 0;
                for (const windmill of commercializableWindmills) {
                    const stocks = windmill.stocks || {};
                    totalStock += stocks[stockKey] || 0;
                }

                // For now, require at least 1 unit in stock (can be adjusted)
                if (totalStock < 1) {
                    const productName = getProductDisplayName(productId);
                    missingProducts.push(`${productName} (stock: ${totalStock})`);
                }
            }

            return {
                hasStocks: missingProducts.length === 0,
                missingProducts,
                noCommercializableWindmills: false
            };
        } catch (error) {
            console.error('[CommerceSectionManager] Error checking windmill stocks:', error);
            return { hasStocks: false, missingProducts: ['Erreur lors de la vérification'], noCommercializableWindmills: false };
        }
    }

    /**
     * Get current population
     * @returns {Promise<number>} Current population
     */
    async getCurrentPopulation() {
        try {
            return await getCityTotalPopulation();
        } catch (error) {
            console.error('[CommerceSectionManager] Error getting population:', error);
        }
        return 0;
    }

    /**
     * Get current unemployment percentage
     * @returns {Promise<number>} Unemployment percentage (0-100)
     */
    async getUnemploymentPercentage() {
        try {
            const summary = await getCityEmploymentSummary();
            return summary.unemploymentPercentage;
        } catch (error) {
            console.error('[CommerceSectionManager] Error calculating unemployment:', error);
            return 0;
        }
    }

    /**
     * Get current budget funds
     * @returns {Promise<number>} Current funds (can be negative)
     */
    async getCurrentFunds() {
        try {
            return await getTreasuryBalance();
        } catch (error) {
            console.error('[CommerceSectionManager] Error getting funds:', error);
            return 0;
        }
    }

    /**
     * Check if partner activation conditions are met
     * @param {Object} partner - Partner object
     * @returns {Promise<Object>} { canActivate: boolean, unmetConditions: Array<string> }
     */
    async checkPartnerActivationConditions(partner) {
        const [population, unemployment, stocksCheck] = await Promise.all([
            this.getCurrentPopulation(),
            this.getUnemploymentPercentage(),
            this.checkWindmillStocks(partner),
        ]);

        return evaluatePartnerActivationConditions({
            partner,
            activationConditions: partner.activationConditions,
            metrics: { population, unemployment, stocksCheck },
        });
    }

    /**
     * Activate partner (deactivation is automatic when contract finishes)
     * @param {string} partnerId - Partner ID
     * @returns {Promise<Object>} { success: boolean, newStatus: boolean|null, message: string }
     * Dependencies: localStorage
     */
    async activatePartner(partnerId) {
        const partner = this.partnersData.find(p => p.id === partnerId);
        if (!partner) {
            return { success: false, newStatus: null, message: 'Partenaire non trouvé' };
        }

        // Cannot activate if already active
        if (partner.isActive) {
            return { success: false, newStatus: true, message: 'Le partenaire est déjà actif' };
        }

        // Vérifier les conditions d'activation
        const conditionCheck = await this.checkPartnerActivationConditions(partner);
        if (!conditionCheck.canActivate) {
            const message = `Conditions non remplies : ${conditionCheck.unmetConditions.join(', ')}`;
            console.warn(`Cannot activate partner ${partnerId}: conditions not met`, conditionCheck.unmetConditions);
            return { success: false, newStatus: false, message };
        }

        // Conditions remplies, activer le partenaire
        // Note: La désactivation se fera automatiquement quand le contrat sera terminé
        
        // Pay commercial route fee (one-time payment to open commercial road)
        const commercialRouteFee = getCommercialRouteFee();
        try {
            const currentBudget = await getTreasurySnapshot();
            const timeInfo = currentBudget?.turn !== undefined ? getTimeInfo(currentBudget.turn) : null;
            const yearDisplay = timeInfo && timeInfo.year === 0 ? '0 JC' : timeInfo ? `${timeInfo.year} ap JC` : '';
            const monthName = timeInfo ? timeInfo.month || 'Mois' : 'Mois';
            const dateDisplay = `${monthName} ${yearDisplay}`;

            const breakdown = [{
                label: partner.name,
                quantity: 1,
                unitCost: commercialRouteFee,
                total: commercialRouteFee
            }];
            const description = `Route commerciale - ${dateDisplay} |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;

            const feeResult = await recordCommercialRouteFee(
                commercialRouteFee,
                description,
                partnerId
            );

                if (feeResult.skipped && feeResult.reason === 'duplicate_business_key') {
                    return {
                        success: false,
                        newStatus: partner.isActive,
                        message: 'La route commerciale pour ce partenaire est déjà ouverte',
                    };
                }
                
                // Update funds display if available
                updateDisplayedFunds(feeResult.budget.funds);
                
            } catch (error) {
                console.error('[CommerceSectionManager] Error paying commercial route fee:', error);
                return {
                    success: false,
                    newStatus: false,
                    message: 'Erreur lors du paiement de la commission négociants',
                };
            }

        partner.isActive = true;
        this.savePartnersData();
        return { 
            success: true, 
            newStatus: true, 
            message: `Partenaire activé avec succès. Route commerciale ouverte (${commercialRouteFee}€). Le contrat se terminera automatiquement une fois tous les exports/imports effectués.` 
        };
    }

    savePartnersData() {
        saveCommercePartners(this.partnersData);
    }

    /**
     * Show a message to the user about partner operations
     * @param {string} message - Message to display
     * @param {string} type - Message type ('success' or 'error')
     */
    showPartnerMessage(message, type = 'info') {
        // Create or get message container
        let messageContainer = document.getElementById('commerce-partner-message');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'commerce-partner-message';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 10000;
                max-width: 400px;
                font-size: 14px;
                font-weight: 500;
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(messageContainer);
        }

        // Set message and style based on type
        messageContainer.textContent = message;
        if (type === 'success') {
            messageContainer.style.background = '#d4edda';
            messageContainer.style.color = '#155724';
            messageContainer.style.borderLeft = '4px solid #28a745';
        } else if (type === 'error') {
            messageContainer.style.background = '#f8d7da';
            messageContainer.style.color = '#721c24';
            messageContainer.style.borderLeft = '4px solid #dc3545';
        } else {
            messageContainer.style.background = '#d1ecf1';
            messageContainer.style.color = '#0c5460';
            messageContainer.style.borderLeft = '4px solid #17a2b8';
        }

        // Show message
        messageContainer.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (messageContainer) {
                messageContainer.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (messageContainer) {
                        messageContainer.style.display = 'none';
                    }
                }, 300);
            }
        }, 5000);
    }

    /**
     * Render partners list with activation controls
     * Dependencies: commerceStore
     */
    async renderPartners() {
        const partnersList = document.getElementById('commerce-partners-list');
        if (!partnersList) return;

        // Reload partners data from store to get latest currentOccurrences values
        // This ensures we display the most up-to-date trade statistics
        this.loadPartnersData();

        if (!this.partnersData) return;

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

        const stats = loadCommerceStats();
        const yearlyExports = stats?.yearlyExports || {};
        const yearlyImports = stats?.yearlyImports || {};

        // Check if there are any commercializable windmills
        let hasCommercializableWindmills = false;
        try {
            const commercializableWindmills = await listCommercializableWindmills();
            hasCommercializableWindmills = commercializableWindmills.length > 0;
        } catch (error) {
            console.warn('[CommerceSection] Error checking commercializable windmills:', error);
        }

        // Render partners HTML first
        partnersList.innerHTML = this.partnersData.map(partner => {
            const importsHTML = partner.imports.map(imp => {
                const monthsNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                const monthsText = imp.months.map(m => monthsNames[m]).join(', ');
                const isContractFinished = (imp.currentOccurrences || 0) >= imp.maxOccurrences;
                
                const productConfig = this.goodsData?.find(g => g.id === imp.productId);
                const internalLimit = productConfig?.sellingMax || 0;
                const currentYearly = yearlyExports[imp.productId] || 0;
                const isInternalLimitReached = currentYearly >= internalLimit;
                
                // Product is unavailable if contract is finished OR internal limit is reached OR no commercializable windmills
                const isUnavailable = isContractFinished || isInternalLimitReached || !hasCommercializableWindmills;
                
                const statusClass = isContractFinished ? 'contract-finished' : (isInternalLimitReached ? 'limit-reached' : (!hasCommercializableWindmills ? 'no-windmill' : 'active'));
                const statusText = isContractFinished ? '✅ Contrat terminé' : 
                                  isInternalLimitReached ? 'Seuil interne dépassé' : 
                                  !hasCommercializableWindmills ? 'Commerce impossible : aucun moulin' : 'Contrat actif';
                
                return `
                    <div class="partner-trade-item ${statusClass} ${isUnavailable ? 'unavailable' : ''}">
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
                                <span class="detail-label">Exports effectués:</span>
                                <span class="detail-value ${isContractFinished ? 'contract-finished' : ''}">${imp.currentOccurrences || 0}/${imp.maxOccurrences}</span>
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
                const isContractFinished = (exp.currentOccurrences || 0) >= exp.maxOccurrences;
                
                const productConfig = this.goodsData?.find(g => g.id === exp.productId);
                const internalLimit = productConfig?.buyingMax || 0;
                const currentYearly = yearlyImports[exp.productId] || 0;
                const isInternalLimitReached = currentYearly >= internalLimit;
                
                // Product is unavailable if contract is finished OR internal limit is reached OR no commercializable windmills
                const isUnavailable = isContractFinished || isInternalLimitReached || !hasCommercializableWindmills;
                
                const statusClass = isContractFinished ? 'contract-finished' : (isInternalLimitReached ? 'limit-reached' : (!hasCommercializableWindmills ? 'no-windmill' : 'active'));
                const statusText = isContractFinished ? '✅ Contrat terminé' : 
                                  isInternalLimitReached ? 'Seuil interne dépassé' : 
                                  !hasCommercializableWindmills ? 'Commerce impossible : aucun moulin' : 'Contrat actif';
                
                return `
                    <div class="partner-trade-item ${statusClass} ${isUnavailable ? 'unavailable' : ''}">
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
                                <span class="detail-label">Imports effectués:</span>
                                <span class="detail-value ${isContractFinished ? 'contract-finished' : ''}">${exp.currentOccurrences || 0}/${exp.maxOccurrences}</span>
                            </div>
                            <div class="partner-trade-detail">
                                <span class="detail-label">Seuil interne:</span>
                                <span class="detail-value ${isInternalLimitReached ? 'limit-reached' : ''}">${currentYearly}/${internalLimit}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Get contract status (which products have finished contracts)
            const contractStatus = resolvePartnerContractStatus(partner);
            const hasActiveContract = contractStatus.hasActiveContract;
            const hasFinishedProducts = contractStatus.finishedImports.length > 0 || contractStatus.finishedExports.length > 0;

            // Build finished products list
            let finishedProductsHTML = '';
            if (hasFinishedProducts && partner.isActive) {
                const finishedProductsList = [];
                contractStatus.finishedImports.forEach(imp => {
                    finishedProductsList.push(`✅ ${imp.productName} (export terminé: ${imp.currentOccurrences}/${imp.maxOccurrences})`);
                });
                contractStatus.finishedExports.forEach(exp => {
                    finishedProductsList.push(`✅ ${exp.productName} (import terminé: ${exp.currentOccurrences}/${exp.maxOccurrences})`);
                });
                
                if (finishedProductsList.length > 0) {
                    finishedProductsHTML = `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(133, 100, 4, 0.2);">
                            <div style="font-size: 12px; font-weight: 600; color: #856404; margin-bottom: 4px;">Contrats terminés par denrée:</div>
                            <div style="font-size: 12px; color: #856404;">
                                ${finishedProductsList.map(p => `<div>• ${p}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }
            }

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
                        ${partner.isActive ? `
                            <div class="partner-contract-info" style="background: ${hasActiveContract ? '#fff3cd' : '#d1ecf1'}; padding: 10px; border-radius: 6px; margin: 10px 0; border-left: 4px solid ${hasActiveContract ? '#ffc107' : '#17a2b8'};">
                                <div style="font-weight: 600; color: ${hasActiveContract ? '#856404' : '#0c5460'}; margin-bottom: 5px;">
                                    ${hasActiveContract ? '⚠️ Contrat en cours' : '✅ Tous les contrats sont terminés'}
                                </div>
                                <div style="font-size: 13px; color: ${hasActiveContract ? '#856404' : '#0c5460'};">
                                    ${hasActiveContract 
                                        ? 'Le contrat est actif. Certaines denrées peuvent avoir leur contrat terminé (voir ci-dessous), mais le partenaire reste actif tant qu\'au moins une denrée a un contrat actif. Une fois TOUTES les denrées terminées, le partenaire sera désactivé automatiquement. Vous ne pouvez pas le désactiver manuellement.'
                                        : 'Tous les contrats de toutes les denrées sont terminés. Le partenaire sera désactivé automatiquement lors du prochain tour.'}
                                </div>
                                ${finishedProductsHTML}
                            </div>
                        ` : ''}
                        ${!partner.isActive ? `
                            <button class="partner-activation-btn"
                                    id="activation-btn-${partner.id}"
                                    data-partner-id="${partner.id}"
                                    data-partner-active="false"
                                    disabled>
                                Conclure un contrat
                            </button>
                        ` : ''}
                        <div class="partner-activation-conditions" id="conditions-${partner.id}">
                            <span class="conditions-label">Conditions d'activation:</span>
                            <span class="conditions-value" id="conditions-value-${partner.id}">Vérification...</span>
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

        // Load and display activation conditions for each partner (async)
        // Also enable/disable activation button based on conditions
        for (const partner of this.partnersData) {
            const conditionsEl = document.getElementById(`conditions-value-${partner.id}`);
            const activationBtn = document.getElementById(`activation-btn-${partner.id}`);
            
            if (conditionsEl) {
                try {
                    const conditionCheck = await this.checkPartnerActivationConditions(partner);
                    const canActivate = conditionCheck.unmetConditions.length === 0;
                    
                    if (canActivate) {
                        conditionsEl.textContent = '✅ Toutes les conditions sont remplies';
                        conditionsEl.style.color = '#28a745';
                    } else {
                        conditionsEl.textContent = conditionCheck.unmetConditions.join(' | ');
                        conditionsEl.style.color = '#dc3545';
                    }
                    
                    // Enable/disable activation button based on conditions
                    if (activationBtn && !partner.isActive) {
                        activationBtn.disabled = !canActivate;
                    }
                } catch (error) {
                    console.error(`[CommerceSectionManager] Error loading conditions for ${partner.id}:`, error);
                    conditionsEl.textContent = 'Erreur lors de la vérification';
                    conditionsEl.style.color = '#dc3545';
                    
                    // Disable button on error
                    if (activationBtn && !partner.isActive) {
                        activationBtn.disabled = true;
                    }
                }
            }
        }
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
        this.clickHandler = async (e) => {
            // Gérer les clics sur les boutons d'activation des partenaires
            const activationBtn = e.target.closest('.partner-activation-btn');
            if (activationBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                const partnerId = activationBtn.dataset.partnerId;
                const isCurrentlyActive = activationBtn.dataset.partnerActive === 'true';
                
                // Only allow activation (deactivation is automatic)
                if (isCurrentlyActive) {
                    this.showPartnerMessage('Les partenaires actifs ne peuvent pas être désactivés manuellement. Le partenaire sera désactivé automatiquement à la fin du contrat.', 'info');
                    return;
                }
                
                // Check if button is disabled (conditions not met)
                if (activationBtn.disabled) {
                    this.showPartnerMessage('Les conditions d\'activation ne sont pas encore remplies.', 'info');
                    return;
                }
                
                // Disable button during processing
                activationBtn.disabled = true;
                activationBtn.textContent = 'Activation...';
                
                try {
                    const result = await this.activatePartner(partnerId);
                    
                    if (result.success) {
                        // Success - re-render partners
                        await this.renderPartners();
                        
                        // Show success message
                        this.showPartnerMessage(result.message, 'success');
                    } else {
                        // Failure - show error message
                        this.showPartnerMessage(result.message, 'error');
                        
                        // Re-enable button if conditions are still met
                        const partner = this.partnersData.find(p => p.id === partnerId);
                        if (partner && !partner.isActive) {
                            const conditionCheck = await this.checkPartnerActivationConditions(partner);
                            activationBtn.disabled = conditionCheck.unmetConditions.length > 0;
                            activationBtn.textContent = 'Conclure un contrat';
                        }
                    }
                } catch (error) {
                    console.error('[CommerceSectionManager] Error activating partner:', error);
                    this.showPartnerMessage('Erreur lors de l\'activation', 'error');
                    
                    // Re-enable button if conditions are still met
                    const partner = this.partnersData.find(p => p.id === partnerId);
                    if (partner && !partner.isActive) {
                        const conditionCheck = await this.checkPartnerActivationConditions(partner);
                        activationBtn.disabled = conditionCheck.unmetConditions.length > 0;
                        activationBtn.textContent = 'Conclure un contrat';
                    }
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
        this.goodsData = loadOrSeedCommerceConfig();
        
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

        for (const good of this.goodsData) {
            if (['wheat', 'carrot', 'cabbage'].includes(good.id)) {
                const status = await this.calculateConsumptionStatus(good.id);
                good.consumptionShare = status.consumptionShare;
                good.consumptionStatus = status.consumptionStatus;
            }
        }

        // Sauvegarder la configuration mise à jour
        saveCommerceConfig(this.goodsData);
    }

    /**
     * Charge les statistiques dynamiques depuis le store (écrites par CommerceService)
     */
    loadDynamicStats() {
        const stats = loadCommerceStats();
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
     * @returns {Promise<Object>} { consumptionShare, consumptionStatus, annualConsumption, annualProduction, netAvailable }
     */
    async calculateConsumptionStatus(productId) {
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
            const allTransactions = await getAllFoodTraceabilityTransactions();
            let currentYear = 0;
            const gameTime = getGameTime();
            const timeInfo = getTimeInfo(gameTime);
            if (timeInfo && timeInfo.year !== undefined) {
                currentYear = timeInfo.year;
            } else if (allTransactions.length > 0) {
                currentYear = Math.max(...allTransactions.map(t => t.year || 0));
            }

            const consumptionTransactions = allTransactions.filter(t =>
                t.transactionType === 'house_consumption' &&
                t.foodType === productId &&
                t.year === currentYear
            );

            annualConsumption = consumptionTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0);

            // Si pas de données de traçabilité, estimer depuis la population
            if (annualConsumption === 0) {
                const totalPopulation = await getCityTotalPopulation();
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
            const allBuildings = await listSupplyMapBuildings();
            const farmTypeMap = {
                wheat: ['Farm-Wheat', 'Farms-Wheat'],
                carrot: ['Farm-Carrot', 'Farms-Carrot'],
                cabbage: ['Farm-Cabbage', 'Farms-Cabbage'],
            };
            const farmTypes = farmTypeMap[productId] || [];

            const farms = allBuildings.filter((building) => {
                if (building.kind !== 'farm' || !building.type) return false;
                return (
                    farmTypes.some((type) => building.type === type) ||
                    (building.type.includes('Farm') &&
                        building.type.toLowerCase().includes(productId))
                );
            });

            // Chaque ferme produit 78 paniers/an
            annualProduction = farms.length * 78;

            // 3. Récupérer les imports/exports actuels
            const stats = loadCommerceStats();
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
            const sellingStatus = resolvePriceStatus(good.sellingPrice, good.marketPrice, 'selling');
            const buyingStatus = resolvePriceStatus(good.buyingPrice, good.marketPrice, 'buying');
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
        saveCommerceConfig(this.goodsData);
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
            saveCommerceConfig(this.goodsData);
        }
    }

    updatePriceStatus(goodId, type, price, marketPrice) {
        const inputElement = document.getElementById(`${type}-price-${goodId}`);
        if (!inputElement) return;

        const status = resolvePriceStatus(price, marketPrice, type);
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
        saveCommerceConfig(this.goodsData);
    }

    updateTax(goodId, tax) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.tax = Math.max(0, Math.min(500, tax));
            // Sauvegarder dans le store
            saveCommerceConfig(this.goodsData);
        }
    }

    updateStockpiling(goodId, stockpiling) {
        if (!this.goodsData) return;

        const good = this.goodsData.find(g => g.id === goodId);
        if (good) {
            good.stockpiling = stockpiling;
            // Sauvegarder dans le store
            saveCommerceConfig(this.goodsData);
        }
    }
}

async function initCommerceSection() {
    const commerceSection = document.getElementById('admin-section-commerce');
    if (!commerceSection) return;

    const manager = new CommerceSectionManager();

    setCommercePartnerContractFinishedHandler(({ partnerName, finishedProducts }) => {
        const productsText = finishedProducts.length > 0
            ? finishedProducts.join(', ')
            : 'toutes les denrées';
        manager.showPartnerMessage(
            `Contrat terminé avec ${partnerName} (${productsText}). Le partenaire a été désactivé automatiquement.`,
            'info'
        );
        manager.loadPartnersData();
        manager.renderPartners().catch((error) => {
            console.error('[CommerceSectionManager] Error rendering partners after contract finish:', error);
        });
    });
    
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

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommerceSection);
} else {
    initCommerceSection();
}

