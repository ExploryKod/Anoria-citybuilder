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
import { accountKeyOf } from '../../domain/policies/AccountKeyPolicy.js';
import { entryLegsOf, isEcriture } from '../../domain/policies/EntryLegsPolicy.js';
import { isInformativeJournalType } from '../../domain/policies/JournalEntryClassificationPolicy.js';
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

    /** How many batches are open (see `batch`), and the lines they hold, which are in memory and not yet on disk. */
    #batchDepth = 0;
    #batchSessionIds = new Set();

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

    /**
     * Writes everything `work` records in one go: each line is held in memory as it is recorded (the journal and its fold are up to date at once, so `work` reads
     * what it has just written), and the whole is written to IndexedDB in one transaction when `work` is done. A month's settlement is hundreds of lines; written
     * one by one, each waits for its own transaction and its own pass over the buffer. The month is atomic: if `work` or the write fails, none of its lines is
     * kept (a business key lets the month be settled again).
     * @template T
     * @param {() => Promise<T>} work
     * @returns {Promise<T>}
     */
    async batch(work) {
        const outermost = this.#batchDepth === 0;
        if (outermost) this.#batchSessionIds = new Set();
        this.#batchDepth += 1;
        let result;
        try {
            result = await work();
        } catch (error) {
            this.#batchDepth -= 1;
            if (outermost) await this.#dropBatch();
            throw error;
        }
        this.#batchDepth -= 1;
        if (!outermost) return result;
        const held = this.#batchSessionIds.size;
        try {
            await this.#queued(() => this._getSessionPersistence().flushPendingEntries());
        } catch (error) {
            await this.#dropBatch();
            throw new Error(`[journal] the batch of ${held} lines could not be written: ${error.message}`, { cause: error });
        }
        this.#batchSessionIds = new Set();
        return result;
    }

    /** The lines of a batch that failed leave the journal: none of them was written. */
    async #dropBatch() {
        const dropped = this.#batchSessionIds;
        this.#batchSessionIds = new Set();
        await this.#queued(async () => this._buffer.removeSessionIds(dropped));
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

            if (options.accountBuildingId) {
                entry.accountBuildingId = options.accountBuildingId;
            }

            if (options.accountKind) {
                entry.accountKind = options.accountKind;
            }

            if (options.counterpartyBuildingId) {
                entry.counterpartyBuildingId = options.counterpartyBuildingId;
            }

            if (options.loanId) {
                entry.loanId = options.loanId;
            }

            if (options.loan) {
                entry.loan = options.loan;
            }

            if (options.shares != null) {
                entry.shares = options.shares;
            }

            if (options.dutyRate != null) {
                entry.dutyRate = options.dutyRate;
                entry.customsBase = options.customsBase;
            }

            if (options.resource) {
                entry.resource = options.resource;
            }

            // Every écriture is booked as it is written: its legs (the two the catalog gives its type in the chart of accounts of its account,
            // or the ones the writer brings) and its journal code, which must balance. An informative line is no écriture and has none.
            if (isEcriture(type)) {
                const booked = entryLegsOf({ type, amount, accountBuildingId: options.accountBuildingId ?? null, legs: options.legs ?? null });
                entry.legs = booked.legs;
                entry.journal = booked.journal;
            }

            if (options.transactionId) {
                entry.transactionId = options.transactionId;
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

            // In a batch the line waits in memory with the others and the batch writes them all at once (see `batch`).
            if (this.#batchDepth > 0) {
                this.#batchSessionIds.add(appendResult.record.sessionId);
                return { recorded: true, skipped: false, businessKey };
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
     * @returns {Promise<Array>} Journal entries
     */
    async getJournalEntries() {
        return this.#queued(async () => {
            await this.ensureHydrated();
            return filterAndSortJournalEntries(this._buffer.getAllPublic());
        });
    }

    /**
     * The journal folded into the totals of each compte, up to date with every line written (see LegsFold): the one derivation of every balance.
     * @returns {Promise<import('../../domain/policies/LegsFold.js').LegsFold>}
     */
    async getLegsFold() {
        return this.#queued(async () => {
            await this.ensureHydrated();
            return this._buffer.legsFold();
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
     * Each full year before the cutoff is closed per hamlet and per account: its folded lines are replaced by one `year_closing` line
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
            const key = `${record.hamletId}:${SessionLedgerBuffer.fiscalYearOf(record)}:${accountKeyOf(record) ?? 'city'}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(record);
        }

        const closings = [...groups.values()].map((lines) => {
            const first = lines[0];
            return buildYearClosingLine({
              year: SessionLedgerBuffer.fiscalYearOf(first),
              hamletId: first.hamletId,
              accountBuildingId: first.accountBuildingId ?? null,
              accountKind: first.accountKind ?? null,
              lines: lines.map(toPublicEntry),
              getTimeInfo: (turn) => this._getTimeInfo(turn),
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
            // Revenus: citizen_tax, payroll_tax, vat, capital_funds, loan_capital, export_*
            // Dépenses: tout le reste (construction, maintenance, salary, import_*, etc.), sauf les lignes informatives, qui ne déplacent aucun argent
            if (isInformativeJournalType(entry.type)) {
                return;
            }
            if (entry.type === 'citizen_tax' || entry.type === 'payroll_tax' || entry.type === 'vat' || entry.type === 'producer_revenue' || entry.type === 'corporate_tax_revenue' || entry.type === 'corporate_tax_debt_received' || entry.type === 'contribution_debt_received' || entry.type === 'service_sales' || entry.type === 'service_subsidy_received' || entry.type === 'subsidy_companies_received' || entry.type === 'subsidy_housing_received' || entry.type === 'social_contribution' || entry.type === 'household_participation' || entry.type === 'household_dividend' || entry.type === 'income_tax_refund' || entry.type === 'capital_funds' || entry.type === 'loan_capital' || entry.type.startsWith('export_') || entry.type.startsWith('customs_import_') || entry.type.startsWith('abroad_sale_')) {
                stats.totalIncome += entry.amount;
            } else {
                stats.totalExpenses += entry.amount;
            }
        });

        // Find earliest and latest entries: by turn, then insertion order (the sort is stable).
        const sortedByTurn = [...entries].sort((a, b) => a.turn - b.turn);
        stats.earliestEntry = sortedByTurn[0];
        stats.latestEntry = sortedByTurn[sortedByTurn.length - 1];

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

