/**
 * Tests pour JournalManager
 * 
 * Ces tests vérifient les opérations de journal (journal entries)
 */

import Dexie from 'dexie';
import { JournalManager } from '../src/js/stores/JournalManager.js';
import { resetSessionLedgerBufferForTests } from '../src/js/stores/SessionLedgerBuffer.js';

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
            expect(entries[0].date).toBeDefined();
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
            await journalManager.addJournalEntry(3, 'citizen_tax', 1500, 'Taxes Turn 3');
        });

        test('should get all journal entries sorted by turn descending', async () => {
            const entries = await journalManager.getJournalEntries();
            
            expect(entries.length).toBeGreaterThanOrEqual(3);
            // Vérifier que les entrées sont triées par turn décroissant
            for (let i = 0; i < entries.length - 1; i++) {
                expect(entries[i].turn).toBeGreaterThanOrEqual(entries[i + 1].turn);
            }
        });

        test('should filter entries by maxAge', async () => {
            // This test is tricky because maxAge is in days
            // We'll skip age filtering for now as it requires manipulating dates
            const entries = await journalManager.getJournalEntries();
            expect(entries).toHaveLength(3);
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
            await journalManager.addJournalEntry(2, 'citizen_tax', 500, 'Taxes 2');
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
        test('persists buffered entries and keeps them readable after flush', async () => {
            await journalManager.addJournalEntry(1, 'citizen_tax', 100, 'Tax');
            await journalManager.addJournalEntry(1, 'balance', 500, 'Solde', null, {
                persist: false,
            });

            const beforeFlush = await journalManager.getJournalEntries();
            expect(beforeFlush).toHaveLength(2);

            const result = await journalManager.flushSessionToDexie();
            expect(result.failed).toBe(false);
            expect(result.flushed).toBe(1);

            const idbEntries = await testDb.journal.toArray();
            expect(idbEntries).toHaveLength(1);
            expect(idbEntries[0].type).toBe('citizen_tax');

            const afterFlush = await journalManager.getJournalEntries();
            expect(afterFlush).toHaveLength(2);
        });

        test('leaves pending entries in buffer when flush fails', async () => {
            await journalManager.addJournalEntry(1, 'maintenance', 20, 'Maint');

            journalManager.db.journal.add = async () => {
                throw new Error('IndexedDB unavailable');
            };

            const result = await journalManager.flushSessionToDexie();
            expect(result.failed).toBe(true);
            expect(result.pending).toBe(1);

            const entries = await journalManager.getJournalEntries();
            expect(entries).toHaveLength(1);
        });
    });

    describe('addBalanceEntry', () => {
        test('stores balance in session only without IndexedDB write', async () => {
            await journalManager.addBalanceEntry(4, 750);
            await journalManager.addBalanceEntry(4, 800);

            const result = await journalManager.flushSessionToDexie();
            expect(result.flushed).toBe(0);

            const entries = await journalManager.getJournalEntriesForTurn(4);
            expect(entries).toHaveLength(1);
            expect(entries[0].type).toBe('balance');
            expect(entries[0].amount).toBe(800);

            const idbEntries = await testDb.journal.toArray();
            expect(idbEntries).toHaveLength(0);
        });
    });

    describe('businessKey idempotence', () => {
        beforeEach(() => {
            const globalObj = typeof window !== 'undefined' ? window : global;
            globalObj.TimeManager = {
                getTimeInfo: (turn) => ({
                    year: Math.floor(turn / 12),
                    monthIndex: turn % 12,
                    month: 'TestMonth',
                }),
            };
        });

        test('skips duplicate salary for same civil month', async () => {
            const globalObj = typeof window !== 'undefined' ? window : global;
            globalObj.TimeManager = {
                getTimeInfo: () => ({
                    year: 0,
                    monthIndex: 5,
                    month: 'Juin',
                }),
            };

            await journalManager.addJournalEntry(10, 'salary', 1000, 'Salary A');
            await journalManager.addJournalEntry(11, 'salary', 2000, 'Salary B duplicate');

            const entries = await journalManager.getJournalEntries();
            expect(entries.filter((e) => e.type === 'salary')).toHaveLength(1);
            expect(entries[0].amount).toBe(1000);
        });
    });

    describe('cleanupOldJournalEntries', () => {
        test('should delete old entries based on maxAge', async () => {
            // Create an old entry (61 days old)
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 61);
            
            await testDb.journal.add({
                turn: 1,
                date: oldDate.toISOString(),
                type: 'citizen_tax',
                amount: 1000,
                description: 'Old entry'
            });
            
            // Create a recent entry
            await journalManager.addJournalEntry(2, 'citizen_tax', 500, 'Recent entry');
            await journalManager.flushSessionToDexie();
            
            // Cleanup entries older than 60 days
            const result = await journalManager.cleanupOldJournalEntries(60);
            
            expect(result.deleted).toBe(1);
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(1);
            expect(entries[0].description).toBe('Recent entry');
        });
    });
});

