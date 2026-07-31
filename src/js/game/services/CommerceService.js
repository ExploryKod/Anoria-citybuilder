import { SimService } from './SimService.js';
import commerceStore from '../../stores/CommerceStore.js';
import { instanceIdFromHouseRow } from '../../acl/building-identity.js';
import { recordImportExpense, recordExportIncome } from '../../acl/accountingGame.js';
import {
    listCommercializableWindmills,
    getSupplyBuildingRow,
    updateSupplyBuildingFields,
    listWindmillSupplyViews,
} from '../../acl/supply.js';

const STOCKABLE_PRODUCTS = ['wheat', 'carrot', 'cabbage', 'wood', 'dattes'];
const ALL_PRODUCTS = ['wheat', 'carrot', 'cabbage', 'wood', 'dattes'];

const DEFAULT_CONDITIONS = {
    import: {
        requiresStock: false,
        requiresWindmill: false
    },
    export: {
        requiresStock: true,
        requiresWindmill: false
    }
};

const PRODUCT_CONDITIONS = {
    wheat: {
        import: { requiresStock: false, requiresWindmill: false },
        export: { requiresStock: true, requiresWindmill: true }
    },
    carrot: {
        import: { requiresStock: false, requiresWindmill: false },
        export: { requiresStock: true, requiresWindmill: true }
    },
    cabbage: {
        import: { requiresStock: false, requiresWindmill: false },
        export: { requiresStock: true, requiresWindmill: true }
    },
    wood: {
        import: { requiresStock: false, requiresWindmill: true },
        export: { requiresStock: false, requiresWindmill: false }
    },
    dattes: {
        import: { requiresStock: false, requiresWindmill: false },
        export: { requiresStock: true, requiresWindmill: true }
    }
};

export class CommerceService extends SimService {
    constructor() {
        super();
        this.yearlyImports = {};
        this.yearlyExports = {};
        this.lastProcessedYear = -1;
        this.lastResetMonth = -1;
        this.partnersData = null;
    }

    loadPartners() {
        this.partnersData = commerceStore.loadPartners();
        if (!this.partnersData && typeof window !== 'undefined' && window.commerceSectionManager) {
            if (window.commerceSectionManager.partnersData) {
                this.partnersData = window.commerceSectionManager.partnersData;
                commerceStore.savePartners(this.partnersData);
            }
        }
        return this.partnersData;
    }

    getPartner(partnerId) {
        if (!this.partnersData) this.loadPartners();
        if (!this.partnersData) return null;
        return this.partnersData.find(p => p.id === partnerId) || null;
    }

    /**
     * Check if trading with partner is allowed
     * @param {string} partnerId - Partner ID
     * @param {string} productId - Product ID
     * @param {string} operation - 'import' or 'export'
     * @param {number} time - Current game turn
     * @returns {boolean} True if trading is allowed
     * Dependencies: TimeManager (global), partnersData
     */
    canTradeWithPartner(partnerId, productId, operation, time) {
        const partner = this.getPartner(partnerId);
        if (!partner) return false;

        // Vérifier que la relation commerciale est active
        if (!partner.isActive) {
            return false;
        }

        const globalObj = typeof window !== 'undefined' ? window : global;
        const timeInfo = globalObj.TimeManager.getTimeInfo(time);
        const currentMonth = timeInfo.monthIndex;

        if (operation === 'export') {
            const trade = partner.imports.find(imp => imp.productId === productId);
            if (!trade) return false;
            
            if (!trade.months.includes(currentMonth)) return false;
            if (trade.currentOccurrences >= trade.maxOccurrences) return false;

            
            return true;
        } else if (operation === 'import') {
            const trade = partner.exports.find(exp => exp.productId === productId);
            if (!trade) return false;
            
            if (!trade.months.includes(currentMonth)) return false;
            if (trade.currentOccurrences >= trade.maxOccurrences) return false;
            
            return true;
        }

        return false;
    }

    /**
     * Check if partner contract is completely finished
     * A contract is finished when ALL products (both imports AND exports) have reached their maxOccurrences
     * 
     * Important: A single product can have its contract finished, but the partner remains active
     * as long as at least one product still has an active contract.
     * The partner is only deactivated when ALL products have finished contracts.
     * 
     * @param {Object} partner - Partner object
     * @returns {boolean} True if ALL contracts for ALL products are finished
     */
    isContractFinished(partner) {
        if (!partner || !partner.isActive) return false;

        const hasImports = partner.imports && partner.imports.length > 0;
        const hasExports = partner.exports && partner.exports.length > 0;

        // If partner has no trades configured, contract cannot be finished
        if (!hasImports && !hasExports) {
            return false;
        }

        // Check if ALL imports (our exports to partner) have reached maxOccurrences
        // Each import represents a product we export to the partner
        const allImportsFinished = hasImports 
            ? partner.imports.every(imp => (imp.currentOccurrences || 0) >= imp.maxOccurrences)
            : true; // No imports means this part is "finished"

        // Check if ALL exports (our imports from partner) have reached maxOccurrences
        // Each export represents a product we import from the partner
        const allExportsFinished = hasExports
            ? partner.exports.every(exp => (exp.currentOccurrences || 0) >= exp.maxOccurrences)
            : true; // No exports means this part is "finished"

        // Contract is completely finished only if ALL products (both imports AND exports) are finished
        // This means: all exports we make to them are done AND all imports we get from them are done
        return allImportsFinished && allExportsFinished;
    }

    /**
     * Automatically deactivate partner if contract is finished
     * A contract is finished when ALL products (imports AND exports) have reached their maxOccurrences
     * @param {string} partnerId - Partner ID
     * @returns {boolean} True if partner was deactivated
     */
    checkAndDeactivateFinishedContract(partnerId) {
        const partner = this.getPartner(partnerId);
        if (!partner || !partner.isActive) return false;

        if (this.isContractFinished(partner)) {
            const partnerName = partner.name || partnerId;
            
            // Build list of finished products for the message
            const finishedProducts = [];
            partner.imports.forEach(imp => {
                if ((imp.currentOccurrences || 0) >= imp.maxOccurrences) {
                    finishedProducts.push(`${imp.productName || imp.productId} (export)`);
                }
            });
            partner.exports.forEach(exp => {
                if ((exp.currentOccurrences || 0) >= exp.maxOccurrences) {
                    finishedProducts.push(`${exp.productName || exp.productId} (import)`);
                }
            });
            
            partner.isActive = false;
            commerceStore.savePartners(this.partnersData);
            
            // Notify UI if available (use setTimeout to avoid blocking)
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    if (window.commerceSectionManager) {
                        const message = finishedProducts.length > 0
                            ? `✅ Tous les contrats avec ${partnerName} sont terminés (${finishedProducts.join(', ')}). Le partenaire a été désactivé automatiquement.`
                            : `✅ Tous les contrats avec ${partnerName} sont terminés. Le partenaire a été désactivé automatiquement.`;
                        
                        window.commerceSectionManager.showPartnerMessage(message, 'info');
                        
                        // Refresh partners display
                        if (typeof window.commerceSectionManager.renderPartners === 'function') {
                            window.commerceSectionManager.renderPartners().catch(err => {
                                console.error('[CommerceService] Error refreshing partners display:', err);
                            });
                        }
                    }
                }, 100);
            }
            
            return true;
        }

        return false;
    }

    updatePartnerTrade(partnerId, productId, operation) {
        const partner = this.getPartner(partnerId);
        if (!partner) return false;

        if (operation === 'export') {
            const trade = partner.imports.find(imp => imp.productId === productId);
            if (trade) {
                trade.currentOccurrences = (trade.currentOccurrences || 0) + 1;
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                commerceStore.savePartners(this.partnersData);
                
                // Check if contract is finished after this trade
                this.checkAndDeactivateFinishedContract(partnerId);
                
                return true;
            }
        } else if (operation === 'import') {
            const trade = partner.exports.find(exp => exp.productId === productId);
            if (trade) {
                trade.currentOccurrences = (trade.currentOccurrences || 0) + 1;
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                commerceStore.savePartners(this.partnersData);
                
                // Check if contract is finished after this trade
                this.checkAndDeactivateFinishedContract(partnerId);
                
                return true;
            }
        }

        return false;
    }

    getPartnerTradeLimit(partnerId, productId, operation) {
        const partner = this.getPartner(partnerId);
        if (!partner) return null;

        if (operation === 'export') {
            const trade = partner.imports.find(imp => imp.productId === productId);
            if (trade) {
                return {
                    maxPerTurn: trade.maxPerTurn,
                    maxOccurrences: trade.maxOccurrences,
                    currentOccurrences: trade.currentOccurrences || 0
                };
            }
        } else if (operation === 'import') {
            const trade = partner.exports.find(exp => exp.productId === productId);
            if (trade) {
                return {
                    maxPerTurn: 1,
                    maxOccurrences: trade.maxOccurrences,
                    currentOccurrences: trade.currentOccurrences || 0
                };
            }
        }

        return null;
    }

    getProductConfig(productId) {
        const config = commerceStore.getProductConfig(productId);
        if (config) return config;
        
        if (typeof window !== 'undefined' && window.commerceSectionManager?.goodsData) {
            const good = window.commerceSectionManager.goodsData.find(g => g.id === productId);
            if (good) {
                commerceStore.saveConfig(window.commerceSectionManager.goodsData);
                return good;
            }
        }
        return null;
    }

    isStockable(productId) {
        return STOCKABLE_PRODUCTS.includes(productId);
    }

    getStockKey(productId) {
        if (!this.isStockable(productId)) return null;
        return productId;
    }

    getConditions(productId, operation) {
        return PRODUCT_CONDITIONS[productId]?.[operation] || DEFAULT_CONDITIONS[operation];
    }

    canImportProduct(productId, quantity, conditions = null) {
        const config = this.getProductConfig(productId);
        if (!config) return false;
        
        if (config.stockpiling) return false;
        
        const currentYearly = this.yearlyImports[productId] || 0;
        const buyingMax = config.buyingMax || 0;
        
        if ((currentYearly + quantity) > buyingMax) return false;
        
        const conds = conditions || this.getConditions(productId, 'import');
        // requiresStock means we need existing stock in windmill to import (for activation conditions)
        // For imports, if requiresStock is true, we need to check if windmill has stock
        // But this is only for activation conditions, not for blocking imports
        // So we don't block imports here based on requiresStock
        
        return true;
    }

    canExportProduct(productId, quantity, availableStock, conditions = null) {
        const config = this.getProductConfig(productId);
        if (!config) return false;
        
        if (config.stockpiling) return false;
        
        const currentYearly = this.yearlyExports[productId] || 0;
        const sellingMax = config.sellingMax || 0;
        
        if ((currentYearly + quantity) > sellingMax) return false;
        
        const conds = conditions || this.getConditions(productId, 'export');
        if (conds.requiresStock && availableStock < quantity) {
            return false;
        }
        
        return true;
    }

    async getTotalWindmillStock(productId) {
        if (!this.isStockable(productId)) return 0;

        try {
            const windmills = await this.getCommercializableWindmills();
            const stockKey = this.getStockKey(productId);
            if (!stockKey) return 0;

            let totalStock = 0;
            for (const windmill of windmills) {
                const stocks = windmill.stocks || {};
                if (stocks[stockKey]) {
                    totalStock += stocks[stockKey] || 0;
                }
            }

            return totalStock;
        } catch (error) {
            console.warn(`[CommerceService] Error getting windmill stock for ${productId}:`, error);
            return 0;
        }
    }

    /** @returns {Promise<Array>} Commercializable windmill supply views. */
    async getCommercializableWindmills() {
        try {
            return listCommercializableWindmills();
        } catch (error) {
            console.warn('[CommerceService] Error getting commercializable windmills:', error);
            return [];
        }
    }

    async addToWindmillStock(productId, quantity, partnerId = null) {
        if (quantity <= 0 || !this.isStockable(productId)) return null;

        try {
            const windmills = await this.getCommercializableWindmills();

            if (windmills.length === 0) {
                console.warn('[CommerceService] No commercializable windmills available for import');
                return null;
            }

            const stockKey = this.getStockKey(productId);
            if (!stockKey) return null;

            const firstWindmill = windmills[0];
            const windmillId = instanceIdFromHouseRow(firstWindmill);
            const windmillData = await getSupplyBuildingRow(windmillId);
            if (!windmillData) {
                console.warn(`[CommerceService] Windmill not found: ${windmillId}`);
                return null;
            }

            const stocks = windmillData.stocks || {};
            const isFood = productId !== 'wood';
            const updatedStocks = {
                ...stocks,
                [stockKey]: (stocks[stockKey] || 0) + quantity,
                food: isFood ? (stocks.food || 0) + quantity : (stocks.food || 0),
            };

            const existingLastImport = windmillData.lastImport || {};
            const lastImport = {
                ...existingLastImport,
                [stockKey]: (existingLastImport[stockKey] || 0) + quantity,
                total: (existingLastImport.total || 0) + quantity,
            };

            const existingLastImportDetails = windmillData.lastImportDetails || {};
            const lastImportDetails = { ...existingLastImportDetails };

            if (partnerId) {
                const partner = this.getPartner(partnerId);
                const partnerName = partner ? partner.name : partnerId;

                if (!lastImportDetails[stockKey]) {
                    lastImportDetails[stockKey] = [];
                }

                const existingPartnerIndex = lastImportDetails[stockKey].findIndex(
                    (p) => p.partnerId === partnerId
                );

                if (existingPartnerIndex >= 0) {
                    lastImportDetails[stockKey][existingPartnerIndex].quantity += quantity;
                } else {
                    lastImportDetails[stockKey].push({
                        partnerId,
                        partnerName,
                        quantity,
                    });
                }
            }

            await updateSupplyBuildingFields(windmillId, {
                stocks: updatedStocks,
                lastImport,
                lastImportDetails,
            });

            return { windmillId, addedQuantity: quantity };
        } catch (error) {
            console.warn(`[CommerceService] Error adding to windmill stock for ${productId}:`, error);
            return null;
        }
    }

    async reduceWindmillStock(productId, quantity, partnerId = null) {
        if (quantity <= 0 || !this.isStockable(productId)) return false;

        try {
            const windmills = await this.getCommercializableWindmills();

            if (windmills.length === 0) {
                console.warn('[CommerceService] No commercializable windmills available for export');
                return false;
            }

            const stockKey = this.getStockKey(productId);
            if (!stockKey) return false;

            let remaining = quantity;

            for (const windmill of windmills) {
                if (remaining <= 0) break;

                const windmillId = instanceIdFromHouseRow(windmill);
                const row = await getSupplyBuildingRow(windmillId);
                const stocks = row?.stocks || windmill.stocks || {};
                const currentStock = stocks[stockKey] || 0;

                if (currentStock > 0) {
                    const toReduce = Math.min(remaining, currentStock);
                    const newStock = currentStock - toReduce;
                    remaining -= toReduce;

                    const isFood = productId !== 'wood';
                    const updatedStocks = {
                        ...stocks,
                        [stockKey]: newStock,
                        food: isFood
                            ? Math.max(0, (stocks.food || 0) - toReduce)
                            : stocks.food || 0,
                    };

                    if (partnerId) {
                        const existingLastExportDetails = row?.lastExportDetails || {};
                        const lastExportDetails = { ...existingLastExportDetails };

                        if (!lastExportDetails[stockKey]) {
                            lastExportDetails[stockKey] = [];
                        }

                        const partner = this.getPartner(partnerId);
                        const partnerName = partner ? partner.name : partnerId;
                        const existingPartnerIndex = lastExportDetails[stockKey].findIndex(
                            (p) => p.partnerId === partnerId
                        );

                        if (existingPartnerIndex >= 0) {
                            lastExportDetails[stockKey][existingPartnerIndex].quantity += toReduce;
                        } else {
                            lastExportDetails[stockKey].push({
                                partnerId,
                                partnerName,
                                quantity: toReduce,
                            });
                        }

                        await updateSupplyBuildingFields(windmillId, {
                            stocks: updatedStocks,
                            lastExportDetails,
                        });
                    } else {
                        await updateSupplyBuildingFields(windmillId, { stocks: updatedStocks });
                    }
                }
            }

            return remaining === 0;
        } catch (error) {
            console.warn(`[CommerceService] Error reducing windmill stock for ${productId}:`, error);
            return false;
        }
    }

    async processProductImport({ productId, time, quantity = 1, conditions = null, partnerId = null }) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        if (partnerId) {
            if (!this.canTradeWithPartner(partnerId, productId, 'import', time)) {
                return null;
            }
            const partnerLimit = this.getPartnerTradeLimit(partnerId, productId, 'import');
            if (partnerLimit && quantity > partnerLimit.maxPerTurn) {
                quantity = partnerLimit.maxPerTurn;
            }
        }

        if (!this.canImportProduct(productId, quantity, conditions)) {
            return null;
        }

        const pricePerUnit = config.buyingPrice || 5;
        const totalCost = quantity * pricePerUnit;

        const partner = partnerId ? this.getPartner(partnerId) : null;
        const partnerName = partner ? partner.name : null;

        // Créer le breakdown pour le journal (comme la maintenance)
        let description = `Import ${productId}`;
        if (partnerName) {
            const breakdown = [{
                label: partnerName,
                quantity: quantity,
                unitCost: pricePerUnit,
                total: totalCost
            }];
            description += ` |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;
        } else {
            description += ` (${quantity} panier × ${pricePerUnit}€)`;
        }

        await recordImportExpense(totalCost, description, productId, partnerId);

        if (partnerId) {
            this.updatePartnerTrade(partnerId, productId, 'import');
        }

        let stockAdded = false;
        if (this.isStockable(productId)) {
            const stockResult = await this.addToWindmillStock(productId, quantity, partnerId);
            stockAdded = stockResult !== null;
        }

        this.yearlyImports[productId] = (this.yearlyImports[productId] || 0) + quantity;

        commerceStore.updateProductStats(productId, {
            imports: this.yearlyImports[productId]
        });

        return {
            productId,
            quantity,
            pricePerUnit,
            totalCost,
            description,
            stockAdded
        };
    }

    async processProductExport({ productId, time, quantity = 1, conditions = null, partnerId = null }) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        if (partnerId) {
            if (!this.canTradeWithPartner(partnerId, productId, 'export', time)) {
                return null;
            }
            const partnerLimit = this.getPartnerTradeLimit(partnerId, productId, 'export');
            if (partnerLimit && quantity > partnerLimit.maxPerTurn) {
                quantity = partnerLimit.maxPerTurn;
            }
        }

        const availableStock = await this.getTotalWindmillStock(productId);
        
        if (!this.canExportProduct(productId, quantity, availableStock, conditions)) {
            return null;
        }

        const pricePerUnit = config.sellingPrice || 15;
        const totalRevenue = quantity * pricePerUnit;

        if (this.isStockable(productId)) {
            const stockReduced = await this.reduceWindmillStock(productId, quantity, partnerId);
            if (!stockReduced) {
                console.warn(`[CommerceService] Failed to reduce windmill stock for ${productId}`);
                return null;
            }
        }

        const partner = partnerId ? this.getPartner(partnerId) : null;
        const partnerName = partner ? partner.name : null;
        const remainingStock = this.isStockable(productId) ? availableStock - quantity : 0;

        // Créer le breakdown pour le journal
        let description = `Export ${productId}`;
        if (partnerName) {
            const breakdown = [{
                label: partnerName,
                quantity: quantity,
                unitCost: pricePerUnit,
                total: totalRevenue
            }];
            description += ` |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;
            if (remainingStock > 0) {
                description += ` - Stock restant: ${remainingStock}`;
            }
        } else {
            description += ` (${quantity} panier × ${pricePerUnit}€)${remainingStock > 0 ? ` - Stock restant: ${remainingStock}` : ''}`;
        }

        await recordExportIncome(totalRevenue, description, productId, partnerId);

        if (partnerId) {
            this.updatePartnerTrade(partnerId, productId, 'export');
        }

        this.yearlyExports[productId] = (this.yearlyExports[productId] || 0) + quantity;

        commerceStore.updateProductStats(productId, {
            exports: this.yearlyExports[productId]
        });

        return {
            productId,
            quantity,
            pricePerUnit,
            totalRevenue,
            description,
            remainingStock: this.isStockable(productId) ? remainingStock : 0
        };
    }

    async resetWindmillImportsDisplay() {
        try {
            const windmills = await listWindmillSupplyViews();

            for (const windmill of windmills) {
                const windmillId = instanceIdFromHouseRow(windmill);
                try {
                    const windmillData = await getSupplyBuildingRow(windmillId);
                    if (windmillData && windmillData.lastImport !== undefined) {
                        await updateSupplyBuildingFields(windmillId, {
                            lastImport: { wheat: 0, carrot: 0, cabbage: 0, wood: 0, dattes: 0, total: 0 },
                            lastImportDetails: {},
                        });
                    }
                } catch (_error) {
                    // preserve silent failure per windmill
                }
            }
        } catch (error) {
            console.warn('[CommerceService] Error resetting windmill imports display:', error);
        }
    }

    async simulate(city, time = 0) {
        if (typeof window === 'undefined' || !window.TimeManager) {
            return { imports: [], exports: [] };
        }

        const timeInfo = window.TimeManager.getTimeInfo(time);
        
        // Load partners data
        this.loadPartners();
        
        // Check all active partners for finished contracts (every turn)
        if (this.partnersData) {
            for (const partner of this.partnersData) {
                if (partner.isActive) {
                    this.checkAndDeactivateFinishedContract(partner.id);
                }
            }
        }
        
        if (timeInfo.year !== this.lastProcessedYear) {
            if (this.lastProcessedYear !== -1) {
                this.yearlyImports = {};
                this.yearlyExports = {};
                commerceStore.resetYearlyStats();
                
                if (this.partnersData) {
                    this.partnersData.forEach(partner => {
                        partner.imports.forEach(imp => {
                            imp.currentYearly = 0;
                        });
                    });
                    commerceStore.savePartners(this.partnersData);
                }
            }
            this.lastProcessedYear = timeInfo.year;
        }

        let config = commerceStore.loadConfig();
        if (!config && typeof window !== 'undefined' && window.commerceSectionManager) {
            if (window.commerceSectionManager.goodsData) {
                commerceStore.saveConfig(window.commerceSectionManager.goodsData);
                config = commerceStore.loadConfig();
            }
        }
        
        if (!config) {
            return { imports: [], exports: [] };
        }

        this.loadPartners();
        
        const imports = [];
        const exports = [];
        const processedProducts = new Set();

        if (this.partnersData) {
            for (const partner of this.partnersData) {
                for (const importTrade of partner.exports) {
                    if (this.canTradeWithPartner(partner.id, importTrade.productId, 'import', time)) {
                        const limit = this.getPartnerTradeLimit(partner.id, importTrade.productId, 'import');
                        const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;
                        
                        const importResult = await this.processProductImport({
                            productId: importTrade.productId,
                            time,
                            quantity,
                            partnerId: partner.id,
                        });
                        if (importResult) {
                            imports.push(importResult);
                            processedProducts.add(importTrade.productId);
                        }
                    }
                }

                for (const exportTrade of partner.imports) {
                    if (this.canTradeWithPartner(partner.id, exportTrade.productId, 'export', time)) {
                        const limit = this.getPartnerTradeLimit(partner.id, exportTrade.productId, 'export');
                        const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;
                        
                        const exportResult = await this.processProductExport({
                            productId: exportTrade.productId,
                            time,
                            quantity,
                            partnerId: partner.id,
                        });
                        if (exportResult) {
                            exports.push(exportResult);
                            processedProducts.add(exportTrade.productId);
                        }
                    }
                }
            }
        }

        // Note: Les imports/exports sont maintenant uniquement gérés via les partenaires commerciaux
        // Le code de test pour les imports/exports sans partenaire a été supprimé

        // Reset windmill imports display only at the start of a new month (first day)
        // This allows imports to be visible in the info panel during the month
        if (timeInfo.dayInMonth === 1 && timeInfo.monthIndex !== this.lastResetMonth) {
            await this.resetWindmillImportsDisplay();
            this.lastResetMonth = timeInfo.monthIndex;
        }

        return { imports, exports };
    }
}
