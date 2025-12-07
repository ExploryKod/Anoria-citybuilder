/**
 * CommerceStore - Store découplé pour la communication entre CommerceService et CommerceSectionManager
 * Utilise localStorage comme interface de communication pour éviter le couplage fort
 */
class CommerceStore {
    constructor() {
        this.STORAGE_KEY_CONFIG = 'commerce_config';
        this.STORAGE_KEY_STATS = 'commerce_stats';
    }

    /**
     * Sauvegarde la configuration des produits (écrit par CommerceSectionManager)
     * @param {Array} goodsData - Configuration des produits
     */
    saveConfig(goodsData) {
        try {
            localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(goodsData));
        } catch (error) {
            console.warn('[CommerceStore] Error saving config:', error);
        }
    }

    /**
     * Charge la configuration des produits (lu par CommerceService)
     * @returns {Array|null} Configuration des produits ou null
     */
    loadConfig() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('[CommerceStore] Error loading config:', error);
        }
        return null;
    }

    /**
     * Récupère la configuration d'un produit spécifique
     * @param {string} productId - ID du produit (wheat, carrot, etc.)
     * @returns {Object|null} Configuration du produit ou null
     */
    getProductConfig(productId) {
        const config = this.loadConfig();
        if (!config) return null;
        return config.find(g => g.id === productId) || null;
    }

    /**
     * Sauvegarde les statistiques de commerce (écrit par CommerceService)
     * @param {Object} stats - Statistiques { yearlyImports: {...}, yearlyExports: {...}, etc. }
     */
    saveStats(stats) {
        try {
            localStorage.setItem(this.STORAGE_KEY_STATS, JSON.stringify(stats));
        } catch (error) {
            console.warn('[CommerceStore] Error saving stats:', error);
        }
    }

    /**
     * Charge les statistiques de commerce (lu par CommerceSectionManager)
     * @returns {Object|null} Statistiques ou null
     */
    loadStats() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY_STATS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('[CommerceStore] Error loading stats:', error);
        }
        return null;
    }

    /**
     * Met à jour les statistiques d'un produit spécifique
     * @param {string} productId - ID du produit
     * @param {Object} productStats - Statistiques du produit { imports: number, exports: number, etc. }
     */
    updateProductStats(productId, productStats) {
        const currentStats = this.loadStats() || { yearlyImports: {}, yearlyExports: {} };
        
        if (!currentStats.yearlyImports) currentStats.yearlyImports = {};
        if (!currentStats.yearlyExports) currentStats.yearlyExports = {};
        
        if (productStats.imports !== undefined) {
            currentStats.yearlyImports[productId] = productStats.imports;
        }
        if (productStats.exports !== undefined) {
            currentStats.yearlyExports[productId] = productStats.exports;
        }
        
        this.saveStats(currentStats);
    }

    /**
     * Réinitialise les statistiques annuelles
     */
    resetYearlyStats() {
        this.saveStats({
            yearlyImports: {},
            yearlyExports: {}
        });
    }


    /**
     * Nettoie toutes les données du store (appelé au replay)
     */
    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY_CONFIG);
            localStorage.removeItem(this.STORAGE_KEY_STATS);
        } catch (error) {
            console.warn('[CommerceStore] Error clearing:', error);
        }
    }
}

// Singleton
const commerceStore = new CommerceStore();

export default commerceStore;

