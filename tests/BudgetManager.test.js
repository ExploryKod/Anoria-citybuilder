/**
 * Tests pour BudgetManager avec mocking
 * 
 * Ces tests utilisent fake-indexeddb pour simuler IndexedDB
 * et permettent de tester la logique métier sans dépendre d'un vrai navigateur.
 * 
 * Note: fake-indexeddb est initialisé dans tests/setup.js AVANT que db.js ne soit chargé.
 */

import Dexie from 'dexie';
import { BudgetManager } from '../src/js/stores/BudgetManager.js';
import { JournalManager } from '../src/js/stores/JournalManager.js';
import config from '../src/js/game/config.js';

// ============================================================================
// Setup : Créer une base de données de test isolée
// ============================================================================
function createTestDb() {
    const db = new Dexie('testDb');
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
// Tests pour BudgetManager
// ============================================================================
describe('BudgetManager', () => {
    let budgetManager;
    let testDb;

    beforeEach(async () => {
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();
        
        // Attendre que la base soit complètement prête
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Créer un BudgetManager avec la base de test
        budgetManager = new BudgetManager();
        budgetManager.db = testDb; // Injecter la base de test
        
        // Create and inject JournalManager with test database
        const journalManager = new JournalManager();
        journalManager.db = testDb;
        budgetManager.journalManager = journalManager;
        
        // Mock config pour éviter les problèmes avec import.meta.env
        budgetManager.config = config;
    });

    afterEach(async () => {
        // Nettoyer après chaque test
        if (testDb && testDb.isOpen()) {
            await testDb.delete();
        }
    });

    // ========================================================================
    // initialize - Initialisation du budget
    // ========================================================================
    describe('initialize', () => {
        
        test('crée un budget initial avec les fonds par défaut (200€)', async () => {
            await budgetManager.initialize();
            
            const budget = await budgetManager.getCurrentBudget();
            
            expect(budget.funds).toBe(200);
            expect(budget.initialFunds).toBe(200);
            expect(budget.turn).toBe(0);
        });

        test('crée un budget initial avec des fonds personnalisés', async () => {
            await budgetManager.initialize(500);
            
            // Lire directement depuis la base pour éviter la logique de synchronisation avec config
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(500);
            expect(budget.initialFunds).toBe(500);
        });

        test('réinitialise le budget (efface les données existantes)', async () => {
            // Créer un budget initial
            await budgetManager.initialize(300);
            await budgetManager.addIncome(100, 'Test');
            
            // Réinitialiser
            await budgetManager.initialize(200);
            
            const budget = await budgetManager.getCurrentBudget();
            
            expect(budget.funds).toBe(200);
            expect(budget.income).toBe(0); // Réinitialisé
        });
    });

    // ========================================================================
    // addIncome / addExpense - Opérations financières
    // ========================================================================
    describe('addIncome', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('ajoute des revenus au budget', async () => {
            // S'assurer qu'un budget existe
            await budgetManager.initialize(200);
            
            // Ajouter des revenus (addIncome ne met PAS à jour dailyIncome, seul addDailyIncome le fait)
            await budgetManager.addIncome(50, 'Vente de blé');
            
            // Vérifier directement dans la base (évite la logique de synchronisation de getCurrentBudget)
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(250); // 200 + 50
            expect(budget.income).toBe(50);
            // Note: addIncome() ne met pas à jour dailyIncome, seul addDailyIncome() le fait
        });

        test('cumule plusieurs revenus', async () => {
            await budgetManager.initialize(200);
            
            // Ajouter le premier revenu et vérifier
            await budgetManager.addIncome(30, 'Vente 1');
            let budgetData = await testDb.budget.toArray();
            let budget = budgetData[0];
            expect(budget.funds).toBe(230); // 200 + 30
            
            // Ajouter le deuxième revenu et vérifier
            await budgetManager.addIncome(20, 'Vente 2');
            budgetData = await testDb.budget.toArray();
            budget = budgetData[0];
            
            expect(budget.funds).toBe(250); // 200 + 30 + 20
            expect(budget.income).toBe(50); // 30 + 20
        });
    });

    describe('addExpense', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('soustrait des dépenses du budget (investissements)', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExpense(30, 'Building: House');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(170); // 200 - 30
            expect(budget.totalInvestments).toBe(30);
            // Note: addExpense() does NOT update dailyExpenses (only addDailyExpense() does)
            expect(budget.dailyExpenses).toBe(0);
        });

        test('peut avoir un budget négatif (dette)', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExpense(250, 'Grosse dépense');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(-50); // 200 - 250 (debt allowed)
            expect(budget.expenses).toBe(250);
        });
    });

    describe('addDailyExpense', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('soustrait des dépenses quotidiennes du budget', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addDailyExpense(30, 'Maintenance routes');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(170); // 200 - 30
            expect(budget.expenses).toBe(30);
            expect(budget.dailyExpenses).toBe(30); // addDailyExpense() updates dailyExpenses
        });

        test('cumule plusieurs dépenses quotidiennes', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addDailyExpense(20, 'Maintenance 1');
            await budgetManager.addDailyExpense(15, 'Maintenance 2');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(165); // 200 - 20 - 15
            expect(budget.expenses).toBe(35); // 20 + 15
            expect(budget.dailyExpenses).toBe(35); // 20 + 15
        });

        test('peut avoir un budget négatif avec dépenses quotidiennes', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addDailyExpense(250, 'Grosse dépense quotidienne');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(-50); // 200 - 250 (debt allowed)
            expect(budget.expenses).toBe(250);
            expect(budget.dailyExpenses).toBe(250);
        });
    });

    // ========================================================================
    // addTaxes - Collecte des impôts (seulement en Novembre)
    // ========================================================================
    describe('addTaxes', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
            
            // Créer des maisons avec population pour les tests
            await testDb.houses.bulkPut([
                {
                    name: 'House-Blue-0-0',
                    type: 'House-Blue',
                    pop: 3
                },
                {
                    name: 'House-Red-1-1',
                    type: 'House-Red',
                    pop: 4
                }
            ]);
        });

        test('ne collecte PAS les impôts si ce n\'est pas Novembre', async () => {
            // Simuler Janvier (monthIndex = 0)
            const time = 0; // Jour 0 = Janvier
            
            await budgetManager.addTaxes(time);
            
            const budget = await budgetManager.getCurrentBudget();
            
            expect(budget.totalTaxes).toBe(0);
            expect(budget.funds).toBe(200); // Pas de changement
        });

        test('collecte les impôts en Novembre (monthIndex = 10)', async () => {
            await budgetManager.initialize(200);
            
            // Simuler Novembre (monthIndex = 10)
            // Avec 1 jour/mois, Novembre = jour 10
            const time = 10;
            
            await budgetManager.addTaxes(time);
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            // 3 habitants + 4 habitants = 7 habitants × 100€ = 700€
            expect(budget.totalTaxes).toBe(700);
            expect(budget.funds).toBe(900); // 200 + 700
            expect(budget.income).toBe(700);
        });

        test('ne collecte les impôts qu\'une seule fois par année', async () => {
            // Première collecte en Novembre année 0
            await budgetManager.addTaxes(10); // Novembre année 0
            
            const budget1 = await budgetManager.getCurrentBudget();
            expect(budget1.totalTaxes).toBe(700);
            
            // Deuxième tentative en Novembre année 0 (même année)
            await budgetManager.addTaxes(11); // Toujours Novembre année 0
            
            const budget2 = await budgetManager.getCurrentBudget();
            expect(budget2.totalTaxes).toBe(700); // Pas de double collecte !
        });

        test('peut collecter les impôts l\'année suivante', async () => {
            // Année 0
            await budgetManager.addTaxes(10); // Novembre année 0
            const budget1 = await budgetManager.getCurrentBudget();
            expect(budget1.totalTaxes).toBe(700);
            
            // Année 1 (12 mois plus tard avec 1 jour/mois)
            await budgetManager.addTaxes(22); // Novembre année 1 (10 + 12)
            const budget2 = await budgetManager.getCurrentBudget();
            expect(budget2.totalTaxes).toBe(1400); // 700 + 700
        });

        test('ne collecte pas d\'impôts si aucune population', async () => {
            // Maisons sans population
            await testDb.houses.clear();
            await testDb.houses.bulkPut([
                {
                    name: 'House-Blue-0-0',
                    type: 'House-Blue',
                    pop: 0
                }
            ]);
            
            await budgetManager.addTaxes(10); // Novembre
            
            const budget = await budgetManager.getCurrentBudget();
            
            expect(budget.totalTaxes).toBe(0);
        });
    });

    // ========================================================================
    // addJournalEntry - Journal comptable
    // ========================================================================
    describe('addJournalEntry', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('ajoute une entrée au journal', async () => {
            await budgetManager.addJournalEntry(1, 'income', 50, 'Impôts');
            
            const entries = await testDb.journal.toArray();
            
            expect(entries).toHaveLength(1);
            expect(entries[0].turn).toBe(1);
            expect(entries[0].type).toBe('income');
            expect(entries[0].amount).toBe(50);
            expect(entries[0].description).toBe('Impôts');
        });

        test('peut ajouter plusieurs entrées', async () => {
            await budgetManager.addJournalEntry(1, 'income', 50, 'Impôts');
            await budgetManager.addJournalEntry(1, 'expense', 30, 'Maintenance');
            
            const entries = await testDb.journal.toArray();
            
            expect(entries).toHaveLength(2);
        });
    });

    // ========================================================================
    // getJournalEntries - Récupération du journal
    // ========================================================================
    describe('getJournalEntries', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
            
            // Créer des entrées de journal pour différents tours
            await testDb.journal.bulkAdd([
                { turn: 1, date: new Date('2024-01-01').toISOString(), type: 'income', amount: 50, description: 'Test 1' },
                { turn: 2, date: new Date('2024-01-02').toISOString(), type: 'expense', amount: 30, description: 'Test 2' },
                { turn: 3, date: new Date('2024-01-03').toISOString(), type: 'income', amount: 20, description: 'Test 3' }
            ]);
        });

        test('récupère toutes les entrées du journal', async () => {
            const entries = await budgetManager.getJournalEntries();
            
            expect(entries).toHaveLength(3);
        });

        test('filtre les entrées par âge maximum (en jours)', async () => {
            // Simuler des entrées anciennes (plus de 7 jours)
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);
            
            await testDb.journal.add({
                turn: 0,
                date: oldDate.toISOString(),
                type: 'income',
                amount: 10,
                description: 'Ancienne entrée'
            });
            
            // Récupérer seulement les 7 derniers jours
            const entries = await budgetManager.getJournalEntries(7);
            
            // L'entrée ancienne ne devrait pas être incluse
            const oldEntries = entries.filter(e => e.description === 'Ancienne entrée');
            expect(oldEntries).toHaveLength(0);
        });
    });
});

