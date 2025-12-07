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
            // Revenus: 'income', 'capital_funds', 'carry_forward' (si netFlow précédent positif)
            // Dépenses: 'construction', 'maintenance', 'loan_interest', 'loan_repayment', 'exceptional_expenses', 'carry_forward' (si netFlow précédent négatif)
            let isIncome = entry.type === 'income' || entry.type === 'capital_funds';
            
            if (entry.type === 'carry_forward') {
                // Pour le report à nouveau, déterminer si c'est un revenu ou une dépense
                // en fonction du signe stocké dans la description
                // Format: "Report à nouveau de l'année X (signe)"
                const signMatch = entry.description?.match(/\(([+-])\)/);
                if (signMatch) {
                    isIncome = signMatch[1] === '+';
                } else {
                    // Fallback: calculer depuis le netFlow de l'année précédente
                    const previousYear = timeInfo.year - 1;
                    if (previousYear >= 0) {
                        // Calculer le netFlow de l'année précédente en EXCLUANT le report à nouveau
                        let prevYearIncome = 0;
                        let prevYearExpenses = 0;
                        
                        entries.forEach(e => {
                            if (e.type === 'carry_forward') return; // Exclure tous les reports à nouveau
                            
                            if (!window.TimeManager) return;
                            const eTimeInfo = window.TimeManager.getTimeInfo(e.turn);
                            
                            if (eTimeInfo.year === previousYear) {
                                const isEIncome = e.type === 'income' || e.type === 'capital_funds';
                                if (isEIncome) {
                                    prevYearIncome += e.amount;
                                } else {
                                    prevYearExpenses += e.amount;
                                }
                            }
                        });
                        
                        const prevYearNetFlow = prevYearIncome - prevYearExpenses;
                        isIncome = prevYearNetFlow >= 0;
                    } else {
                        // Année 0, pas de report à nouveau (ne devrait pas arriver)
                        isIncome = true;
                    }
                }
            }
            
            if (isIncome) {
                grouped[key].income.total += entry.amount;
                grouped[key].income.entries.push({
                    type: entry.type,
                    amount: entry.amount,
                    description: entry.description,
                    date: entry.date,
                    turn: entry.turn,
                    isCarryForwardIncome: entry.type === 'carry_forward' ? true : undefined
                });
            } else {
                grouped[key].expenses.total += entry.amount;
                grouped[key].expenses.entries.push({
                    type: entry.type,
                    amount: entry.amount,
                    description: entry.description,
                    date: entry.date,
                    turn: entry.turn,
                    isCarryForwardIncome: entry.type === 'carry_forward' ? false : undefined
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
     * Create carry forward entry (report à nouveau) for the beginning of a new year
     * Le report à nouveau de l'année N est le SOLDE (netFlow) de l'année N-1
     * Ce solde inclut déjà le report à nouveau de l'année N-1 dans son calcul
     * @param {number} turn - Turn number (should be turn 1 of the new year)
     * @returns {Promise<void>}
     */
    async createCarryForwardEntry(turn) {
        // Vérifier qu'on n'a pas déjà créé cette entrée pour ce tour
        const existingEntries = await this.getJournalEntriesForTurn(turn);
        const hasCarryForward = existingEntries.some(entry => entry.type === 'carry_forward');
        
        if (hasCarryForward) {
            console.log('[JournalManager] Carry forward entry already exists for turn', turn);
            return;
        }
        
        if (!window.TimeManager) {
            console.warn('[JournalManager] TimeManager not available, cannot create carry forward entry');
            return;
        }
        
        const currentTimeInfo = window.TimeManager.getTimeInfo(turn);
        const previousYear = currentTimeInfo.year - 1;
        
        // Si on est en année 0, pas de report à nouveau
        if (previousYear < 0) {
            return;
        }
        
        // Calculer le solde de l'année précédente en EXCLUANT le report à nouveau de l'année courante
        // (qui n'existe pas encore, mais on veut s'assurer qu'on utilise exactement le même calcul)
        // On recalcule directement depuis les entrées pour être sûr d'avoir la valeur exacte
        const allEntries = await this.getJournalEntries();
        
        let prevYearIncome = 0;
        let prevYearExpenses = 0;
        
        allEntries.forEach(entry => {
            const entryTimeInfo = window.TimeManager.getTimeInfo(entry.turn);
            if (entryTimeInfo.year !== previousYear) {
                return; // Ignorer les entrées d'autres années
            }
            
            // Classer l'entrée comme revenu ou dépense (même logique que getMonthlyFinancialSummary)
            let isIncome = entry.type === 'income' || entry.type === 'capital_funds';
            
            if (entry.type === 'carry_forward') {
                // Pour le report à nouveau, déterminer si c'est un revenu ou une dépense
                const signMatch = entry.description?.match(/\(([+-])\)/);
                if (signMatch) {
                    isIncome = signMatch[1] === '+';
                } else {
                    // Fallback: si pas de signe, traiter comme revenu par défaut
                    isIncome = true;
                }
            }
            
            if (isIncome) {
                prevYearIncome += entry.amount;
            } else {
                prevYearExpenses += entry.amount;
            }
        });
        
        // Le solde de l'année précédente = revenus - dépenses
        // C'est exactement le même calcul que celui utilisé dans getYearlyFinancialSummary()
        const previousYearNetFlow = prevYearIncome - prevYearExpenses;
        
        // Le montant est toujours positif dans IndexedDB
        // Le signe du netFlow détermine si c'est revenu (positif) ou dépense (négatif)
        // Utiliser exactement la valeur absolue du netFlow sans arrondi supplémentaire
        const amount = Math.abs(previousYearNetFlow);
        const yearDisplay = previousYear === 0 ? '0 JC' : `${previousYear} ap JC`;
        // Stocker le signe dans la description pour pouvoir le récupérer lors du calcul
        const isPositive = previousYearNetFlow >= 0;
        const signIndicator = isPositive ? '+' : '-';
        const description = `Report à nouveau de l'année ${yearDisplay} (${signIndicator})`;
        
        await this.addJournalEntry(turn, 'carry_forward', amount, description);
        console.log('[JournalManager] Created carry forward entry:', {
            turn,
            amount,
            previousYearNetFlow,
            previousYear,
            previousYearIncome: prevYearIncome,
            previousYearExpenses: prevYearExpenses,
            calculatedNetFlow: previousYearNetFlow,
            isIncome: isPositive
        });
    }

    /**
     * Calculate current balance (solde) from all journal entries
     * @returns {Promise<number>} Current balance (cumulative income - cumulative expenses)
     */
    async getCurrentBalance() {
        const entries = await this.getJournalEntries();
        let balance = 0;
        
        entries.forEach(entry => {
            // Utiliser la même logique que getMonthlyFinancialSummary() pour classer les entrées
            let isIncome = entry.type === 'income' || entry.type === 'capital_funds';
            
            // Traiter les reports à nouveau de la même manière que dans getMonthlyFinancialSummary
            if (entry.type === 'carry_forward') {
                // Pour le report à nouveau, déterminer si c'est un revenu ou une dépense
                // en fonction du signe stocké dans la description
                // Format: "Report à nouveau de l'année X (signe)"
                const signMatch = entry.description?.match(/\(([+-])\)/);
                if (signMatch) {
                    isIncome = signMatch[1] === '+';
                } else {
                    // Fallback: si pas de signe dans la description, calculer depuis le netFlow de l'année précédente
                    if (!window.TimeManager) {
                        // Si TimeManager n'est pas disponible, traiter comme revenu par défaut
                        isIncome = true;
                    } else {
                        const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
                        const previousYear = timeInfo.year - 1;
                        if (previousYear >= 0) {
                            // Calculer le netFlow de l'année précédente en EXCLUANT le report à nouveau
                            let prevYearIncome = 0;
                            let prevYearExpenses = 0;
                            
                            entries.forEach(e => {
                                if (e.type === 'carry_forward') return; // Exclure tous les reports à nouveau
                                
                                if (!window.TimeManager) return;
                                const eTimeInfo = window.TimeManager.getTimeInfo(e.turn);
                                
                                if (eTimeInfo.year === previousYear) {
                                    const isEIncome = e.type === 'income' || e.type === 'capital_funds';
                                    if (isEIncome) {
                                        prevYearIncome += e.amount;
                                    } else {
                                        prevYearExpenses += e.amount;
                                    }
                                }
                            });
                            
                            const prevYearNetFlow = prevYearIncome - prevYearExpenses;
                            isIncome = prevYearNetFlow >= 0;
                        } else {
                            // Année 0, pas de report à nouveau (ne devrait pas arriver)
                            isIncome = true;
                        }
                    }
                }
            }
            
            // Tous les autres types sont des dépenses (construction, maintenance, exceptional_expenses, loan_interest, loan_repayment, etc.)
            
            if (isIncome) {
                balance += entry.amount;
            } else {
                balance -= entry.amount;
            }
        });
        
        return balance;
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
        
        // Calculer netFlow pour chaque année (le solde de l'année = netFlow de l'année)
        Object.values(grouped).forEach(year => {
            year.netFlow = year.income.total - year.expenses.total;
        });
        
        // Trier par année décroissante pour l'affichage
        return Object.values(grouped).sort((a, b) => b.year - a.year);
    }
}

// Create singleton instance
const journalManager = new JournalManager();

export default journalManager;
export { JournalManager };

