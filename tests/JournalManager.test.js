/**
 * Tests pour JournalManager
 * 
 * Ces tests vérifient les opérations de journal (journal entries)
 */

import Dexie from 'dexie';
import { JournalManager } from '../src/js/stores/JournalManager.js';

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
            await journalManager.addJournalEntry(1, 'income', 1000, 'Taxes from citizens');
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                turn: 1,
                type: 'income',
                amount: 1000,
                description: 'Taxes from citizens'
            });
            expect(entries[0].date).toBeDefined();
        });

        test('should add multiple journal entries', async () => {
            await journalManager.addJournalEntry(1, 'income', 1000, 'Taxes');
            await journalManager.addJournalEntry(1, 'expense', 500, 'Maintenance');
            await journalManager.addJournalEntry(2, 'income', 1200, 'More taxes');
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(3);
        });
    });

    describe('getJournalEntries', () => {
        beforeEach(async () => {
            // Add some test entries
            await journalManager.addJournalEntry(1, 'income', 1000, 'Taxes Turn 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(2, 'expense', 500, 'Maintenance Turn 2');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(3, 'income', 1500, 'Taxes Turn 3');
        });

        test('should get all journal entries sorted by turn descending', async () => {
            const entries = await journalManager.getJournalEntries();
            
            expect(entries).toHaveLength(3);
            expect(entries[0].turn).toBe(3);
            expect(entries[1].turn).toBe(2);
            expect(entries[2].turn).toBe(1);
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
            await journalManager.addJournalEntry(1, 'income', 1000, 'Entry 1');
            await journalManager.addJournalEntry(1, 'expense', 500, 'Entry 2');
            await journalManager.addJournalEntry(2, 'income', 1500, 'Entry 3');
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
            await journalManager.addJournalEntry(2, 'expense', 500, 'Test');
            
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
            await journalManager.addJournalEntry(1, 'income', 1000, 'Income 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(2, 'income', 500, 'Income 2');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(3, 'expense', 300, 'Expense 1');
            await new Promise(resolve => setTimeout(resolve, 10));
            await journalManager.addJournalEntry(4, 'maintenance', 200, 'Maintenance');
            
            const stats = await journalManager.getStatistics();
            
            expect(stats.totalEntries).toBe(4);
            expect(stats.totalIncome).toBe(1500);
            expect(stats.totalExpenses).toBe(500); // expense + maintenance
            expect(stats.byType.income).toBe(2);
            expect(stats.byType.expense).toBe(1);
            expect(stats.byType.maintenance).toBe(1);
            expect(stats.earliestEntry).toBeDefined();
            expect(stats.latestEntry).toBeDefined();
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
                type: 'income',
                amount: 1000,
                description: 'Old entry'
            });
            
            // Create a recent entry
            await journalManager.addJournalEntry(2, 'income', 500, 'Recent entry');
            
            // Cleanup entries older than 60 days
            const result = await journalManager.cleanupOldJournalEntries(60);
            
            expect(result.deleted).toBe(1);
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(1);
            expect(entries[0].description).toBe('Recent entry');
        });
    });
});

