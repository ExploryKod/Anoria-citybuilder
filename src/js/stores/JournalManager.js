import db from '../../core/persistence/dexie/db.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
  filterAndSortJournalEntries,
} from '../../contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js';

/**
 * JournalManager - Manages journal entries (accounting entries)
 * Handles all operations related to the journal (db.journal)
 */
class JournalManager {
    constructor() {
        this.db = db;
        this.LOCALSTORAGE_KEY = 'journal_year_end_balances';
    }

    /** @returns {(turn: number) => object|null} */
    _getTimeInfoResolver() {
        const timeManager =
            (typeof window !== 'undefined' ? window : global)?.TimeManager;
        if (!timeManager) {
            return () => null;
        }
        return (turn) => timeManager.getTimeInfo(turn);
    }

    /**
     * Calculer et sauvegarder le solde de fin d'année dans localStorage
     * Utilise EXACTEMENT la même méthode que celle qui affiche le solde dans le journal HTML
     * C'est la même séquence d'appels que dans loadJournalEntries() :
     * 1. manager.getYearlyFinancialSummary()
     * 2. yearData.netFlow (affiché dans le HTML)
     * @param {number} year - Année
     * @returns {Promise<number>} Le solde calculé (netFlow)
     */
    async calculateAndSaveYearEndBalance(year) {
        // Utiliser EXACTEMENT la même méthode que celle utilisée dans loadJournalEntries()
        // buttons.js ligne 4489: const yearlyData = await manager.getYearlyFinancialSummary();
        // buttons.js ligne 4522: yearData.netFlow (affiché dans le HTML)
        const yearlyData = await this.getYearlyFinancialSummary();
        const yearData = yearlyData.find(y => y.year === year);
        
        if (!yearData) {
            console.warn(`[JournalManager] No data found for year ${year} in getYearlyFinancialSummary()`);
            return 0;
        }
        
        // Utiliser EXACTEMENT le même netFlow que celui affiché dans le journal HTML
        // C'est exactement ce qui est utilisé dans buttons.js ligne 4522:
        // <span class="amount">${yearData.netFlow >= 0 ? '+' : ''}${yearData.netFlow}€</span>
        const netFlow = yearData.netFlow;
        
        // Sauvegarder dans localStorage avec la même valeur exacte
        this.saveYearEndBalance(year, netFlow);
        
        return netFlow;
    }

    /**
     * Sauvegarder le solde de fin d'année dans localStorage
     * @param {number} year - Année
     * @param {number} netFlow - Solde de l'année (revenus - dépenses)
     */
    saveYearEndBalance(year, netFlow) {
        try {
            const stored = localStorage.getItem(this.LOCALSTORAGE_KEY);
            let soldes = stored ? JSON.parse(stored) : [];
            
            // Supprimer l'entrée existante pour cette année si elle existe
            soldes = soldes.filter(s => s.an !== year);
            
            // Ajouter le nouveau solde
            const nature = netFlow >= 0 ? 'revenue' : 'deficit';
            const amount = Math.abs(netFlow);
            
            soldes.push({
                an: year,
                nature: nature,
                amount: amount
            });
            
            // Trier par année
            soldes.sort((a, b) => a.an - b.an);
            
            localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(soldes));
        } catch (error) {
            console.error('[JournalManager] Error saving year end balance:', error);
        }
    }

    /**
     * Récupérer le solde de fin d'année depuis localStorage
     * Retourne le dernier solde (le plus récent turn) pour une année donnée
     * @param {number} year - Année
     * @returns {Object|null} {an, nature, amount, turn, date} ou null si non trouvé
     */
    getYearEndBalance(year) {
        try {
            const stored = localStorage.getItem(this.LOCALSTORAGE_KEY);
            if (!stored) return null;
            
            const soldes = JSON.parse(stored);
            // Filtrer par année et prendre le plus récent (turn le plus élevé)
            const yearSoldes = soldes.filter(s => s.an === year);
            if (yearSoldes.length === 0) return null;
            
            // Trier par turn décroissant et prendre le premier (le plus récent)
            yearSoldes.sort((a, b) => (b.turn || 0) - (a.turn || 0));
            return yearSoldes[0];
        } catch (error) {
            console.error('[JournalManager] Error getting year end balance:', error);
            return null;
        }
    }

    /**
     * Récupérer tous les soldes de fin d'année
     * @returns {Array} Tableau de {an, nature, amount}
     */
    getAllYearEndBalances() {
        try {
            const stored = localStorage.getItem(this.LOCALSTORAGE_KEY);
            if (!stored) return [];
            
            return JSON.parse(stored);
        } catch (error) {
            console.error('[JournalManager] Error getting all year end balances:', error);
            return [];
        }
    }

    /**
     * Add journal entry (écriture comptable)
     * @param {number} turn - Turn number
     * @param {string} type - Type of entry ('citizen_tax', 'expense', 'loan_interest', 'loan_repayment', etc.)
     * @param {number} amount - Amount
     * @param {string} description - Description
     */
    async addJournalEntry(turn, type, amount, description, partnerId = null) {
        try {
            // Obtenir le mois et l'année depuis TimeManager
            let month = null;
            let year = null;
            
            // Support both window (browser) and global (Node/Jest)
            const timeManager = (typeof window !== 'undefined' ? window : global)?.TimeManager;
            if (timeManager) {
                const timeInfo = timeManager.getTimeInfo(turn);
                month = timeInfo.monthIndex + 1; // monthIndex est 0-indexed (0=janvier), on veut 1-12
                year = timeInfo.year;
            }
            
            const entry = {
                turn: turn,
                date: new Date().toISOString(),
                type: type,
                amount: amount,
                description: description,
                month: month,
                year: year
            };
            
            if (partnerId) {
                entry.partnerId = partnerId;
            }
            
            await this.db.journal.add(entry);
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
        const entries = await this.db.journal.toArray();
        return filterAndSortJournalEntries(entries, maxAge);
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
            // Revenus: citizen_tax, payroll_tax, capital_funds, loan_capital, export_*
            // Dépenses: tout le reste (construction, maintenance, salary, import_*, etc.)
            if (entry.type === 'citizen_tax' || entry.type === 'payroll_tax' || entry.type === 'capital_funds' || entry.type === 'loan_capital' || entry.type.startsWith('export_')) {
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
        const getTimeInfo = this._getTimeInfoResolver();
        if (!getTimeInfo(0) && entries.length > 0) {
            console.warn('[JournalManager] TimeManager not available');
        }
        return buildMonthlyFinancialSummary(entries, getTimeInfo);
    }

    /**
     * Create carry forward entry (report à nouveau) for the beginning of a new year
     * Le report à nouveau de l'année N est le SOLDE (netFlow) de l'année N-1
     * Ce solde est récupéré depuis localStorage pour garantir l'exactitude
     * @param {number} turn - Turn number (should be turn 1 of the new year)
     * @returns {Promise<void>}
     */
    async createCarryForwardEntry(turn) {
        // Vérifier qu'on n'a pas déjà créé cette entrée pour ce tour
        const existingEntries = await this.getJournalEntriesForTurn(turn);
        const hasCarryForward = existingEntries.some(entry => entry.type === 'carry_forward');
        
        if (hasCarryForward) {
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
        
        // Récupérer le solde de fin d'année depuis localStorage
        const yearEndBalance = this.getYearEndBalance(previousYear);
        
        if (!yearEndBalance || typeof yearEndBalance.amount !== 'number' || isNaN(yearEndBalance.amount)) {
            const previousYearNetFlow = await this.calculateAndSaveYearEndBalance(previousYear);
            
            if (typeof previousYearNetFlow !== 'number' || isNaN(previousYearNetFlow)) {
                console.warn(`[JournalManager] Could not calculate year end balance for year ${previousYear}`);
                return;
            }
            
            const nature = previousYearNetFlow >= 0 ? 'revenue' : 'deficit';
            const amount = Math.abs(previousYearNetFlow);
            
            const yearDisplay = previousYear === 0 ? '0 JC' : `${previousYear} ap JC`;
            const signIndicator = nature === 'revenue' ? '+' : '-';
            const description = `Report à nouveau de l'année ${yearDisplay} (${signIndicator})`;
            
            await this.addJournalEntry(turn, 'carry_forward', amount, description);
            return;
        }
        
        // Utiliser le solde stocké dans localStorage (garantit l'exactitude)
        const amount = yearEndBalance.amount;
        const nature = yearEndBalance.nature;
        const isPositive = nature === 'revenue';
        const yearDisplay = previousYear === 0 ? '0 JC' : `${previousYear} ap JC`;
        const signIndicator = isPositive ? '+' : '-';
        const description = `Report à nouveau de l'année ${yearDisplay} (${signIndicator})`;
        
        await this.addJournalEntry(turn, 'carry_forward', amount, description);
    }

    /**
     * Créer les entrées de cumul de tous les types de dépenses pour une année
     * Ces entrées sont créées à la fin de l'année (décembre)
     * @param {number} year - Année pour laquelle créer les cumuls
     * @param {number} turn - Turn number (dernier turn de l'année)
     * @returns {Promise<void>}
     */
    async createCumulEntries(year, turn) {
        if (!window.TimeManager) {
            console.warn('[JournalManager] TimeManager not available, cannot create cumul entries');
            return;
        }

        // Récupérer toutes les entrées du journal pour cette année
        const allEntries = await this.getJournalEntries();
        const yearEntries = allEntries.filter(entry => {
            const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
            return timeInfo.year === year;
        });

        // Calculer les cumuls pour tous les types de dépenses
        const maintenanceCumul = yearEntries
            .filter(e => e.type === 'maintenance')
            .reduce((sum, e) => sum + e.amount, 0);

        const constructionCumul = yearEntries
            .filter(e => e.type === 'construction')
            .reduce((sum, e) => sum + e.amount, 0);

        const salaryCumul = yearEntries
            .filter(e => e.type === 'salary')
            .reduce((sum, e) => sum + e.amount, 0);

        const exceptionalExpensesCumul = yearEntries
            .filter(e => e.type === 'exceptional_expenses')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const loanInterestCumul = yearEntries
            .filter(e => e.type === 'loan_interest')
            .reduce((sum, e) => sum + e.amount, 0);
        
        const loanRepaymentCumul = yearEntries
            .filter(e => e.type === 'loan_repayment')
            .reduce((sum, e) => sum + e.amount, 0);

        // Vérifier si les entrées de cumul existent déjà pour ce turn
        const existingEntries = await this.getJournalEntriesForTurn(turn);
        const yearDisplay = year === 0 ? '0 JC' : `${year} ap JC`;
        
        const hasMaintenanceCumul = existingEntries.some(e => e.type === 'cumul_maintenance' && e.description?.includes(`Année ${yearDisplay}`));
        const hasConstructionCumul = existingEntries.some(e => e.type === 'cumul_construction' && e.description?.includes(`Année ${yearDisplay}`));
        const hasSalaryCumul = existingEntries.some(e => e.type === 'cumul_salary' && e.description?.includes(`Année ${yearDisplay}`));
        const hasExceptionalExpensesCumul = existingEntries.some(e => e.type === 'cumul_exceptional_expenses' && e.description?.includes(`Année ${yearDisplay}`));
        const hasLoanInterestCumul = existingEntries.some(e => e.type === 'cumul_loan_interest' && e.description?.includes(`Année ${yearDisplay}`));
        const hasLoanRepaymentCumul = existingEntries.some(e => e.type === 'cumul_loan_repayment' && e.description?.includes(`Année ${yearDisplay}`));

        // Créer les entrées de cumul si elles n'existent pas et si le cumul > 0
        if (!hasMaintenanceCumul && maintenanceCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_maintenance', maintenanceCumul, `Cumul Maintenance - Année ${yearDisplay}`);
        }

        if (!hasConstructionCumul && constructionCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_construction', constructionCumul, `Cumul Construction - Année ${yearDisplay}`);
        }

        if (!hasSalaryCumul && salaryCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_salary', salaryCumul, `Cumul Salaires - Année ${yearDisplay}`);
        }

        if (!hasExceptionalExpensesCumul && exceptionalExpensesCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_exceptional_expenses', exceptionalExpensesCumul, `Cumul Réparations - Année ${yearDisplay}`);
        }

        if (!hasLoanInterestCumul && loanInterestCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_loan_interest', loanInterestCumul, `Cumul Intérêts Prêt - Année ${yearDisplay}`);
        }

        if (!hasLoanRepaymentCumul && loanRepaymentCumul > 0) {
            await this.addJournalEntry(turn, 'cumul_loan_repayment', loanRepaymentCumul, `Cumul Remboursement Prêt - Année ${yearDisplay}`);
        }
    }

    /**
     * Ajouter une entrée de balance (solde) à chaque tour
     * Le solde vient de budget.funds (même source que display-funds)
     * @param {number} turn - Turn number
     * @param {number} balance - Solde actuel (budget.funds)
     * @returns {Promise<void>}
     */
    async addBalanceEntry(turn, balance) {
        // Vérifier si une entrée de balance existe déjà pour ce turn
        const existingEntries = await this.getJournalEntriesForTurn(turn);
        const hasBalance = existingEntries.some(e => e.type === 'balance');
        
        if (!hasBalance) {
            await this.addJournalEntry(turn, 'balance', balance, 'Solde');
        } else {
            // Mettre à jour l'entrée existante si le solde a changé
            const existingBalance = existingEntries.find(e => e.type === 'balance');
            if (existingBalance && existingBalance.amount !== balance) {
                // Mettre à jour l'entrée existante
                await this.db.journal.update(existingBalance.id, { amount: balance });
                console.info(`[JournalManager] Updated balance entry for turn ${turn}: ${balance}€`);
            }
        }
    }

    /**
     * Calculate current balance (solde) from all journal entries
     * @returns {Promise<number>} Current balance (cumulative income - cumulative expenses)
     */
    async getCurrentBalance() {
        const entries = await this.getJournalEntries();
        return computeJournalCurrentBalance(entries, this._getTimeInfoResolver());
    }

    /**
     * Get financial summary grouped by year
     * @returns {Promise<Array>} Array of yearly summaries sorted by year descending
     */
    async getYearlyFinancialSummary() {
        const monthlyData = await this.getMonthlyFinancialSummary();
        return buildYearlyFinancialSummary(monthlyData);
    }

    /**
     * Export journal to JSON format
     * @returns {Promise<string>} JSON string of all journal data
     */
    async exportToJSON() {
        try {
            const entries = await this.getJournalEntries();
            const yearlyData = await this.getYearlyFinancialSummary();
            const yearEndBalances = this.getAllYearEndBalances();
            
            const exportData = {
                exportDate: new Date().toISOString(),
                entries: entries.map(entry => ({
                    id: entry.id,
                    turn: entry.turn,
                    date: entry.date,
                    type: entry.type,
                    amount: entry.amount,
                    description: entry.description
                })),
                yearlySummary: yearlyData.map(year => ({
                    year: year.year,
                    income: year.income.total,
                    expenses: year.expenses.total,
                    netFlow: year.netFlow,
                    monthCount: year.monthCount
                })),
                yearEndBalances: yearEndBalances
            };
            
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('[JournalManager] Error exporting to JSON:', error);
            throw error;
        }
    }

    /**
     * Export journal to PDF format
     * Uses jsPDF library (loaded from CDN)
     * @returns {Promise<Blob>} PDF blob
     */
    async exportToPDF() {
        try {
            // Check if jsPDF is available
            if (typeof window.jsPDF === 'undefined' && !(window.jspdf && window.jspdf.jsPDF)) {
                // Load jsPDF from CDN
                await this.loadJSPDF();
            }
            
            // Get jsPDF constructor (can be window.jsPDF or window.jspdf.jsPDF)
            const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
            if (!jsPDF) {
                throw new Error('jsPDF not available after loading');
            }
            
            const doc = new jsPDF();
            
            const yearlyData = await this.getYearlyFinancialSummary();
            const entries = await this.getJournalEntries();
            
            // Title
            doc.setFontSize(18);
            doc.text('Journal des Écritures Comptables', 14, 20);
            
            // Export date
            doc.setFontSize(10);
            doc.text(`Exporté le: ${new Date().toLocaleString('fr-FR')}`, 14, 30);
            
            let yPosition = 40;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 14;
            const lineHeight = 7;
            
            // Yearly summaries
            doc.setFontSize(14);
            doc.text('Résumé par Année', margin, yPosition);
            yPosition += 10;
            
            doc.setFontSize(10);
            yearlyData.forEach(yearData => {
                // Check if we need a new page
                if (yPosition > pageHeight - 30) {
                    doc.addPage();
                    yPosition = margin;
                }
                
                const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
                doc.setFont(undefined, 'bold');
                doc.text(`Année ${yearDisplay}`, margin, yPosition);
                yPosition += lineHeight;
                
                doc.setFont(undefined, 'normal');
                doc.text(`Revenus: ${yearData.income.total}€`, margin + 5, yPosition);
                yPosition += lineHeight;
                doc.text(`Dépenses: ${yearData.expenses.total}€`, margin + 5, yPosition);
                yPosition += lineHeight;
                
                const netFlowColor = yearData.netFlow >= 0 ? [0, 128, 0] : [255, 0, 0];
                doc.setTextColor(...netFlowColor);
                doc.text(`Solde: ${yearData.netFlow >= 0 ? '+' : ''}${yearData.netFlow}€`, margin + 5, yPosition);
                doc.setTextColor(0, 0, 0);
                yPosition += lineHeight + 3;
            });
            
            // Detailed entries (first 100 entries to avoid PDF size issues)
            // EXCLURE les cumuls et les balances (informatifs seulement)
            yPosition += 5;
            doc.setFontSize(14);
            doc.text('Détail des Écritures', margin, yPosition);
            yPosition += 10;
            
            doc.setFontSize(8);
            const entriesToExport = entries.filter(e => 
                e.type !== 'cumul_maintenance' && 
                e.type !== 'cumul_construction' && 
                e.type !== 'cumul_salary' &&
                e.type !== 'cumul_exceptional_expenses' &&
                e.type !== 'cumul_loan_interest' &&
                e.type !== 'cumul_loan_repayment' &&
                e.type !== 'balance'
            );
            const maxEntries = Math.min(entriesToExport.length, 100);
            for (let i = 0; i < maxEntries; i++) {
                const entry = entriesToExport[i];
                
                // Check if we need a new page
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = margin;
                }
                
                const date = new Date(entry.date).toLocaleDateString('fr-FR');
                const typeLabels = {
                    'citizen_tax': 'Impôt Citoyen',
                    'payroll_tax': 'Impôt sur les salaires',
                    'capital_funds': 'Capital',
                    'loan_capital': 'Capital Prêt',
                    'construction': 'Construction',
                    'maintenance': 'Maintenance',
                    'salary': 'Salaires',
                    'exceptional_expenses': 'Réparation',
                    'import_wheat': 'Import Blé',
                    'import_carrot': 'Import Carotte',
                    'import_cabbage': 'Import Chou',
                    'import_wood': 'Import Bois',
                    'export_wheat': 'Export Blé',
                    'export_carrot': 'Export Carotte',
                    'export_cabbage': 'Export Chou',
                    'export_wood': 'Export Bois',
                    'loan_interest': 'Intérêts',
                    'loan_repayment': 'Remboursement',
                    'carry_forward': 'Report'
                };
                
                const typeLabel = typeLabels[entry.type] || entry.type;
                const isIncomeType = entry.type === 'citizen_tax' || entry.type === 'payroll_tax' || entry.type === 'capital_funds' || entry.type === 'loan_capital' || 
                                   entry.type.startsWith('export_') ||
                                   (entry.type === 'carry_forward' && entry.description?.includes('(+)'));
                const amountText = isIncomeType ? `+${entry.amount}€` : `-${entry.amount}€`;
                
                doc.text(`${date} - ${typeLabel}: ${amountText}`, margin, yPosition);
                yPosition += lineHeight;
                doc.text(`  ${entry.description}`, margin + 5, yPosition);
                yPosition += lineHeight + 2;
            }
            
            if (entries.length > maxEntries) {
                doc.text(`... et ${entries.length - maxEntries} autres entrées`, margin, yPosition);
            }
            
            // Generate blob
            const pdfBlob = doc.output('blob');
            return pdfBlob;
        } catch (error) {
            console.error('[JournalManager] Error exporting to PDF:', error);
            throw error;
        }
    }

    /**
     * Load jsPDF library from CDN
     * @returns {Promise<void>}
     */
    async loadJSPDF() {
        return new Promise((resolve, reject) => {
            // Check if jsPDF is already loaded (different possible global names)
            if (typeof window.jsPDF !== 'undefined' || (window.jspdf && window.jspdf.jsPDF)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                // jsPDF can be available as window.jsPDF or window.jspdf.jsPDF
                if (typeof window.jsPDF !== 'undefined' || (window.jspdf && window.jspdf.jsPDF)) {
                    resolve();
                } else {
                    reject(new Error('jsPDF failed to load'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load jsPDF from CDN'));
            document.head.appendChild(script);
        });
    }
}

// Create singleton instance
const journalManager = new JournalManager();

export default journalManager;
export { JournalManager };

