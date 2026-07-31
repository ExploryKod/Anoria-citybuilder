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
import { resetSessionLedgerBufferForTests } from '../src/js/stores/SessionLedgerBuffer.js';
import {
    getOrCreateAccountingContext,
    resetAccountingContextForTests,
} from '../src/composition/createAccountingContext.js';
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
        resetSessionLedgerBufferForTests();
        resetAccountingContextForTests();
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();
        
        // Attendre que la base soit complètement prête
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Mock TimeManager pour les tests (utiliser global pour Jest)
        const globalObj = typeof window !== 'undefined' ? window : global;
        globalObj.TimeManager = {
            getTimeInfo: (turn) => {
                // Simulation simple : 1 jour = 1 tour, 12 tours = 1 an
                const year = Math.floor(turn / 12);
                const monthIndex = turn % 12;
                const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                return {
                    year: year,
                    monthIndex: monthIndex,
                    month: monthNames[monthIndex],
                    dayInMonth: 1,
                    season: 'Printemps'
                };
            }
        };
        
        // Créer un BudgetManager avec la base de test
        budgetManager = new BudgetManager();
        budgetManager.db = testDb; // Injecter la base de test
        
        // Create and inject JournalManager with test database
        const journalManager = new JournalManager();
        journalManager.db = testDb;
        budgetManager.journalManager = journalManager;

        getOrCreateAccountingContext({
            journalManager,
            db: testDb,
        });
        
        // Mock config pour éviter les problèmes avec import.meta.env
        budgetManager.config = config;
    });

    afterEach(async () => {
        resetAccountingContextForTests();
        // Nettoyer après chaque test
        if (testDb && testDb.isOpen()) {
            await testDb.delete();
        }
        // Nettoyer le mock TimeManager
        const globalObj = typeof window !== 'undefined' ? window : global;
        delete globalObj.TimeManager;
    });

    // ========================================================================
    // initialize - Initialisation du budget
    // ========================================================================
    describe('initialize', () => {
        
        beforeEach(() => {
            resetAccountingContextForTests();
            getOrCreateAccountingContext({
                journalManager: budgetManager.journalManager,
                budgetManager,
            });
        });

        test('crée un budget initial avec les fonds par défaut (200€)', async () => {
            await budgetManager.initialize();
            
            const budget = await budgetManager.getCurrentBudget();
            
            expect(budget.funds).toBe(200);
            expect(budget.initialFunds).toBe(200);
            expect(budget.income).toBe(200);
            expect(budget.turn).toBe(0);
        });

        test('crée un budget initial avec des fonds personnalisés', async () => {
            await budgetManager.initialize(500);
            
            // Lire directement depuis la base pour éviter la logique de synchronisation avec config
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(500);
            expect(budget.initialFunds).toBe(500);
            expect(budget.income).toBe(500);
        });

        test('ne downgrade pas la trésorerie au-delà du capital initial (config mismatch)', async () => {
            await budgetManager.initialize(5000);

            const budgetData = await testDb.budget.toArray();
            budgetData[0].initialFunds = 5000;
            budgetData[0].income = 0;
            budgetData[0].funds = 5000;
            await testDb.budget.put(budgetData[0]);

            budgetManager.config = { budget: { initialFunds: 200 } };

            const budget = await budgetManager.getCurrentBudget();

            expect(budget.funds).toBe(5000);
            expect(budget.initialFunds).toBe(200);
        });

        test('réinitialise le budget (efface les données existantes)', async () => {
            resetAccountingContextForTests();
            getOrCreateAccountingContext({
                journalManager: budgetManager.journalManager,
                budgetManager,
            });

            await budgetManager.initialize(300);
            await budgetManager.addTaxes(100, 'Test taxes');

            await budgetManager.initialize(200);

            const budget = await budgetManager.getCurrentBudget();

            expect(budget.funds).toBe(200);
            expect(budget.income).toBe(200);
        });
    });

    // ========================================================================
    // addConstructionRefund / addConstructionExpense - Opérations financières
    // ========================================================================
    describe('addConstructionRefund', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
            resetAccountingContextForTests();
            getOrCreateAccountingContext({
                journalManager: budgetManager.journalManager,
                budgetManager,
            });
        });

        test('rembourse une dépense de construction (investissements)', async () => {
            await budgetManager.addConstructionExpense(30, 'Building: House');
            await budgetManager.addConstructionRefund(30, 'Refund for failed House');

            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];

            expect(budget.funds).toBe(200);
            expect(budget.totalInvestments).toBe(0);
            expect(budget.income).toBe(200);
        });

        test('cumule plusieurs remboursements', async () => {
            await budgetManager.addConstructionExpense(30, 'Building: House');
            await budgetManager.addConstructionRefund(10, 'Refund for failed House');
            await budgetManager.addConstructionRefund(20, 'Refund for duplicate House');

            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];

            expect(budget.funds).toBe(200);
            expect(budget.totalInvestments).toBe(0);
        });
    });

    describe('addConstructionExpense', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
            resetAccountingContextForTests();
            getOrCreateAccountingContext({
                journalManager: budgetManager.journalManager,
                budgetManager,
            });
        });

        test('soustrait des dépenses du budget (investissements)', async () => {
            await budgetManager.addConstructionExpense(30, 'Building: House');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(170); // 200 - 30
            expect(budget.totalInvestments).toBe(30);
            expect(budget.dailyExpenses).toBe(0);
        });

        test('peut avoir un budget négatif (dette)', async () => {
            await budgetManager.addConstructionExpense(250, 'Grosse dépense');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(-50); // 200 - 250 (debt allowed)
            expect(budget.expenses).toBe(250);
        });
    });

    describe('addImportExpense', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('soustrait le coût d\'import du budget', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(5, 'Import blé (1 panier × 5€)', 'wheat');
            
            // Lire directement depuis la base
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(195); // 200 - 5
            expect(budget.expenses).toBe(5);
            expect(budget.dailyExpenses).toBe(5);
            expect(budget.totalImports).toBeDefined();
            expect(budget.totalImports.wheat).toBe(5);
        });

        test('crée une entrée journal avec le type import_wheat', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(5, 'Import blé (1 panier × 5€)', 'wheat');
            await budgetManager.journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries).toHaveLength(2); // 1 capital_funds + 1 import_wheat
            
            const importEntry = entries.find(e => e.type === 'import_wheat');
            expect(importEntry).toBeDefined();
            expect(importEntry.amount).toBe(5);
            expect(importEntry.description).toBe('Import blé (1 panier × 5€)');
        });

        test('cumule plusieurs imports du même produit', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(5, 'Import blé 1', 'wheat');
            await budgetManager.addImportExpense(5, 'Import blé 2', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(190); // 200 - 5 - 5
            expect(budget.expenses).toBe(10);
            expect(budget.totalImports.wheat).toBe(10);
        });

        test('peut importer différents produits', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(5, 'Import blé', 'wheat');
            await budgetManager.addImportExpense(15, 'Import carotte', 'carrot');
            await budgetManager.addImportExpense(17, 'Import chou', 'cabbage');
            await budgetManager.addImportExpense(20, 'Import bois', 'wood');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(143); // 200 - 5 - 15 - 17 - 20
            expect(budget.expenses).toBe(57);
            expect(budget.totalImports.wheat).toBe(5);
            expect(budget.totalImports.carrot).toBe(15);
            expect(budget.totalImports.cabbage).toBe(17);
            expect(budget.totalImports.wood).toBe(20);
        });

        test('arrondit les montants', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(5.7, 'Import avec décimales', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(194); // 200 - 6 (arrondi)
            expect(budget.expenses).toBe(6);
        });

        test('peut avoir un budget négatif après import (dette)', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addImportExpense(250, 'Gros import', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(-50); // 200 - 250 (debt allowed)
            expect(budget.expenses).toBe(250);
        });
    });

    describe('addExportIncome', () => {
        
        beforeEach(async () => {
            await budgetManager.initialize(200);
        });

        test('ajoute le revenu d\'export au budget', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15, 'Export blé (1 panier × 15€)', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(215); // 200 + 15
            expect(budget.income).toBe(215); // 200 capital + 15 export
            expect(budget.dailyIncome).toBe(15);
            expect(budget.totalExports).toBeDefined();
            expect(budget.totalExports.wheat).toBe(15);
        });

        test('crée une entrée journal avec le type export_wheat', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15, 'Export blé (1 panier × 15€)', 'wheat');
            await budgetManager.journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            expect(entries.length).toBeGreaterThanOrEqual(2); // 1 capital_funds + 1 export_wheat
            
            const exportEntry = entries.find(e => e.type === 'export_wheat');
            expect(exportEntry).toBeDefined();
            expect(exportEntry.amount).toBe(15);
            expect(exportEntry.description).toBe('Export blé (1 panier × 15€)');
        });

        test('peut exporter différents produits', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15, 'Export blé', 'wheat');
            await budgetManager.addExportIncome(18, 'Export carotte', 'carrot');
            await budgetManager.addExportIncome(20, 'Export chou', 'cabbage');
            await budgetManager.addExportIncome(25, 'Export bois', 'wood');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(278); // 200 + 15 + 18 + 20 + 25
            expect(budget.income).toBe(278);
            expect(budget.totalExports.wheat).toBe(15);
            expect(budget.totalExports.carrot).toBe(18);
            expect(budget.totalExports.cabbage).toBe(20);
            expect(budget.totalExports.wood).toBe(25);
        });

        test('cumule plusieurs exports du même produit', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15, 'Export blé 1', 'wheat');
            await budgetManager.addExportIncome(15, 'Export blé 2', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(230); // 200 + 15 + 15
            expect(budget.income).toBe(230);
            expect(budget.totalExports.wheat).toBe(30);
        });

        test('peut exporter différents produits', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15, 'Export blé', 'wheat');
            await budgetManager.addExportIncome(18, 'Export carotte', 'carrot');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(233); // 200 + 15 + 18
            expect(budget.income).toBe(233);
            expect(budget.totalExports.wheat).toBe(15);
            expect(budget.totalExports.carrot).toBe(18);
        });

        test('arrondit les montants', async () => {
            await budgetManager.initialize(200);
            await budgetManager.addExportIncome(15.7, 'Export avec décimales', 'wheat');
            
            const budgetData = await testDb.budget.toArray();
            const budget = budgetData[0];
            
            expect(budget.funds).toBe(216); // 200 + 16 (arrondi)
            expect(budget.income).toBe(216);
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
            expect(budget.income).toBe(900); // 200 capital + 700 taxes
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
            // Note: initialize() crée automatiquement une entrée capital_funds au tour 0
            await budgetManager.initialize(200);
            await budgetManager.addJournalEntry(1, 'citizen_tax', 50, 'Impôt Citoyen');
            await budgetManager.journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            
            // Vérifier qu'il y a au moins 2 entrées (capital_funds + citizen_tax)
            expect(entries.length).toBeGreaterThanOrEqual(2);
            // Trouver l'entrée citizen_tax (pas capital_funds)
            const incomeEntry = entries.find(e => e.type === 'citizen_tax');
            expect(incomeEntry).toBeDefined();
            expect(incomeEntry.turn).toBe(1);
            expect(incomeEntry.type).toBe('citizen_tax');
            expect(incomeEntry.amount).toBe(50);
            expect(incomeEntry.description).toBe('Impôt Citoyen');
        });

        test('peut ajouter plusieurs entrées', async () => {
            // Note: initialize() crée automatiquement une entrée capital_funds au tour 0
            await budgetManager.initialize(200);
            await budgetManager.addJournalEntry(1, 'citizen_tax', 50, 'Impôt Citoyen');
            await budgetManager.addJournalEntry(1, 'maintenance', 30, 'Maintenance mensuelle');
            await budgetManager.journalManager.flushSessionToDexie();
            
            const entries = await testDb.journal.toArray();
            
            // Vérifier qu'il y a au moins 3 entrées (capital_funds + 2 entrées ajoutées)
            expect(entries.length).toBeGreaterThanOrEqual(3);
            // Vérifier que les deux entrées ajoutées sont présentes
            const citizenTaxEntry = entries.find(e => e.type === 'citizen_tax' && e.turn === 1);
            const maintenanceEntry = entries.find(e => e.type === 'maintenance' && e.turn === 1);
            expect(citizenTaxEntry).toBeDefined();
            expect(maintenanceEntry).toBeDefined();
        });
    });

    // ========================================================================
    // getJournalEntries - Récupération du journal
    // ========================================================================
    describe('getJournalEntries', () => {
        
        beforeEach(async () => {
            await testDb.journal.bulkAdd([
                { turn: 1, date: new Date('2024-01-01').toISOString(), type: 'citizen_tax', amount: 50, description: 'Test 1' },
                { turn: 2, date: new Date('2024-01-02').toISOString(), type: 'construction', amount: 30, description: 'Test 2' },
                { turn: 3, date: new Date('2024-01-03').toISOString(), type: 'citizen_tax', amount: 20, description: 'Test 3' }
            ]);

            await budgetManager.initialize(200);
        });

        test('récupère toutes les entrées du journal', async () => {
            const entries = await budgetManager.getJournalEntries();
            
            // initialize() crée capital_funds, mais bulkAdd() ne passe pas par initialize()
            // Donc on vérifie qu'il y a au moins 3 entrées (les 3 ajoutées via bulkAdd)
            // Si initialize() a créé capital_funds, il y en aura 4
            expect(entries.length).toBeGreaterThanOrEqual(3);
            // Vérifier que les 3 entrées ajoutées sont présentes
            const entry1 = entries.find(e => e.description === 'Test 1');
            const entry2 = entries.find(e => e.description === 'Test 2');
            const entry3 = entries.find(e => e.description === 'Test 3');
            expect(entry1).toBeDefined();
            expect(entry2).toBeDefined();
            expect(entry3).toBeDefined();
        });

        test('filtre les entrées par âge maximum (en jours)', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);

            await testDb.journal.add({
                turn: 0,
                date: oldDate.toISOString(),
                type: 'citizen_tax',
                amount: 10,
                description: 'Ancienne entrée'
            });

            resetSessionLedgerBufferForTests();

            const entries = await budgetManager.getJournalEntries(7);
            
            // L'entrée ancienne ne devrait pas être incluse
            const oldEntries = entries.filter(e => e.description === 'Ancienne entrée');
            expect(oldEntries).toHaveLength(0);
        });
    });
});

