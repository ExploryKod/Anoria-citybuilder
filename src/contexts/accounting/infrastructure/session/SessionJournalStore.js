import db from '../../../../core/persistence/dexie/db.js';
import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  filterAndSortJournalEntries,
} from '../adapters/persistence/dexie/journalAggregations.js';
import {
  buildJournalExportPayload,
  serializeJournalExportPayload,
} from '../../presentation/JournalExportViewModel.js';
import { BrowserJournalPdfExporter } from '../adapters/browser/BrowserJournalPdfExporter.js';
import { DexieJournalSessionPersistenceAdapter } from '../adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { sessionLedgerBuffer, SessionLedgerBuffer, toPublicEntry } from './SessionLedgerBuffer.js';
import { buildLedgerBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { buildYearClosingLine, isFoldedIntoClosing } from '../../domain/policies/YearClosingPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * SessionJournalStore — in-memory journal orchestration (Accounting BC infrastructure).
 */
export class SessionJournalStore {
    /**
     * Every access to the in-memory journal (a write, a read, a clear) runs on this queue, one at a time, in call order:
     * a read never sees a line that is still being written.
     */
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
     * Add journal entry (écriture comptable)
     * @param {number} turn - Turn number
     * @param {string} type - Type of entry ('citizen_tax', 'expense', 'loan_interest', 'loan_repayment', etc.)
     * @param {number} amount - Amount
     * @param {string} description - Description
     */
    async addJournalEntry(turn, type, amount, description, partnerId = null, options = {}) {
        return this.#queued(() => this.#appendLine(turn, type, amount, description, partnerId, options));
    }

    /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
    #queued(task) {
        const run = this.#writes.then(task);
        this.#writes = run.then(() => {}, () => {});
        return run;
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

            const persist = true;

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
                    this._buffer.removeSessionIds(new Set([appendResult.record.sessionId]));
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
        return this.#queued(async () => {
            await this.ensureHydrated();
            return filterAndSortJournalEntries(this._buffer.getAllPublic(), maxAge);
        });
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
        return this.#queued(() => this.#closeOldYears(keepYears));
    }

    /**
     * Each full year before the cutoff is closed per hamlet: its folded lines are replaced by one `year_closing` line
     * that keeps the year's net and its totals per type. Loan lines stay. One transaction per purge: the lines are never
     * half-replaced.
     */
    async #closeOldYears(keepYears) {
        await this.ensureHydrated();
        const latestYear = this._buffer.latestFiscalYear();
        if (latestYear === null) {
            return { closed: 0, deleted: 0, cutoffYear: null };
        }
        const cutoffYear = latestYear - keepYears;
        const folded = this._buffer.recordsFoldedBeforeYear(cutoffYear, isFoldedIntoClosing);

        const groups = new Map();
        for (const record of folded) {
            const key = `${record.hamletId}:${SessionLedgerBuffer.fiscalYearOf(record)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(record);
        }

        const date = new Date().toISOString();
        const closings = [...groups.values()].map((lines) => {
            const first = lines[0];
            return buildYearClosingLine({
              year: SessionLedgerBuffer.fiscalYearOf(first),
              hamletId: first.hamletId,
              lines: lines.map(toPublicEntry),
              getTimeInfo: (turn) => this._getTimeInfo(turn),
              date,
            });
        });

        const persistedIds = folded.filter((record) => record.persisted).map((record) => record.id);
        const newIds = [];
        await this.db.transaction('rw', this.db.journal, async () => {
            if (persistedIds.length > 0) {
                await this.db.journal.bulkDelete(persistedIds);
            }
            for (const closing of closings) {
                newIds.push(await this.db.journal.add(closing));
            }
        });

        // Memory follows the disk only after the commit.
        this._buffer.removeSessionIds(new Set(folded.map((record) => record.sessionId)));
        closings.forEach((closing, index) => this._buffer.appendPersisted(closing, newIds[index]));

        return { closed: closings.length, deleted: folded.length, cutoffYear };
    }

    /**
     * Clear all journal entries
     * @returns {Promise<number>} Number of entries deleted
     */
    async clearAllEntries() {
        return this.#queued(() => this.#clearNow());
    }

    async #clearNow() {
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
     * Get financial summary grouped by year
     * @returns {Promise<Array>} Array of yearly summaries sorted by year descending
     */
    async getYearlyFinancialSummary() {
        const monthlyData = await this.getMonthlyFinancialSummary();
        return buildYearlyFinancialSummary(monthlyData);
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

