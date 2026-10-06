/**
 * Tests pour JournalManager
 * 
 * Ces tests vérifient les opérations de journal (journal entries)
 */

import Dexie from 'dexie';
import { JournalManager } from '../src/composition/accountingSessionJournal.js';
import { resetSessionLedgerBufferForTests } from '../src/composition/accountingSessionJournal.js';
import appRegistry from '../src/composition/AppRegistry.js';
import { TimeManager } from '../src/shared/time/TimeManager.js';

// ============================================================================
// Setup : Créer une base de données de test isolée
// ============================================================================
function createTestDb() {
    const db = new Dexie('testJournalDb');
    db.version(1).stores({
        houses: 'name, [name+price]',
        game: 'name',
        budget: 'name',
        objectives: 'name',
        journal: '++id, turn, date, type, amount, description',
        foodTraceability: '++id, turn, month, year, date, transactionType, fromId, fromCoords, toId, toCoords, foodType, quantity, price'
    });
    return db;
}

// ============================================================================
// Tests pour JournalManager
// ============================================================================
describe('JournalManager', () => {
    let journalManager;
    let testDb;

    beforeEach(async () => {
        resetSessionLedgerBufferForTests();
        appRegistry.register('timeManager', {
            getTimeInfo: (turn) => ({
                year: Math.floor(turn / 12),
                monthIndex: turn % 12,
                month: 'TestMonth',
            }),
        });
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();
        
        // Attendre que la base soit complètement prête
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Créer un JournalManager avec la base de test
        journalManager = new JournalManager();
        journalManager.db = testDb; // Injecter la base de test
    });

    afterEach(async () => {
        appRegistry.register('timeManager', TimeManager);
        // Nettoyer après chaque test
        if (testDb) {
            await testDb.delete();
        }
    });

    describe('addJournalEntry', () => {
        test('should add a journal entry with correct fields', async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 1000, 'Taxes from citizens');
            await journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                turn: 1,
                type: 'citizen_tax',
                amount: 1000,
                description: 'Taxes from citizens'
            });
        });

        test('should add import entries with correct type', async () => {
            await journalManager.addJournalEntry(1, 'import_wheat', 5, 'Import blé (1 panier × 5€)');
            await journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                turn: 1,
                type: 'import_wheat',
                amount: 5,
                description: 'Import blé (1 panier × 5€)'
            });
        });

        test('should add import/export entries for all products', async () => {
            await journalManager.addJournalEntry(1, 'import_wheat', 5, 'Import blé');
            await journalManager.addJournalEntry(2, 'import_carrot', 15, 'Import carotte');
            await journalManager.addJournalEntry(3, 'import_cabbage', 17, 'Import chou');
            await journalManager.addJournalEntry(4, 'import_wood', 20, 'Import bois');
            await journalManager.addJournalEntry(5, 'export_wheat', 15, 'Export blé');
            await journalManager.addJournalEntry(6, 'export_carrot', 18, 'Export carotte');
            await journalManager.addJournalEntry(7, 'export_cabbage', 20, 'Export chou');
            await journalManager.addJournalEntry(8, 'export_wood', 25, 'Export bois');
            await journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(8);
            
            const importTypes = entries.filter(e => e.type.startsWith('import_')).map(e => e.type);
            const exportTypes = entries.filter(e => e.type.startsWith('export_')).map(e => e.type);
            
            expect(importTypes).toContain('import_wheat');
            expect(importTypes).toContain('import_carrot');
            expect(importTypes).toContain('import_cabbage');
            expect(importTypes).toContain('import_wood');
            expect(exportTypes).toContain('export_wheat');
            expect(exportTypes).toContain('export_carrot');
            expect(exportTypes).toContain('export_cabbage');
            expect(exportTypes).toContain('export_wood');
        });

        test('should add multiple journal entries', async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 1000, 'Taxes');
            await journalManager.addJournalEntry(1, 'maintenance', 500, 'Maintenance mensuelle');
            await journalManager.addJournalEntry(2, 'import_wheat', 5, 'Import blé');
            await journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(3);
        });
    });

    describe('getJournalEntries', () => {
        beforeEach(async () => {
            // Add some test entries
            await journalManager.addJournalEntry(1, 'citizen_tax', 1000, 'Taxes Turn 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(2, 'maintenance', 500, 'Maintenance Turn 2');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(13, 'citizen_tax', 1500, 'Taxes Turn 13');
        });

        test('should get all journal entries sorted by turn descending', async () => {
            const entries = await journalManager.getJournalEntries();
            
            expect(entries.length).toBeGreaterThanOrEqual(3);
            // Vérifier que les entrées sont triées par turn décroissant
            for (let i = 0; i < entries.length - 1; i++) {
                expect(entries[i].turn).toBeGreaterThanOrEqual(entries[i + 1].turn);
            }
        });

    });

    describe('getJournalEntriesForTurn', () => {
        beforeEach(async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 1000, 'Entry 1');
            await journalManager.addJournalEntry(1, 'construction', 500, 'Entry 2');
            await journalManager.addJournalEntry(2, 'citizen_tax', 1500, 'Entry 3');
        });

        test('should get entries for a specific turn', async () => {
            const entries = await journalManager.getJournalEntriesForTurn(1);
            
            expect(entries).toHaveLength(2);
            expect(entries[0].turn).toBe(1);
            expect(entries[1].turn).toBe(1);
        });

        test('should return empty array for turn with no entries', async () => {
            const entries = await journalManager.getJournalEntriesForTurn(99);
            expect(entries).toHaveLength(0);
        });
    });

    describe('clearAllEntries', () => {
        test('should clear all journal entries', async () => {
            await journalManager.addJournalEntry(1, 'income', 1000, 'Test');
            await journalManager.addJournalEntry(2, 'construction', 500, 'Test');
            
            const count = await journalManager.clearAllEntries();
            expect(count).toBe(2);
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(0);
        });

        test('should return 0 when clearing empty journal', async () => {
            const count = await journalManager.clearAllEntries();
            expect(count).toBe(0);
        });
    });

    describe('getStatistics', () => {
        test('should return empty stats for no entries', async () => {
            const stats = await journalManager.getStatistics();
            
            expect(stats.totalEntries).toBe(0);
            expect(stats.totalIncome).toBe(0);
            expect(stats.totalExpenses).toBe(0);
            expect(stats.earliestEntry).toBeNull();
            expect(stats.latestEntry).toBeNull();
        });

        test('should calculate statistics correctly', async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 1000, 'Taxes 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(13, 'citizen_tax', 500, 'Taxes 2');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(3, 'construction', 300, 'Construction 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(4, 'maintenance', 200, 'Maintenance');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(5, 'import_wheat', 5, 'Import blé');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(6, 'export_wheat', 15, 'Export blé');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(7, 'import_carrot', 15, 'Import carotte');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(8, 'export_carrot', 18, 'Export carotte');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(9, 'import_cabbage', 17, 'Import chou');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(10, 'export_cabbage', 20, 'Export chou');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(11, 'import_wood', 20, 'Import bois');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(12, 'export_wood', 25, 'Export bois');
            
            const stats = await journalManager.getStatistics();
            
            expect(stats.totalEntries).toBe(12);
            expect(stats.totalIncome).toBe(1578); // citizen_tax (1500) + exports (15+18+20+25=78)
            expect(stats.totalExpenses).toBe(557); // construction (300) + maintenance (200) + imports (5+15+17+20=57)
            expect(stats.byType.citizen_tax).toBe(2);
            expect(stats.byType.construction).toBe(1);
            expect(stats.byType.maintenance).toBe(1);
            expect(stats.byType.import_wheat).toBe(1);
            expect(stats.byType.export_wheat).toBe(1);
            expect(stats.byType.import_carrot).toBe(1);
            expect(stats.byType.export_carrot).toBe(1);
            expect(stats.byType.import_cabbage).toBe(1);
            expect(stats.byType.export_cabbage).toBe(1);
            expect(stats.byType.import_wood).toBe(1);
            expect(stats.byType.export_wood).toBe(1);
            expect(stats.earliestEntry).toBeDefined();
            expect(stats.latestEntry).toBeDefined();
        });
    });

    describe('flushSessionToDexie', () => {
        test('a money line is on disk as soon as it is recorded', async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 100, 'Tax');

            const idbEntries = await testDb.journal.toArray();
            expect(idbEntries.map((entry) => entry.type)).toEqual(['citizen_tax']);

            const result = await journalManager.flushSessionToDexie();
            expect(result.flushed).toBe(0);
        });

        test('a line that cannot be written throws and is not kept in memory', async () => {
            journalManager.db.journal.add = async () => {
                throw new Error('IndexedDB unavailable');
            };

            await expect(journalManager.addJournalEntry(1, 'maintenance', 20, 'Maint')).rejects.toThrow('IndexedDB unavailable');

            const entries = await journalManager.getJournalEntries();
            expect(entries).toHaveLength(0);
        });
    });


    describe('businessKey idempotence', () => {
        beforeEach(() => {
            appRegistry.register('timeManager', {
                getTimeInfo: (turn) => ({
                    year: Math.floor(turn / 12),
                    monthIndex: turn % 12,
                    month: 'TestMonth',
                }),
            });
        });

        afterEach(() => {
            appRegistry.register('timeManager', TimeManager);
        });

        test('skips duplicate salary for same civil month', async () => {
            appRegistry.register('timeManager', {
                getTimeInfo: () => ({
                    year: 0,
                    monthIndex: 5,
                    month: 'Juin',
                }),
            });

            await journalManager.addJournalEntry(10, 'salary', 1000, 'Salary A');
            await journalManager.addJournalEntry(11, 'salary', 2000, 'Salary B duplicate');

            const entries = await journalManager.getJournalEntries();
            expect(entries.filter((e) => e.type === 'salary')).toHaveLength(1);
            expect(entries[0].amount).toBe(1000);
        });
    });

    describe('cleanupOldJournalYears', () => {
        const row = (turn, description, year) => ({
            turn,
            date: new Date().toISOString(),
            type: 'citizen_tax',
            amount: 100,
            description,
            year,
            hamletId: 'h1',
        });

        test('closes only whole stamped years older than latest - keepYears, never inside a year', async () => {
            await testDb.journal.bulkAdd([
                row(10, 'year 1 (last month)', 1),
                row(20, 'year 4 (last month)', 4),
                row(30, 'year 5 (first month)', 5),
                row(40, 'year 10', 10),
            ]);

            const result = await journalManager.cleanupOldJournalYears(5);

            expect(result).toEqual({ closed: 2, deleted: 2, cutoffYear: 5 });
            const kept = await testDb.journal.toArray();
            expect(kept.filter((e) => e.type !== 'year_closing').map((e) => e.description).sort()).toEqual(['year 10', 'year 5 (first month)']);
            expect(kept.filter((e) => e.type === 'year_closing').map((e) => e.closing.year).sort()).toEqual([1, 4]);
        });

        test('does not depend on the calendar: a changed days-per-month cannot move the cutoff', async () => {
            await testDb.journal.bulkAdd([row(10, 'year 2', 2), row(20, 'year 9', 9)]);
            // a calendar that would put every turn in year 100 must change nothing
            appRegistry.register('timeManager', { getTimeInfo: () => ({ year: 100, monthIndex: 0, month: 'X' }) });

            const result = await journalManager.cleanupOldJournalYears(5);

            expect(result).toEqual({ closed: 1, deleted: 1, cutoffYear: 4 });
            const kept = await testDb.journal.toArray();
            expect(kept.filter((e) => e.type !== 'year_closing').map((e) => e.description)).toEqual(['year 9']);
            expect(kept.filter((e) => e.type === 'year_closing').map((e) => e.closing.year)).toEqual([2]);
        });

        test('an entry without fiscal year stamp is an error, not silently kept or dropped', async () => {
            await testDb.journal.bulkAdd([row(1, 'ok', 3), { ...row(2, 'unstamped'), year: undefined }]);
            await expect(journalManager.cleanupOldJournalYears(5)).rejects.toThrow('no fiscal year stamp');
        });
    });
});

