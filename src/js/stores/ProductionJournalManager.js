import db from '../../core/persistence/dexie/db.js';
import { getTimeManager } from '../acl/appRuntime.js';

/**
 * ProductionJournalManager - Manages production journal entries for factories
 * Handles all operations related to the production journal (db.productionJournal)
 */
class ProductionJournalManager {
    constructor() {
        this.db = db;
    }

    /**
     * Prix des ressources et produits
     */
    static PRICES = {
        wood: 2,          // 2 euros pour 1 bois
        logs: 4,          // 4 euros pour 1 bûche
        furniture: 6,      // 6 euros pour 1 meuble
        gold: 5,          // 5 euros pour 1 or
        refinedGold: 8,   // 8 euros pour 1 or raffiné
        jewelry: 12,      // 12 euros pour 1 bijou
        clay: 2,          // 2 euros pour 1 argile
        refinedClay: 4,   // 4 euros pour 1 argile raffinée
        pottery: 6,       // 6 euros pour 1 poterie
        iron: 3,          // 3 euros pour 1 fer
        refinedIron: 6,   // 6 euros pour 1 fer raffiné
        weapons: 10       // 10 euros pour 1 arme
    };

    /**
     * Types d'événements de production
     */
    static EVENT_TYPES = {
        COLLECT_WOOD: 'collect_wood',                    // Les bûcherons collectent du bois
        TRANSFORM_WOOD_TO_LOGS: 'transform_wood_to_logs', // Transformation bois → bûches
        TRANSFORM_GOLD_TO_REFINED_GOLD: 'transform_gold_to_refined_gold', // Transformation or → or raffiné
        TRANSFORM_CLAY_TO_REFINED_CLAY: 'transform_clay_to_refined_clay', // Transformation argile → argile raffinée
        TRANSFORM_IRON_TO_REFINED_IRON: 'transform_iron_to_refined_iron', // Transformation fer → fer raffiné
        DELIVER_LOGS_TO_CARPENTERS: 'deliver_logs_to_carpenters', // Livraison bûches aux menuisiers
        PRODUCE_FURNITURE: 'produce_furniture',         // Fabrication de meubles
        PRODUCE_JEWELRY: 'produce_jewelry',             // Fabrication de bijoux
        PRODUCE_POTTERY: 'produce_pottery',             // Fabrication de poteries
        PRODUCE_WEAPONS: 'produce_weapons'              // Fabrication d'armes
    };

    /**
     * Add production journal entry
     * @param {number} turn - Turn number
     * @param {string} factoryId - Factory ID (name-x-y)
     * @param {string} eventType - Type of event (EVENT_TYPES)
     * @param {string} resourceType - Type of resource (wood, logs, furniture, gold, refinedGold, jewelry, clay, refinedClay, pottery, iron, refinedIron, weapons)
     * @param {number} quantity - Quantity
     * @param {Object} remainingStocks - Remaining stocks
     * @param {number} materialConsumed - Optional: number of refined material consumed (logs for furniture, refinedGold for jewelry, refinedClay for pottery, refinedIron for weapons)
     * @param {number} customPrice - Optional: custom price (if not provided, calculated automatically)
     * @param {Array<number>} productionTurns - Optional: array of turns during which production occurred (e.g., [24, 25] for 2-turn production)
     * @returns {Promise<number>} Entry ID
     */
    async addProductionEntry(turn, factoryId, eventType, resourceType, quantity, remainingStocks = {}, materialConsumed = null, customPrice = null, productionTurns = null) {
        try {
            // Vérifier que le store existe
            if (!this.db.productionJournal) {
                console.error('[ProductionJournalManager] productionJournal store not found in database');
                return null;
            }
            
            // Obtenir le mois et l'année depuis TimeManager
            let month = null;
            let year = null;
            
            const timeManager = getTimeManager();
            if (timeManager) {
                const timeInfo = timeManager.getTimeInfo(turn);
                month = timeInfo.monthIndex + 1; // monthIndex est 0-indexed (0=janvier), on veut 1-12
                year = timeInfo.year;
            }
            
            // Calculer le prix selon le type de ressource
            // Si customPrice est fourni, l'utiliser (pour les entrées combinées)
            // Sinon, calculer automatiquement
            const price = customPrice !== null ? customPrice : (this.getPrice(resourceType) * quantity);
            
            const entry = {
                turn: turn,
                month: month,
                year: year,
                date: new Date().toISOString(),
                factoryId: factoryId,
                eventType: eventType,
                resourceType: resourceType,
                quantity: quantity,
                price: price,
                remainingStocks: remainingStocks
            };
            
            // Si materialConsumed est fourni, l'ajouter à l'entrée
            // Pour la rétrocompatibilité, on garde aussi logsConsumed pour les meubles
            if (materialConsumed !== null && materialConsumed !== undefined) {
                entry.materialConsumed = materialConsumed;
                // Pour la rétrocompatibilité avec les meubles
                if (eventType === 'produce_furniture') {
                    entry.logsConsumed = materialConsumed;
                }
            }
            
            // Si productionTurns est fourni, l'ajouter à l'entrée (pour indiquer les tours de production)
            if (productionTurns !== null && productionTurns !== undefined && Array.isArray(productionTurns)) {
                entry.productionTurns = productionTurns;
            }
            
            try {
                const id = await this.db.productionJournal.add(entry);
                return id;
            } catch (addError) {
                // Gérer les erreurs de contrainte (clé déjà existante)
                // Cela peut arriver en cas de race condition ou de tentative d'ajout multiple
                if (addError.name === 'ConstraintError' || addError.message?.includes('Key already exists')) {
                    console.warn('[ProductionJournalManager] Entry already exists (ConstraintError), skipping duplicate entry:', {
                        turn: entry.turn,
                        factoryId: entry.factoryId,
                        eventType: entry.eventType
                    });
                    // Retourner null au lieu de lancer une erreur pour ne pas bloquer la production
                    return null;
                }
                // Pour les autres erreurs, les relancer
                throw addError;
            }
        } catch (error) {
            // Log l'erreur mais ne pas la relancer pour ne pas bloquer la production
            console.error('[ProductionJournalManager] Error adding production entry:', error);
            // Retourner null au lieu de lancer une erreur
            return null;
        }
    }


    /**
     * Get price for a resource type
     * @param {string} resourceType - Resource type (wood, logs, furniture)
     * @returns {number} Price per unit
     */
    getPrice(resourceType) {
        return ProductionJournalManager.PRICES[resourceType] || 0;
    }

    /**
     * Get all production journal entries
     * @param {string} factoryId - Optional factory ID to filter
     * @param {number} turn - Optional turn to filter
     * @returns {Promise<Array>} Array of production entries
     */
    async getProductionEntries(factoryId = null, turn = null) {
        try {
            let query = this.db.productionJournal.orderBy('turn');
            
            if (factoryId) {
                query = query.filter(entry => entry.factoryId === factoryId);
            }
            
            if (turn !== null) {
                query = query.filter(entry => entry.turn === turn);
            }
            
            const entries = await query.reverse().toArray();
            return entries;
        } catch (error) {
            console.error('[ProductionJournalManager] Error getting production entries:', error);
            return [];
        }
    }

    /**
     * Get production entries grouped by factory
     * @returns {Promise<Object>} Object with factoryId as key and entries array as value
     */
    async getProductionEntriesByFactory() {
        try {
            const entries = await this.getProductionEntries();
            const grouped = {};
            
            entries.forEach(entry => {
                if (!grouped[entry.factoryId]) {
                    grouped[entry.factoryId] = [];
                }
                grouped[entry.factoryId].push(entry);
            });
            
            return grouped;
        } catch (error) {
            console.error('[ProductionJournalManager] Error grouping production entries:', error);
            return {};
        }
    }

    /**
     * Get production entries for a specific factory
     * @param {string} factoryId - Factory ID
     * @returns {Promise<Array>} Array of production entries for this factory
     */
    async getFactoryProductionEntries(factoryId) {
        return await this.getProductionEntries(factoryId);
    }

    /**
     * Get production entries for a specific turn
     * @param {number} turn - Turn number
     * @returns {Promise<Array>} Array of production entries for this turn
     */
    async getTurnProductionEntries(turn) {
        return await this.getProductionEntries(null, turn);
    }

    /**
     * Clear all production journal entries (for testing/reset)
     * @returns {Promise<void>}
     */
    async clearAllEntries() {
        try {
            await this.db.productionJournal.clear();
        } catch (error) {
            console.error('[ProductionJournalManager] Error clearing production entries:', error);
            throw error;
        }
    }
}

// Export singleton instance
const productionJournalManager = new ProductionJournalManager();
export default productionJournalManager;
