// FoodTraceabilityService.js
import db from './db.js';

/**
 * Service de traçabilité alimentaire
 * Enregistre toutes les transactions alimentaires : ferme → marché, marché → maison, consommation maison
 */
class FoodTraceabilityService {
    constructor() {
        this.db = db;
    }

    /**
     * Enregistre une transaction alimentaire
     * @param {number} turn - Numéro du tour
     * @param {number} month - Index du mois (0-11)
     * @param {number} year - Année (0 = 0 JC, 1 = 1 ap JC, etc.)
     * @param {string} transactionType - Type de transaction: 'farm_to_market', 'market_to_house', 'house_consumption'
     * @param {Object} from - Objet source { id, x, y, type }
     * @param {Object} to - Objet destination { id, x, y, type }
     * @param {string} foodType - Type de nourriture: 'wheat', 'carrot', 'cabbage', 'food' (total)
     * @param {number} quantity - Quantité de paniers
     * @param {number} price - Prix par panier (par défaut 1€)
     */
    async addTransaction(turn, month, year, transactionType, from, to, foodType, quantity, price = 1) {
        try {
            await this.db.foodTraceability.add({
                turn: turn,
                month: month,
                year: year,
                date: new Date().toISOString(),
                transactionType: transactionType,
                fromId: from?.id || null,
                fromCoords: from ? `${from.x},${from.y}` : null,
                fromType: from?.type || null,
                toId: to?.id || null,
                toCoords: to ? `${to.x},${to.y}` : null,
                toType: to?.type || null,
                foodType: foodType,
                quantity: quantity,
                price: price,
                totalPrice: quantity * price
            });
        } catch (error) {
            console.error('[FoodTraceabilityService] Error adding transaction:', error);
        }
    }

    /**
     * Enregistre une vente de ferme à marché
     * @param {number} turn - Numéro du tour
     * @param {number} month - Index du mois
     * @param {number} year - Année
     * @param {Object} farm - Ferme { id, x, y, type }
     * @param {Object} market - Marché { id, x, y, type }
     * @param {string} foodType - Type de nourriture
     * @param {number} quantity - Quantité
     * @param {number} price - Prix par panier
     */
    async recordFarmToMarket(turn, month, year, farm, market, foodType, quantity, price = 1) {
        await this.addTransaction(turn, month, year, 'farm_to_market', farm, market, foodType, quantity, price);
    }

    /**
     * Enregistre une vente de marché à maison
     * @param {number} turn - Numéro du tour
     * @param {number} month - Index du mois
     * @param {number} year - Année
     * @param {Object} market - Marché { id, x, y, type }
     * @param {Object} house - Maison { id, x, y, type }
     * @param {string} foodType - Type de nourriture
     * @param {number} quantity - Quantité
     * @param {number} price - Prix par panier
     */
    async recordMarketToHouse(turn, month, year, market, house, foodType, quantity, price = 1) {
        await this.addTransaction(turn, month, year, 'market_to_house', market, house, foodType, quantity, price);
    }

    /**
     * Enregistre une consommation de maison
     * @param {number} turn - Numéro du tour
     * @param {number} month - Index du mois
     * @param {number} year - Année
     * @param {Object} house - Maison { id, x, y, type }
     * @param {string} foodType - Type de nourriture consommée
     * @param {number} quantity - Quantité consommée
     * @param {number} citizens - Nombre de citoyens
     */
    async recordHouseConsumption(turn, month, year, house, foodType, quantity, citizens) {
        await this.addTransaction(turn, month, year, 'house_consumption', house, null, foodType, quantity, 0);
    }

    /**
     * Récupère toutes les transactions pour un mois donné
     * @param {number} turn - Numéro du tour
     * @param {number} month - Index du mois (optionnel)
     * @returns {Promise<Array>} Transactions
     */
    async getTransactionsForMonth(turn, month = null) {
        let query = this.db.foodTraceability.where('turn').equals(turn);
        
        if (month !== null) {
            query = query.and(transaction => transaction.month === month);
        }
        
        return await query.sortBy('date');
    }

    /**
     * Récupère toutes les transactions
     * @param {number} maxAge - Âge maximum en jours (optionnel)
     * @returns {Promise<Array>} Transactions
     */
    async getAllTransactions(maxAge = null) {
        let transactions = await this.db.foodTraceability.toArray();
        
        if (maxAge) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAge);
            
            transactions = transactions.filter(transaction => new Date(transaction.date) >= cutoffDate);
        }
        
        // Trier par tour décroissant, puis par mois, puis par date
        return transactions.sort((a, b) => {
            if (a.turn !== b.turn) {
                return b.turn - a.turn;
            }
            if (a.month !== b.month) {
                return a.month - b.month;
            }
            return new Date(a.date) - new Date(b.date);
        });
    }

    /**
     * Récupère les transactions groupées par mois
     * @param {number} turn - Numéro du tour
     * @returns {Promise<Object>} Transactions groupées par mois
     */
    async getTransactionsByMonth(turn) {
        const transactions = await this.getTransactionsForMonth(turn);
        
        const byMonth = {};
        transactions.forEach(transaction => {
            const month = transaction.month;
            if (!byMonth[month]) {
                byMonth[month] = [];
            }
            byMonth[month].push(transaction);
        });
        
        return byMonth;
    }

    /**
     * Nettoie les anciennes transactions
     * @param {number} maxAge - Âge maximum en jours
     */
    async cleanupOldTransactions(maxAge = 60) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAge);
            
            const oldTransactions = await this.db.foodTraceability
                .where('date')
                .below(cutoffDate.toISOString())
                .toArray();
            
            if (oldTransactions.length > 0) {
                const ids = oldTransactions.map(t => t.id);
                await this.db.foodTraceability.bulkDelete(ids);
                console.log(`[FoodTraceabilityService] Cleaned up ${oldTransactions.length} old transactions`);
            }
        } catch (error) {
            console.error('[FoodTraceabilityService] Error cleaning up old transactions:', error);
        }
    }
}

export default FoodTraceabilityService;

