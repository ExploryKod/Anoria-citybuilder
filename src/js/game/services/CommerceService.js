import { SimService } from './SimService.js';
import commerceStore from '../../stores/CommerceStore.js';

const STOCKABLE_PRODUCTS = ['wheat', 'carrot', 'cabbage'];
const ALL_PRODUCTS = ['wheat', 'carrot', 'cabbage', 'wood'];

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
        import: { requiresStock: false, requiresWindmill: false },
        export: { requiresStock: false, requiresWindmill: false }
    }
};

export class CommerceService extends SimService {
    constructor() {
        super();
        this.yearlyImports = {};
        this.yearlyExports = {};
        this.lastProcessedYear = -1;
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
        if (conds.requiresStock) {
            return false;
        }
        
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

    async getTotalWindmillStock(housesStore, productId) {
        if (!housesStore || !this.isStockable(productId)) return 0;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
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

    async addToWindmillStock(housesStore, productId, quantity) {
        if (!housesStore || quantity <= 0 || !this.isStockable(productId)) return null;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
            if (windmills.length === 0) return null;
            
            const stockKey = this.getStockKey(productId);
            if (!stockKey) return null;
            
            const firstWindmill = windmills[0];
            const windmillData = await housesStore.getHouse(firstWindmill.id || firstWindmill.name);
            if (!windmillData) {
                console.warn(`[CommerceService] Windmill not found: ${firstWindmill.id || firstWindmill.name}`);
                return null;
            }
            
            const stocks = windmillData.stocks || {};
            const updatedStocks = {
                ...stocks,
                [stockKey]: (stocks[stockKey] || 0) + quantity,
                food: (stocks.food || 0) + quantity
            };
            
            const existingLastImport = windmillData.lastImport || {};
            const lastImport = {
                ...existingLastImport,
                [stockKey]: (existingLastImport[stockKey] || 0) + quantity,
                total: (existingLastImport.total || 0) + quantity
            };
            
            await housesStore.updateHouseFields(firstWindmill.id || firstWindmill.name, {
                stocks: updatedStocks,
                lastImport: lastImport
            });
            
            return {
                windmillId: firstWindmill.id || firstWindmill.name,
                addedQuantity: quantity
            };
        } catch (error) {
            console.warn(`[CommerceService] Error adding to windmill stock for ${productId}:`, error);
            return null;
        }
    }

    async reduceWindmillStock(housesStore, productId, quantity) {
        if (!housesStore || quantity <= 0 || !this.isStockable(productId)) return false;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
            const stockKey = this.getStockKey(productId);
            if (!stockKey) return false;
            
            let remaining = quantity;
            
            for (const windmill of windmills) {
                if (remaining <= 0) break;
                
                const stocks = windmill.stocks || {};
                const currentStock = stocks[stockKey] || 0;
                
                if (currentStock > 0) {
                    const toReduce = Math.min(remaining, currentStock);
                    const newStock = currentStock - toReduce;
                    remaining -= toReduce;
                    
                    const updatedStocks = {
                        ...stocks,
                        [stockKey]: newStock,
                        food: (stocks.food || 0) - toReduce
                    };
                    
                    await housesStore.updateHouseFields(windmill.id || windmill.name, {
                        stocks: updatedStocks
                    });
                }
            }
            
            return remaining === 0;
        } catch (error) {
            console.warn(`[CommerceService] Error reducing windmill stock for ${productId}:`, error);
            return false;
        }
    }

    async processProductImport({ productId, housesStore, time, quantity = 1, conditions = null }) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        if (!this.canImportProduct(productId, quantity, conditions)) {
            return null;
        }

        const pricePerUnit = config.buyingPrice || 5;
        const totalCost = quantity * pricePerUnit;

        if (!window.budgetManager) return null;

        const description = `Import ${productId} (${quantity} panier × ${pricePerUnit}€)`;
        await window.budgetManager.addImportExpense(totalCost, description, productId);

        let stockAdded = false;
        if (housesStore && this.isStockable(productId)) {
            const stockResult = await this.addToWindmillStock(housesStore, productId, quantity);
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

    async processProductExport({ productId, housesStore, time, quantity = 1, conditions = null }) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        const availableStock = await this.getTotalWindmillStock(housesStore, productId);
        
        if (!this.canExportProduct(productId, quantity, availableStock, conditions)) {
            return null;
        }

        const pricePerUnit = config.sellingPrice || 15;
        const totalRevenue = quantity * pricePerUnit;

        if (!window.budgetManager) return null;

        if (this.isStockable(productId)) {
            const stockReduced = await this.reduceWindmillStock(housesStore, productId, quantity);
            if (!stockReduced) {
                console.warn(`[CommerceService] Failed to reduce windmill stock for ${productId}`);
                return null;
            }
        }

        const remainingStock = this.isStockable(productId) ? availableStock - quantity : 0;
        const description = `Export ${productId} (${quantity} panier × ${pricePerUnit}€)${remainingStock > 0 ? ` - Stock restant: ${remainingStock}` : ''}`;
        await window.budgetManager.addExportIncome(totalRevenue, description, productId);

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

    async resetWindmillImportsDisplay(housesStore) {
        if (!housesStore) return;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
            for (const windmill of windmills) {
                const windmillId = windmill.id || windmill.name;
                try {
                    const windmillData = await housesStore.getHouse(windmillId);
                    if (windmillData && windmillData.lastImport !== undefined) {
                        await housesStore.updateHouseFields(windmillId, {
                            lastImport: { wheat: 0, carrot: 0, cabbage: 0, total: 0 }
                        });
                    }
                } catch (error) {
                }
            }
        } catch (error) {
            console.warn('[CommerceService] Error resetting windmill imports display:', error);
        }
    }

    async simulate(city, housesStore, time = 0) {
        if (typeof window === 'undefined' || !window.TimeManager) {
            return { imports: [], exports: [] };
        }

        const timeInfo = window.TimeManager.getTimeInfo(time);
        
        if (timeInfo.year !== this.lastProcessedYear) {
            if (this.lastProcessedYear !== -1) {
                this.yearlyImports = {};
                this.yearlyExports = {};
                commerceStore.resetYearlyStats();
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

        const imports = [];
        const exports = [];

        for (const productId of ALL_PRODUCTS) {
            const importResult = await this.processProductImport({
                productId,
                housesStore,
                time
            });
            if (importResult) {
                imports.push(importResult);
            }

            const exportResult = await this.processProductExport({
                productId,
                housesStore,
                time
            });
            if (exportResult) {
                exports.push(exportResult);
            }
        }

        await this.resetWindmillImportsDisplay(housesStore);

        return { imports, exports };
    }
}
