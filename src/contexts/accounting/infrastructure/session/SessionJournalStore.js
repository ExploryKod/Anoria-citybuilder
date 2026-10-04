import db from '../../../../core/persistence/dexie/db.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
  filterAndSortJournalEntries,
} from '../adapters/persistence/dexie/journalAggregations.js';
import {
  buildJournalExportPayload,
  serializeJournalExportPayload,
} from '../../presentation/JournalExportViewModel.js';
import { BrowserJournalPdfExporter } from '../adapters/browser/BrowserJournalPdfExporter.js';
import { DexieJournalSessionPersistenceAdapter } from '../adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { sessionLedgerBuffer, SessionLedgerBuffer } from './SessionLedgerBuffer.js';
import { buildLedgerBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * SessionJournalStore — in-memory journal orchestration (Accounting BC infrastructure).
 */
export class SessionJournalStore {
    /** Writes are applied one at a time; a reader waits for the writes already queued (see `#settled`). */
    #writes = Promise.resolve();

    /**
     * @param {object} [deps]
     * @param {import('dexie').Dexie} [deps.db]
     * @param {import('../../../application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
     * @param {import('./SessionLedgerBuffer.js').SessionLedgerBuffer} [deps.sessionLedgerBuffer]
     */
    constructor(deps = {}) {
        this.db = deps.db ?? db;
        this.gameTimePort = deps.gameTimePort ?? null;
        this._buffer = deps.sessionLedgerBuffer ?? sessionLedgerBuffer;
        this.LOCALSTORAGE_KEY = 'journal_year_end_balances';
        this._sessionPersistence = null;
        this._pdfExporter = new BrowserJournalPdfExporter();
        this._registerFlushHooks();
    }

    /** @param {import('../../../application/ports/GameTimePort.js').GameTimePort} gameTimePort */
    setGameTimePort(gameTimePort) {
        this.gameTimePort = gameTimePort;
    }

    _registerFlushHooks() {
        if (typeof document === 'undefined') {
            return;
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flushSessionToDexie().catch((error) => {
                    console.error('[SessionJournalStore] visibility flush failed:', error);
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
        if (this.gameTimePort) {
            return (turn) => this.gameTimePort.getTimeInfo(turn);
        }
        return () => null;
    }

    /** @param {number} turn */
    _getTimeInfo(turn) {
        return this._getTimeInfoResolver()(turn);
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
            console.warn(`[SessionJournalStore] No data found for year ${year} in getYearlyFinancialSummary()`);
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
            console.error('[SessionJournalStore] Error saving year end balance:', error);
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
            console.error('[SessionJournalStore] Error getting year end balance:', error);
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
            console.error('[SessionJournalStore] Error getting all year end balances:', error);
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
        const recorded = this.#writes.then(() => this.#appendLine(turn, type, amount, description, partnerId, options));
        this.#writes = recorded.then(() => {}, () => {});
        return recorded;
    }

    /** A reader sees the journal only once every queued write has settled: no line is read half-written. */
    async #settled() {
        await this.#writes;
    }

    async #appendLine(turn, type, amount, description, partnerId, options) {
        try {
            await this.ensureHydrated();

            let month = null;
            let year = null;

            const timeInfo = this._getTimeInfo(turn);
            if (timeInfo) {
                month = timeInfo.monthIndex + 1;
                year = timeInfo.year;
            }
            const businessKey =
                options.businessKey ??
                (timeInfo ? buildLedgerBusinessKey(type, timeInfo, requireActiveHamletId()) : null);

            if (businessKey && this._buffer.hasBusinessKey(businessKey)) {
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

            if (options.loanId) {
                entry.loanId = options.loanId;
            }

            if (options.loan) {
                entry.loan = options.loan;
            }

            if (options.taxYear != null) {
                entry.taxYear = options.taxYear;
            }

            if (options.taxBreakdown) {
                entry.taxBreakdown = options.taxBreakdown;
            }

            const persist =
                options.persist ?? type !== 'balance';

            const appendResult = businessKey
                ? this._buffer.appendIfAbsent(entry, { persist })
                : { appended: true, record: this._buffer.append(entry, { persist }) };

            if (!appendResult.appended) {
                return {
                    recorded: false,
                    skipped: true,
                    reason: appendResult.reason ?? 'duplicate_business_key',
                };
            }

            // Write-through: the entry is on disk before the caller learns it is recorded. The treasury is derived
            // from the journal, so a line that is only in memory would be lost on reload while its effect is not.
            if (persist) {
                try {
                    await this._getSessionPersistence().flushPendingEntries();
                } catch (error) {
                    this._buffer.removeSession(appendResult.record.sessionId);
                    throw error;
                }
            }

            return { recorded: true, skipped: false, businessKey };
        } catch (error) {
            throw new Error(`[journal] could not record ${type} (turn ${turn}): ${error.message}`, { cause: error });
        }
    }

    /**
     * Get journal entries
     * @param {number} maxAge - Maximum age in days (optional)
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntries(maxAge = null) {
        await this.#settled();
        await this.ensureHydrated();
        const entries = this._buffer.getAllPublic();
        return filterAndSortJournalEntries(entries, maxAge);
    }

    /**
     * Get journal entries for a specific turn
     * @param {number} turn - Turn number
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntriesForTurn(turn) {
        await this.ensureHydrated();
        return this._buffer.getForTurn(turn);
    }

    /**
     * Purge whole fiscal years: every entry stamped with a year strictly before `latest - keepYears`, where
     * `latest` is the most recent year stamped in the journal. Never purges inside a year.
     *
     * Years are the ones stamped at write time and never recomputed from turns: the length of a year in turns is
     * `daysPerMonth * 12` and `daysPerMonth` is a setting, so a turn → year conversion with today's value would
     * re-interpret the whole history. Stamped years and the "latest" reference stay in the same frame.
     *
     * @param {number} keepYears - number of full years kept before the latest one
     */
    async cleanupOldJournalYears(keepYears) {
        if (!Number.isInteger(keepYears) || keepYears < 0) {
            throw new Error(`[journal] cleanupOldJournalYears needs an integer keepYears >= 0, got ${keepYears}`);
        }
        await this.ensureHydrated();

        const latestYear = this._buffer.latestFiscalYear();
        if (latestYear === null) {
            return { deleted: 0, cutoffYear: null };
        }
        const cutoffYear = latestYear - keepYears;
        this._buffer.removeEntriesBeforeYear(cutoffYear);

        const oldIds = await this.db.journal
            .filter((entry) => SessionLedgerBuffer.fiscalYearOf(entry) < cutoffYear)
            .primaryKeys();

        if (oldIds.length > 0) {
            await this.db.journal.bulkDelete(oldIds);
        }

        return { deleted: oldIds.length, cutoffYear };
    }

    /**
     * Clear all journal entries
     * @returns {Promise<number>} Number of entries deleted
     */
    async clearAllEntries() {
        await this.ensureHydrated();
        const bufferCount = this._buffer.clear();
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
        const entries = this._buffer.getAllPublic();
        
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
            console.warn('[SessionJournalStore] GameTimePort not available');
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
        
        if (!this.gameTimePort) {
            console.warn('[SessionJournalStore] GameTimePort not available, cannot create carry forward entry');
            return;
        }

        const currentTimeInfo = this._getTimeInfo(turn);
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
                console.warn(`[SessionJournalStore] Could not calculate year end balance for year ${previousYear}`);
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
        if (!this.gameTimePort) {
            console.warn('[SessionJournalStore] GameTimePort not available, cannot create cumul entries');
            return;
        }

        const allEntries = await this.getJournalEntries();
        const yearEntries = allEntries.filter(entry => {
            const timeInfo = this._getTimeInfo(entry.turn);
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
            await this.addJournalEntry(turn, 'cumul_salary', salaryCumul, `Cumul salaires fonctionnaires - Année ${yearDisplay}`);
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

        const existingBalance = this._buffer.findBalanceForTurn(turn);

        if (!existingBalance) {
            await this.addJournalEntry(turn, 'balance', balance, 'Solde', null, {
                persist: false,
            });
            return;
        }

        if (existingBalance.amount !== balance) {
            this._buffer.updateBalanceForTurn(turn, balance);
            console.info(`[SessionJournalStore] Updated balance entry for turn ${turn}: ${balance}€`);
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
            console.error('[SessionJournalStore] Error exporting to JSON:', error);
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
            console.error('[SessionJournalStore] Error exporting to PDF:', error);
            throw error;
        }
    }
}

// Shared singleton for composition root (inject gameTimePort via setGameTimePort).
const sessionJournalStore = new SessionJournalStore();

export default sessionJournalStore;
export { SessionJournalStore as JournalManager };

/** @internal Tests */
export function resetSessionJournalStoreForTests() {
  sessionJournalStore._buffer.reset();
}

