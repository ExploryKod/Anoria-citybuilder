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

    /**
     * Get financial summary grouped by month
     * @returns {Promise<Array>} Array of monthly summaries sorted by year/month descending
     */
    async getMonthlyFinancialSummary() {
        const entries = await this.getJournalEntries();
        
        // Grouper par (year, month)
        const grouped = {};
        
        entries.forEach(entry => {
            // Convertir turn → timeInfo
            if (!window.TimeManager) {
                console.warn('[JournalManager] TimeManager not available');
                return;
            }
            
            const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
            const key = `${timeInfo.year}-${timeInfo.monthIndex}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    year: timeInfo.year,
                    month: timeInfo.monthIndex,
                    monthName: timeInfo.month,
                    income: { total: 0, entries: [] },
                    expenses: { total: 0, entries: [] },
                    entryCount: 0
                };
            }
            
            // Classer comme revenu ou dépense
            const isIncome = entry.type === 'income';
            
            if (isIncome) {
                grouped[key].income.total += entry.amount;
                grouped[key].income.entries.push({
                    type: entry.type,
                    amount: entry.amount,
                    description: entry.description,
                    date: entry.date,
                    turn: entry.turn
                });
            } else {
                grouped[key].expenses.total += entry.amount;
                grouped[key].expenses.entries.push({
                    type: entry.type,
                    amount: entry.amount,
                    description: entry.description,
                    date: entry.date,
                    turn: entry.turn
                });
            }
            
            grouped[key].entryCount++;
        });
        
        // Calculer netFlow pour chaque mois
        Object.values(grouped).forEach(month => {
            month.netFlow = month.income.total - month.expenses.total;
        });
        
        // Trier par année puis mois (décroissant)
        return Object.values(grouped).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
    }

    /**
     * Get financial summary grouped by year
     * @returns {Promise<Array>} Array of yearly summaries sorted by year descending
     */
    async getYearlyFinancialSummary() {
        const monthlyData = await this.getMonthlyFinancialSummary();
        
        // Grouper par année
        const grouped = {};
        
        monthlyData.forEach(month => {
            const year = month.year;
            
            if (!grouped[year]) {
                grouped[year] = {
                    year: year,
                    income: { total: 0, entries: [] },
                    expenses: { total: 0, entries: [] },
                    monthCount: 0,
                    months: []  // Détail des mois pour cette année
                };
            }
            
            grouped[year].income.total += month.income.total;
            grouped[year].expenses.total += month.expenses.total;
            grouped[year].income.entries.push(...month.income.entries);
            grouped[year].expenses.entries.push(...month.expenses.entries);
            grouped[year].monthCount++;
            grouped[year].months.push(month);
        });
        
        // Calculer netFlow pour chaque année
        Object.values(grouped).forEach(year => {
            year.netFlow = year.income.total - year.expenses.total;
        });
        
        // Trier par année décroissante
        return Object.values(grouped).sort((a, b) => b.year - a.year);
    }
}

// Create singleton instance
const journalManager = new JournalManager();

export default journalManager;
export { JournalManager };

