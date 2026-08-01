import {
  isContractFinished as isPartnerContractFinished,
} from '../../domain/policies/PartnerContractPolicy.js';
import {
  canTradeWithPartner as canTradeWithPartnerPolicy,
  getPartnerTradeLimit as getPartnerTradeLimitPolicy,
} from '../../domain/policies/PartnerTradePolicy.js';
import {
  canImportProduct as canImportProductPolicy,
  canExportProduct as canExportProductPolicy,
} from '../../domain/policies/ProductTradePolicy.js';
import {
  isStockableProduct,
  getProductStockKey,
} from '../../domain/catalogs/ProductCatalog.js';

export class CommerceSimulationService {
    /**
     * @param {object} deps
     * @param {import('../../infrastructure/persistence/LocalStorageCommerceRepository.js').LocalStorageCommerceRepository} deps.commerceRepository
     * @param {(params: object) => Promise<unknown>} deps.recordImportExpense
     * @param {(params: object) => Promise<unknown>} deps.recordExportIncome
     * @param {() => Promise<Array>} deps.listCommercializableWindmills
     * @param {(id: string) => Promise<object|null>} deps.getSupplyBuildingRow
     * @param {(id: string, fields: object) => Promise<unknown>} deps.updateSupplyBuildingFields
     * @param {() => Promise<Array>} deps.listWindmillSupplyViews
     * @param {(time: number) => object} deps.getTimeInfo
     * @param {(row: object) => string} deps.instanceIdFromHouseRow
     * @param {((payload: object) => void)|null} [deps.onPartnerContractFinished]
     */
    constructor(deps) {
        this.commerceRepository = deps.commerceRepository;
        this.recordImportExpense = deps.recordImportExpense;
        this.recordExportIncome = deps.recordExportIncome;
        this.listCommercializableWindmills = deps.listCommercializableWindmills;
        this.getSupplyBuildingRow = deps.getSupplyBuildingRow;
        this.updateSupplyBuildingFields = deps.updateSupplyBuildingFields;
        this.listWindmillSupplyViews = deps.listWindmillSupplyViews;
        this.getTimeInfo = deps.getTimeInfo;
        this.instanceIdFromHouseRow = deps.instanceIdFromHouseRow;
        this.onPartnerContractFinished = deps.onPartnerContractFinished ?? null;
        this.yearlyImports = {};
        this.yearlyExports = {};
        this.lastProcessedYear = -1;
        this.lastResetMonth = -1;
        this.partnersData = null;
    }

    loadPartners() {
        this.partnersData = this.commerceRepository.loadPartners();
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
        const timeInfo = this.getTimeInfo(time);
        return canTradeWithPartnerPolicy({
            partner,
            productId,
            operation,
            currentMonthIndex: timeInfo.monthIndex,
        });
    }

    isContractFinished(partner) {
        return isPartnerContractFinished(partner);
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
            this.commerceRepository.savePartners(this.partnersData);
            
            if (this.onPartnerContractFinished) {
                setTimeout(() => {
                    this.onPartnerContractFinished({
                        partnerId,
                        partnerName,
                        finishedProducts,
                    });
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
                this.commerceRepository.savePartners(this.partnersData);
                
                // Check if contract is finished after this trade
                this.checkAndDeactivateFinishedContract(partnerId);
                
                return true;
            }
        } else if (operation === 'import') {
            const trade = partner.exports.find(exp => exp.productId === productId);
            if (trade) {
                trade.currentOccurrences = (trade.currentOccurrences || 0) + 1;
                trade.currentYearly = (trade.currentYearly || 0) + 1;
                this.commerceRepository.savePartners(this.partnersData);
                
                // Check if contract is finished after this trade
                this.checkAndDeactivateFinishedContract(partnerId);
                
                return true;
            }
        }

        return false;
    }

    getPartnerTradeLimit(partnerId, productId, operation) {
        return getPartnerTradeLimitPolicy(this.getPartner(partnerId), productId, operation);
    }

    getProductConfig(productId) {
        return this.commerceRepository.getProductConfig(productId);
    }

    isStockable(productId) {
        return isStockableProduct(productId);
    }

    getStockKey(productId) {
        return getProductStockKey(productId);
    }

    canImportProduct(productId, quantity, conditions = null) {
        return canImportProductPolicy({
            productConfig: this.getProductConfig(productId),
            quantity,
            currentYearlyTotal: this.yearlyImports[productId] || 0,
            conditions,
        });
    }

    canExportProduct(productId, quantity, availableStock, conditions = null) {
        return canExportProductPolicy({
            productConfig: this.getProductConfig(productId),
            quantity,
            currentYearlyTotal: this.yearlyExports[productId] || 0,
            availableStock,
            productId,
            conditions,
        });
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
            return this.listCommercializableWindmills();
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
            const windmillId = this.instanceIdFromHouseRow(firstWindmill);
            const windmillData = await this.getSupplyBuildingRow(windmillId);
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

            await this.updateSupplyBuildingFields(windmillId, {
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

                const windmillId = this.instanceIdFromHouseRow(windmill);
                const row = await this.getSupplyBuildingRow(windmillId);
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

                        await this.updateSupplyBuildingFields(windmillId, {
                            stocks: updatedStocks,
                            lastExportDetails,
                        });
                    } else {
                        await this.updateSupplyBuildingFields(windmillId, { stocks: updatedStocks });
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

        await this.recordImportExpense(totalCost, description, productId, partnerId);

        if (partnerId) {
            this.updatePartnerTrade(partnerId, productId, 'import');
        }

        let stockAdded = false;
        if (this.isStockable(productId)) {
            const stockResult = await this.addToWindmillStock(productId, quantity, partnerId);
            stockAdded = stockResult !== null;
        }

        this.yearlyImports[productId] = (this.yearlyImports[productId] || 0) + quantity;

        this.commerceRepository.updateProductStats(productId, {
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

        await this.recordExportIncome(totalRevenue, description, productId, partnerId);

        if (partnerId) {
            this.updatePartnerTrade(partnerId, productId, 'export');
        }

        this.yearlyExports[productId] = (this.yearlyExports[productId] || 0) + quantity;

        this.commerceRepository.updateProductStats(productId, {
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
            const windmills = await this.listWindmillSupplyViews();

            for (const windmill of windmills) {
                const windmillId = this.instanceIdFromHouseRow(windmill);
                try {
                    const windmillData = await this.getSupplyBuildingRow(windmillId);
                    if (windmillData && windmillData.lastImport !== undefined) {
                        await this.updateSupplyBuildingFields(windmillId, {
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
        const timeInfo = this.getTimeInfo(time);
        
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
                this.commerceRepository.resetYearlyStats();
                
                if (this.partnersData) {
                    this.partnersData.forEach(partner => {
                        partner.imports.forEach(imp => {
                            imp.currentYearly = 0;
                        });
                    });
                    this.commerceRepository.savePartners(this.partnersData);
                }
            }
            this.lastProcessedYear = timeInfo.year;
        }

        const config = this.commerceRepository.loadConfig();
        
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
