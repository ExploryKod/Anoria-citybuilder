import db from './db.js';

/**
 * JournalManager - Manages journal entries (accounting entries)
 * Handles all operations related to the journal (db.journal)
 */
class JournalManager {
    constructor() {
        this.db = db;
    }

    /**
     * Add journal entry (écriture comptable)
     * @param {number} turn - Turn number
     * @param {string} type - Type of entry ('income', 'expense', 'loan_interest', 'loan_repayment', etc.)
     * @param {number} amount - Amount
     * @param {string} description - Description
     */
    async addJournalEntry(turn, type, amount, description) {
        try {
            await this.db.journal.add({
                turn: turn,
                date: new Date().toISOString(),
                type: type,
                amount: amount,
                description: description
            });
        } catch (error) {
            console.error('Error adding journal entry:', error);
        }
    }

    /**
     * Get journal entries
     * @param {number} maxAge - Maximum age in days (optional)
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntries(maxAge = null) {
        let entries = await this.db.journal.toArray();
        
        if (maxAge) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAge);
            
            entries = entries.filter(entry => new Date(entry.date) >= cutoffDate);
        }
        
        // Sort by turn descending, then by date descending
        return entries.sort((a, b) => {
            if (a.turn !== b.turn) {
                return b.turn - a.turn;
            }
            return new Date(b.date) - new Date(a.date);
        });
    }

    /**
     * Get journal entries for a specific turn
     * @param {number} turn - Turn number
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntriesForTurn(turn) {
        return await this.db.journal.where('turn').equals(turn).sortBy('date');
    }

    /**
     * Cleanup old journal entries
     * @param {number} maxAge - Maximum age in days
     */
    async cleanupOldJournalEntries(maxAge = 60) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);
        const cutoffISO = cutoffDate.toISOString();
        
        const oldEntries = await this.db.journal.where('date').below(cutoffISO).toArray();
        
        if (oldEntries.length > 0) {
            const ids = oldEntries.map(entry => entry.id);
            await this.db.journal.bulkDelete(ids);
        }
        
        return { deleted: oldEntries.length };
    }

    /**
     * Clear all journal entries
     * @returns {Promise<number>} Number of entries deleted
     */
    async clearAllEntries() {
        const count = await this.db.journal.count();
        await this.db.journal.clear();
        return count;
    }

    /**
     * Get journal statistics
     * @returns {Promise<Object>} Statistics about journal entries
     */
    async getStatistics() {
        const entries = await this.db.journal.toArray();
        
        const stats = {
            totalEntries: entries.length,
            byType: {},
            totalIncome: 0,
            totalExpenses: 0,
            earliestEntry: null,
            latestEntry: null
        };

        if (entries.length === 0) {
            return stats;
        }

        // Calculate statistics
        entries.forEach(entry => {
            // Count by type
            if (!stats.byType[entry.type]) {
                stats.byType[entry.type] = 0;
            }
            stats.byType[entry.type]++;

            // Calculate totals
            if (entry.type === 'income') {
                stats.totalIncome += entry.amount;
            } else {
                stats.totalExpenses += entry.amount;
            }
        });

        // Find earliest and latest entries
        const sortedByDate = [...entries].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        stats.earliestEntry = sortedByDate[0];
        stats.latestEntry = sortedByDate[sortedByDate.length - 1];

        return stats;
    }
}

// Create singleton instance
const journalManager = new JournalManager();

export default journalManager;
export { JournalManager };

