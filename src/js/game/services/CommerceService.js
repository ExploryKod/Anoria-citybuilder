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
     * Point d'entrée principal - appelé chaque tour
     * Extensible : on peut ajouter d'autres produits ici
     * @param {City} city - Objet ville
     * @param {HousesStore} housesStore - Store IndexedDB
     * @param {number} time - Temps de simulation
     * @returns {Promise<Array>} Liste des imports effectués
     */
    async simulate(city, housesStore, time = 0) {
        if (typeof window === 'undefined' || !window.TimeManager) return [];

        const timeInfo = window.TimeManager.getTimeInfo(time);
        
        // Réinitialiser les compteurs annuels au début de l'année
        if (timeInfo.year !== this.lastProcessedYear) {
            if (this.lastProcessedYear !== -1) {
                // Nouvelle année : réinitialiser
                this.yearlyImports = {};
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
        
        // Si toujours pas de config, on ne peut pas importer
        if (!config) {
            return [];
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

        return imports;
    }
}

