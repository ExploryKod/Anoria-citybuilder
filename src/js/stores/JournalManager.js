import db from '../../core/persistence/dexie/db.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
  filterAndSortJournalEntries,
  buildJournalExportPayload,
  serializeJournalExportPayload,
  BrowserJournalPdfExporter,
  DexieJournalSessionPersistenceAdapter,
} from '../acl/accountingJournalStore.js';
import {
  sessionLedgerBuffer,
} from './SessionLedgerBuffer.js';
import {
  buildLedgerBusinessKey,
} from './ledgerBusinessKeys.js';

/**
 * JournalManager - Manages journal entries (accounting entries)
 * Handles all operations related to the journal (db.journal)
 */
class JournalManager {
    constructor() {
        this.db = db;
        this.LOCALSTORAGE_KEY = 'journal_year_end_balances';
        this._sessionPersistence = null;
        this._pdfExporter = new BrowserJournalPdfExporter();
        this._registerFlushHooks();
    }

    _registerFlushHooks() {
        if (typeof document === 'undefined') {
            return;
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flushSessionToDexie().catch((error) => {
                    console.error('[JournalManager] visibility flush failed:', error);
                });
            }
        });
    }

    _getSessionPersistence() {
        if (!this._sessionPersistence || this._sessionPersistence.db !== this.db) {
            this._sessionPersistence = new DexieJournalSessionPersistenceAdapter(this.db);
        }
        return this._sessionPersistence;
    }

    /**
     * Load persisted journal rows into the session buffer once per session.
     * @returns {Promise<void>}
     */
    async ensureHydrated() {
        return this._getSessionPersistence().ensureHydrated();
    }

    /**
     * Batch-write pending session entries to IndexedDB (end of turn / tab hidden).
     * Balance snapshots are session-only and are never flushed.
     * @returns {Promise<{ flushed: number, failed: boolean, pending?: number }>}
     */
    async flushSessionToDexie() {
        return this._getSessionPersistence().flushPendingEntries();
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
    async addJournalEntry(turn, type, amount, description, partnerId = null, options = {}) {
        try {
            await this.ensureHydrated();

            let month = null;
            let year = null;

            const timeManager = (typeof window !== 'undefined' ? window : global)?.TimeManager;
            let timeInfo = null;
            if (timeManager) {
                timeInfo = timeManager.getTimeInfo(turn);
                month = timeInfo.monthIndex + 1;
                year = timeInfo.year;
            }

            const businessKey =
                options.businessKey ??
                (timeInfo ? buildLedgerBusinessKey(type, timeInfo) : null);

            if (businessKey && sessionLedgerBuffer.hasBusinessKey(businessKey)) {
                return { recorded: false, skipped: true, reason: 'duplicate_business_key' };
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

            if (businessKey) {
                entry.businessKey = businessKey;
            }

            if (options.buildingInstanceId) {
                entry.buildingInstanceId = options.buildingInstanceId;
            }

            const persist =
                options.persist ?? type !== 'balance';

            const appendResult = businessKey
                ? sessionLedgerBuffer.appendIfAbsent(entry, { persist })
                : { appended: true, record: sessionLedgerBuffer.append(entry, { persist }) };

            if (!appendResult.appended) {
                return {
                    recorded: false,
                    skipped: true,
                    reason: appendResult.reason ?? 'duplicate_business_key',
                };
            }

            return { recorded: true, skipped: false, businessKey };
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
        await this.ensureHydrated();
        const entries = sessionLedgerBuffer.getAllPublic();
        return filterAndSortJournalEntries(entries, maxAge);
    }

    /**
     * Get journal entries for a specific turn
     * @param {number} turn - Turn number
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntriesForTurn(turn) {
        await this.ensureHydrated();
        return sessionLedgerBuffer.getForTurn(turn);
    }

    /**
     * Cleanup old journal entries
     * @param {number} maxAge - Maximum age in days
     */
    async cleanupOldJournalEntries(maxAge = 60) {
        await this.ensureHydrated();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);
        const cutoffISO = cutoffDate.toISOString();

        sessionLedgerBuffer.removeEntriesBeforeDate(cutoffISO);

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
        await this.ensureHydrated();
        const bufferCount = sessionLedgerBuffer.clear();
        const idbCount = await this.db.journal.count();
        await this.db.journal.clear();
        return Math.max(bufferCount, idbCount);
    }

    /**
     * Get journal statistics
     * @returns {Promise<Object>} Statistics about journal entries
     */
    async getStatistics() {
        await this.ensureHydrated();
        const entries = sessionLedgerBuffer.getAllPublic();
        
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
        await this.ensureHydrated();

        const existingBalance = sessionLedgerBuffer.findBalanceForTurn(turn);

        if (!existingBalance) {
            await this.addJournalEntry(turn, 'balance', balance, 'Solde', null, {
                persist: false,
            });
            return;
        }

        if (existingBalance.amount !== balance) {
            sessionLedgerBuffer.updateBalanceForTurn(turn, balance);
            console.info(`[JournalManager] Updated balance entry for turn ${turn}: ${balance}€`);
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

            return serializeJournalExportPayload(
                buildJournalExportPayload({
                    entries,
                    yearlySummary: yearlyData,
                    yearEndBalances,
                })
            );
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
            const yearlyData = await this.getYearlyFinancialSummary();
            const entries = await this.getJournalEntries();
            return this._pdfExporter.export({ entries, yearlySummary: yearlyData });
        } catch (error) {
            console.error('[JournalManager] Error exporting to PDF:', error);
            throw error;
        }
    }
}

// Create singleton instance
const journalManager = new JournalManager();

export default journalManager;
export { JournalManager };

