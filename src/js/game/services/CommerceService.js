import { SimService } from './SimService.js';
import commerceStore from '../../stores/CommerceStore.js';

/**
 * CommerceService - Gère les imports/exports de produits
 * Communique avec CommerceSectionManager via CommerceStore (découplé)
 */
export class CommerceService extends SimService {
    constructor() {
        super();
        this.yearlyImports = {}; // { wheat: 0, carrot: 0, ... } - compteur annuel
        this.yearlyExports = {}; // { wheat: 0, carrot: 0, ... } - compteur annuel
        this.lastProcessedYear = -1;
    }

    /**
     * Récupère la configuration d'un produit depuis le store
     * @param {string} productId - ID du produit
     * @returns {Object|null} Configuration du produit
     */
    getProductConfig(productId) {
        const config = commerceStore.getProductConfig(productId);
        if (!config) {
            // Si pas de config, essayer de charger depuis le commerceSectionManager
            if (typeof window !== 'undefined' && window.commerceSectionManager && window.commerceSectionManager.goodsData) {
                const good = window.commerceSectionManager.goodsData.find(g => g.id === productId);
                if (good) {
                    // Sauvegarder dans le store pour la prochaine fois
                    commerceStore.saveConfig(window.commerceSectionManager.goodsData);
                    return good;
                }
            }
        }
        return config;
    }

    /**
     * Vérifie si on peut encore importer ce produit cette année
     * @param {string} productId - ID du produit
     * @param {number} quantity - Quantité à importer
     * @returns {boolean} True si on peut importer
     */
    canImportProduct(productId, quantity) {
        const config = this.getProductConfig(productId);
        if (!config) return false;
        
        // Si stockpiling activé, pas d'import
        if (config.stockpiling) return false;
        
        // Vérifier le seuil maximum annuel
        const currentYearly = this.yearlyImports[productId] || 0;
        const buyingMax = config.buyingMax || 0;
        
        return (currentYearly + quantity) <= buyingMax;
    }

    /**
     * Traite les imports pour un produit spécifique
     * Extensible : on peut ajouter d'autres produits facilement
     * @param {string} productId - ID du produit
     * @param {number} time - Temps de simulation
     * @returns {Promise<Object|null>} Résultat de l'import ou null
     */
    async processProductImport(productId, time) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        // Vérifier si on peut importer
        const quantity = 1; // 1 panier par tour
        if (!this.canImportProduct(productId, quantity)) {
            // Log pour debug (seulement si on est proche de la limite)
            const currentYearly = this.yearlyImports[productId] || 0;
            const buyingMax = config.buyingMax || 0;
            if (currentYearly >= buyingMax) {
                // Seuil max atteint, c'est normal, pas besoin de log
            } else if (config.stockpiling) {
                console.log(`[CommerceService] Import ${productId} skipped: stockpiling enabled`);
            }
            return null; // Seuil max atteint ou stockpiling activé
        }

        // Calculer le coût
        const pricePerUnit = config.buyingPrice || 5; // Prix par défaut : 5€
        const totalCost = quantity * pricePerUnit;

        // Vérifier que budgetManager existe
        if (!window.budgetManager) return null;

        // Enregistrer l'import dans le budget (même si fonds insuffisants, pour permettre les tests avec déficit)
        const description = `Import ${productId} (${quantity} panier × ${pricePerUnit}€)`;
        await window.budgetManager.addImportExpense(totalCost, description, productId);

        // Mettre à jour le compteur annuel
        this.yearlyImports[productId] = (this.yearlyImports[productId] || 0) + quantity;

        // Sauvegarder les stats dans le store (pour affichage dans le board)
        commerceStore.updateProductStats(productId, {
            imports: this.yearlyImports[productId]
        });

        return {
            productId,
            quantity,
            pricePerUnit,
            totalCost,
            description
        };
    }

    /**
     * Vérifie si on peut encore exporter ce produit cette année
     * @param {string} productId - ID du produit
     * @param {number} quantity - Quantité à exporter
     * @returns {boolean} True si on peut exporter
     */
    canExportProduct(productId, quantity) {
        const config = this.getProductConfig(productId);
        if (!config) return false;
        
        // Si stockpiling activé, pas d'export
        if (config.stockpiling) return false;
        
        // Vérifier le seuil maximum annuel
        const currentYearly = this.yearlyExports[productId] || 0;
        const sellingMax = config.sellingMax || 0;
        
        return (currentYearly + quantity) <= sellingMax;
    }

    /**
     * Récupère le stock total d'un produit dans tous les moulins
     * @param {HousesStore} housesStore - Store IndexedDB
     * @param {string} productId - ID du produit (wheat, carrot, cabbage)
     * @returns {Promise<number>} Stock total disponible
     */
    async getTotalWindmillStock(housesStore, productId) {
        if (!housesStore) return 0;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
            let totalStock = 0;
            for (const windmill of windmills) {
                const stocks = windmill.stocks || {};
                // Mapper productId vers la clé de stock
                const stockKey = productId === 'wheat' ? 'wheat' : 
                                productId === 'carrot' ? 'carrot' : 
                                productId === 'cabbage' ? 'cabbage' : null;
                
                if (stockKey && stocks[stockKey]) {
                    totalStock += stocks[stockKey] || 0;
                }
            }
            
            return totalStock;
        } catch (error) {
            console.warn(`[CommerceService] Error getting windmill stock for ${productId}:`, error);
            return 0;
        }
    }

    /**
     * Réduit le stock d'un produit dans les moulins (en commençant par le premier)
     * @param {HousesStore} housesStore - Store IndexedDB
     * @param {string} productId - ID du produit
     * @param {number} quantity - Quantité à retirer
     * @returns {Promise<boolean>} True si le stock a été réduit avec succès
     */
    async reduceWindmillStock(housesStore, productId, quantity) {
        if (!housesStore || quantity <= 0) return false;
        
        try {
            const allHouses = await housesStore.listAllHouses();
            const windmills = allHouses.filter(house => {
                const type = house.type || '';
                return type.includes('Windmill') || type.includes('windmill');
            });
            
            // Mapper productId vers la clé de stock
            const stockKey = productId === 'wheat' ? 'wheat' : 
                            productId === 'carrot' ? 'carrot' : 
                            productId === 'cabbage' ? 'cabbage' : null;
            
            if (!stockKey) return false;
            
            let remaining = quantity;
            
            // Réduire le stock en commençant par le premier moulin
            for (const windmill of windmills) {
                if (remaining <= 0) break;
                
                const stocks = windmill.stocks || {};
                const currentStock = stocks[stockKey] || 0;
                
                if (currentStock > 0) {
                    const toReduce = Math.min(remaining, currentStock);
                    const newStock = currentStock - toReduce;
                    remaining -= toReduce;
                    
                    // Mettre à jour les stocks du moulin
                    const updatedStocks = {
                        ...stocks,
                        [stockKey]: newStock,
                        food: (stocks.food || 0) - toReduce // Réduire aussi le total
                    };
                    
                    await housesStore.updateHouseFields(windmill.id || windmill.name, {
                        stocks: updatedStocks
                    });
                }
            }
            
            return remaining === 0; // True si toute la quantité a été retirée
        } catch (error) {
            console.warn(`[CommerceService] Error reducing windmill stock for ${productId}:`, error);
            return false;
        }
    }

    /**
     * Traite les exports pour un produit spécifique
     * Extensible : on peut ajouter d'autres produits facilement
     * @param {string} productId - ID du produit
     * @param {HousesStore} housesStore - Store IndexedDB
     * @param {number} time - Temps de simulation
     * @returns {Promise<Object|null>} Résultat de l'export ou null
     */
    async processProductExport(productId, housesStore, time) {
        const config = this.getProductConfig(productId);
        if (!config) {
            console.warn(`[CommerceService] No config found for product: ${productId}`);
            return null;
        }

        // Vérifier si on peut exporter
        const quantity = 1; // 1 panier par tour
        if (!this.canExportProduct(productId, quantity)) {
            return null; // Seuil max atteint ou stockpiling activé
        }

        // Vérifier qu'il y a des moulins avec du stock
        const availableStock = await this.getTotalWindmillStock(housesStore, productId);
        if (availableStock < quantity) {
            return null; // Pas assez de stock dans les moulins
        }

        // Calculer le revenu
        const pricePerUnit = config.sellingPrice || 15; // Prix par défaut : 15€
        const totalRevenue = quantity * pricePerUnit;

        // Vérifier que budgetManager existe
        if (!window.budgetManager) return null;

        // Réduire le stock des moulins
        const stockReduced = await this.reduceWindmillStock(housesStore, productId, quantity);
        if (!stockReduced) {
            console.warn(`[CommerceService] Failed to reduce windmill stock for ${productId}`);
            return null;
        }

        // Enregistrer l'export dans le budget (revenu)
        // La description inclut l'état des stocks pour information
        const remainingStock = availableStock - quantity;
        const description = `Export ${productId} (${quantity} panier × ${pricePerUnit}€) - Stock restant: ${remainingStock}`;
        await window.budgetManager.addExportIncome(totalRevenue, description, productId);

        // Mettre à jour le compteur annuel
        this.yearlyExports[productId] = (this.yearlyExports[productId] || 0) + quantity;

        // Sauvegarder les stats dans le store (pour affichage dans le board)
        commerceStore.updateProductStats(productId, {
            exports: this.yearlyExports[productId]
        });

        return {
            productId,
            quantity,
            pricePerUnit,
            totalRevenue,
            description,
            remainingStock: availableStock - quantity
        };
    }

    /**
     * Point d'entrée principal - appelé chaque tour
     * Extensible : on peut ajouter d'autres produits ici
     * @param {City} city - Objet ville
     * @param {HousesStore} housesStore - Store IndexedDB
     * @param {number} time - Temps de simulation
     * @returns {Promise<Object>} Objet avec { imports: Array, exports: Array }
     */
    async simulate(city, housesStore, time = 0) {
        if (typeof window === 'undefined' || !window.TimeManager) return { imports: [], exports: [] };

        const timeInfo = window.TimeManager.getTimeInfo(time);
        
        // Réinitialiser les compteurs annuels au début de l'année
        if (timeInfo.year !== this.lastProcessedYear) {
            if (this.lastProcessedYear !== -1) {
                // Nouvelle année : réinitialiser
                this.yearlyImports = {};
                this.yearlyExports = {};
                commerceStore.resetYearlyStats();
            }
            this.lastProcessedYear = timeInfo.year;
        }

        // S'assurer que la configuration est chargée
        // Si le store est vide, essayer de charger depuis commerceSectionManager
        let config = commerceStore.loadConfig();
        if (!config && typeof window !== 'undefined' && window.commerceSectionManager) {
            // Si le store est vide mais que le manager existe, charger depuis le manager
            if (window.commerceSectionManager.goodsData) {
                commerceStore.saveConfig(window.commerceSectionManager.goodsData);
                config = commerceStore.loadConfig();
            }
        }
        
        // Si toujours pas de config, on ne peut pas importer/exporter
        if (!config) {
            return { imports: [], exports: [] };
        }

        // Traiter les imports par produit
        // Extensible : on peut ajouter d'autres produits ici
        const imports = [];

        // Import de blé
        const wheatImport = await this.processProductImport('wheat', time);
        if (wheatImport) {
            imports.push(wheatImport);
        }

        // TODO: Ajouter d'autres produits ici (carrot, cabbage, wood)
        // const carrotImport = await this.processProductImport('carrot', time);
        // if (carrotImport) imports.push(carrotImport);

        // Traiter les exports par produit
        // Extensible : on peut ajouter d'autres produits ici
        const exports = [];

        // Export de blé (nécessite des moulins avec du stock)
        const wheatExport = await this.processProductExport('wheat', housesStore, time);
        if (wheatExport) {
            exports.push(wheatExport);
        }

        // TODO: Ajouter d'autres produits ici (carrot, cabbage, wood)
        // const carrotExport = await this.processProductExport('carrot', housesStore, time);
        // if (carrotExport) exports.push(carrotExport);

        return { imports, exports };
    }
}

