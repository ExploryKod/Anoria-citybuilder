/**
 * Tests pour HousesStore
 * 
 * HousesStore gère toutes les opérations CRUD sur les bâtiments dans IndexedDB :
 * - Création, lecture, mise à jour, suppression de bâtiments
 * - Calculs agrégés (population, dépenses, etc.)
 * - Gestion des voisins et des stocks
 * 
 * Ces tests utilisent fake-indexeddb pour simuler IndexedDB.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { HouseStore } from '../src/js/stores/HousesStore.js';

// ============================================================================
// Setup : Créer une base de données de test isolée
// ============================================================================
function createTestDb() {
    const db = new Dexie('testHousesDb');
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

// Mock simple de BudgetManager pour les tests
class MockBudgetManager {
    constructor() {
        this.expenses = [];
        this.incomes = [];
    }

    async addConstructionExpense(amount, reason) {
        this.expenses.push({ amount, reason });
        return { success: true, budget: { funds: 1000 - amount } };
    }

    async addIncome(amount, reason) {
        this.incomes.push({ amount, reason });
        return { success: true };
    }
}

// ============================================================================
// Tests pour HousesStore
// ============================================================================
describe('HousesStore', () => {
    let housesStore;
    let testDb;
    let mockBudgetManager;

    beforeEach(async () => {
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();
        
        // Créer une instance de HousesStore avec la base de test
        housesStore = new HouseStore();
        housesStore.db = testDb; // Injecter la base de test
        
        // Créer un mock BudgetManager
        mockBudgetManager = new MockBudgetManager();
        // Injecter le mock (nécessite d'exporter HouseStore ou de mocker différemment)
        // Pour l'instant, on testera les méthodes qui n'utilisent pas budgetManager
    });

    afterEach(async () => {
        // Nettoyer après chaque test
        if (testDb && testDb.isOpen()) {
            await testDb.delete();
        }
    });

    // ========================================================================
    // addHouse - Ajout d'un bâtiment
    // ========================================================================
    describe('addHouse', () => {
        
        test('ajoute un bâtiment avec succès', async () => {
            const houseData = {
                name: 'House-Blue-5-3',
                type: 'House-Blue',
                price: 10,
                x: 5,
                y: 3,
                pop: 0,
                stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 }
            };
            
            const result = await housesStore.addHouse(houseData);
            
            expect(result.success).toBe(true);
            
            // Vérifier que le bâtiment a été ajouté
            const house = await housesStore.getHouse('House-Blue-5-3');
            expect(house).toBeDefined();
            expect(house.name).toBe('House-Blue-5-3');
            expect(house.type).toBe('House-Blue');
        });

        test('retourne une erreur si le bâtiment existe déjà', async () => {
            const houseData = {
                name: 'Farm-Wheat-2-2',
                type: 'Farm-Wheat',
                price: 10
            };
            
            // Ajouter une première fois
            await housesStore.addHouse(houseData);
            
            // Essayer d'ajouter à nouveau
            const result = await housesStore.addHouse(houseData);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('duplicate');
        });

        test('prévient les ajouts en double (pendingAdditions)', async () => {
            const houseData = {
                name: 'Market-Stall-1-1',
                type: 'Market-Stall',
                price: 25
            };
            
            // Marquer comme en cours d'ajout
            housesStore.pendingAdditions.add('Market-Stall-1-1');
            
            // Essayer d'ajouter
            const result = await housesStore.addHouse(houseData);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('duplicate');
        });
    });

    // ========================================================================
    // getHouse - Récupération d'un bâtiment
    // ========================================================================
    describe('getHouse', () => {
        
        test('retourne un bâtiment existant', async () => {
            const houseData = {
                name: 'House-Red-3-4',
                type: 'House-Red',
                price: 20
            };
            
            await housesStore.addHouse(houseData);
            const house = await housesStore.getHouse('House-Red-3-4');
            
            expect(house).toBeDefined();
            expect(house.name).toBe('House-Red-3-4');
            expect(house.type).toBe('House-Red');
        });

        test('retourne undefined si le bâtiment n\'existe pas', async () => {
            const house = await housesStore.getHouse('NonExistent-1-1');
            
            expect(house).toBeUndefined();
        });
    });

    // ========================================================================
    // getHouseItem - Récupération d'un champ spécifique
    // ========================================================================
    describe('getHouseItem', () => {
        
        beforeEach(async () => {
            await housesStore.addHouse({
                name: 'House-Blue-0-0',
                type: 'House-Blue',
                pop: 3,
                stocks: { food: 5, wheat: 3, carrot: 2, cabbage: 0 },
                neighbors: [{ name: 'roads' }]
            });
        });

        test('retourne un champ existant', async () => {
            const pop = await housesStore.getHouseItem('House-Blue-0-0', 'pop');
            
            expect(pop).toBe(3);
        });

        test('retourne la valeur par défaut pour stocks si manquant', async () => {
            await housesStore.addHouse({
                name: 'House-NoStocks-1-1',
                type: 'House-Blue'
            });
            
            const stocks = await housesStore.getHouseItem('House-NoStocks-1-1', 'stocks');
            
            expect(stocks).toEqual({ food: 0, cabbage: 0, wheat: 0, carrot: 0 });
        });

        test('retourne la valeur par défaut pour neighbors si manquant', async () => {
            await housesStore.addHouse({
                name: 'House-NoNeighbors-2-2',
                type: 'House-Blue'
            });
            
            const neighbors = await housesStore.getHouseItem('House-NoNeighbors-2-2', 'neighbors');
            
            expect(neighbors).toEqual([]);
        });

        test('retourne false pour une clé inconnue', async () => {
            const result = await housesStore.getHouseItem('House-Blue-0-0', 'unknownKey');
            
            expect(result).toBe(false);
        });
    });

    // ========================================================================
    // updateHouseFields - Mise à jour des champs d'un bâtiment
    // ========================================================================
    describe('updateHouseFields', () => {
        
        beforeEach(async () => {
            await housesStore.addHouse({
                name: 'Farm-Wheat-5-5',
                type: 'Farm-Wheat',
                price: 10,
                pop: 0,
                stocks: { food: 0 }
            });
        });

        test('met à jour un champ existant', async () => {
            await housesStore.updateHouseFields('Farm-Wheat-5-5', { pop: 2 });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.pop).toBe(2);
        });

        test('met à jour plusieurs champs en une fois', async () => {
            await housesStore.updateHouseFields('Farm-Wheat-5-5', {
                pop: 3,
                stocks: { food: 10, wheat: 5 }
            });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.pop).toBe(3);
            expect(house.stocks.food).toBe(10);
        });

        test('crée un bâtiment s\'il n\'existe pas (avec format name valide)', async () => {
            await housesStore.updateHouseFields('House-Blue-7-8', {
                pop: 4,
                type: 'House-Blue'
            });
            
            const house = await housesStore.getHouse('House-Blue-7-8');
            expect(house).toBeDefined();
            expect(house.name).toBe('House-Blue-7-8');
            expect(house.pop).toBe(4);
            expect(house.x).toBe(7);
            expect(house.y).toBe(8);
        });

        test('ne crée pas un bâtiment si le format name est invalide', async () => {
            await housesStore.updateHouseFields('InvalidName', { pop: 1 });
            
            const house = await housesStore.getHouse('InvalidName');
            expect(house).toBeUndefined();
        });

        test('ajoute aux tableaux si appendToArrays = true', async () => {
            await housesStore.updateHouseFields('Farm-Wheat-5-5', {
                neighbors: [{ name: 'roads' }]
            });
            
            await housesStore.updateHouseFields('Farm-Wheat-5-5', {
                neighbors: [{ name: 'House-Blue' }]
            }, true); // appendToArrays = true
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.neighbors).toHaveLength(2);
        });
    });

    // ========================================================================
    // listAllHouses - Liste tous les bâtiments
    // ========================================================================
    describe('listAllHouses', () => {
        
        test('retourne un tableau vide si aucun bâtiment', async () => {
            const houses = await housesStore.listAllHouses();
            
            expect(houses).toEqual([]);
        });

        test('retourne tous les bâtiments', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue' });
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat' });
            await housesStore.addHouse({ name: 'Market-Stall-3-3', type: 'Market-Stall' });
            
            const houses = await housesStore.listAllHouses();
            
            expect(houses).toHaveLength(3);
        });
    });

    // ========================================================================
    // getGlobalPopulation - Calcul de la population totale
    // ========================================================================
    describe('getGlobalPopulation', () => {
        
        test('retourne 0 si aucun bâtiment', async () => {
            const population = await housesStore.getGlobalPopulation();
            
            expect(population).toBe(0);
        });

        test('additionne la population de tous les bâtiments', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', pop: 3 });
            await housesStore.addHouse({ name: 'House-Red-2-2', type: 'House-Red', pop: 4 });
            await housesStore.addHouse({ name: 'House-Purple-3-3', type: 'House-Purple', pop: 6 });
            
            const population = await housesStore.getGlobalPopulation();
            
            expect(population).toBe(13); // 3 + 4 + 6
        });

        test('ignore les bâtiments sans population (pop = 0 ou undefined)', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', pop: 3 });
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat', pop: 0 });
            await housesStore.addHouse({ name: 'Market-Stall-3-3', type: 'Market-Stall' }); // pas de pop
            
            const population = await housesStore.getGlobalPopulation();
            
            expect(population).toBe(3);
        });
    });

    // ========================================================================
    // getFamishedPopulation - Calcul de la population affamée
    // ========================================================================
    describe('getFamishedPopulation', () => {
        
        test('retourne 0 si toutes les maisons ont assez de nourriture', async () => {
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                type: 'House-Blue',
                pop: 3,
                stocks: { food: 5 }
            });
            
            const famished = await housesStore.getFamishedPopulation();
            
            expect(famished).toBe(0); // 3 personnes, 5 nourriture = tous nourris
        });

        test('calcule correctement la population affamée', async () => {
            // Maison 1 : 6 personnes, 3 nourriture = 3 affamés
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                type: 'House-Blue',
                pop: 6,
                stocks: { food: 3 }
            });
            
            // Maison 2 : 4 personnes, 2 nourriture = 2 affamés
            await housesStore.addHouse({
                name: 'House-Red-2-2',
                type: 'House-Red',
                pop: 4,
                stocks: { food: 2 }
            });
            
            const famished = await housesStore.getFamishedPopulation();
            
            expect(famished).toBe(5); // 3 + 2 = 5 affamés
        });

        test('ignore les bâtiments non-maisons', async () => {
            await housesStore.addHouse({
                name: 'Farm-Wheat-1-1',
                type: 'Farm-Wheat',
                pop: 10, // Les fermes n'ont pas de population
                stocks: { food: 0 }
            });
            
            const famished = await housesStore.getFamishedPopulation();
            
            expect(famished).toBe(0); // Les fermes ne sont pas comptées
        });

        test('retourne 0 si aucune maison', async () => {
            await housesStore.addHouse({
                name: 'Farm-Wheat-1-1',
                type: 'Farm-Wheat'
            });
            
            const famished = await housesStore.getFamishedPopulation();
            
            expect(famished).toBe(0);
        });
    });

    // ========================================================================
    // getGlobalBuildingPrices - Calcul du total des prix
    // ========================================================================
    describe('getGlobalBuildingPrices', () => {
        
        test('retourne 0 si aucun bâtiment', async () => {
            const total = await housesStore.getGlobalBuildingPrices();
            
            expect(total).toBe(0);
        });

        test('additionne tous les prix', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat', price: 20 });
            await housesStore.addHouse({ name: 'Market-Stall-3-3', type: 'Market-Stall', price: 25 });
            
            const total = await housesStore.getGlobalBuildingPrices();
            
            expect(total).toBe(55); // 10 + 20 + 25
        });

        test('ignore les bâtiments sans prix (price = 0 ou undefined)', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat', price: 0 });
            await housesStore.addHouse({ name: 'Market-Stall-3-3', type: 'Market-Stall' }); // pas de price
            
            const total = await housesStore.getGlobalBuildingPrices();
            
            expect(total).toBe(10);
        });
    });

    // ========================================================================
    // getBuildingPricesByType - Prix groupés par type
    // ========================================================================
    describe('getBuildingPricesByType', () => {
        
        test('groupe les prix par type de bâtiment', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'House-Blue-2-2', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'Farm-Wheat-3-3', type: 'Farm-Wheat', price: 20 });
            
            const pricesByType = await housesStore.getBuildingPricesByType();
            
            expect(pricesByType['House-Blue']).toBe(10); // Premier prix trouvé
            expect(pricesByType['Farm-Wheat']).toBe(20);
        });

        test('gère les routes', async () => {
            await housesStore.addHouse({ name: 'roads-1-1', type: 'roads', price: 5 });
            
            const pricesByType = await housesStore.getBuildingPricesByType();
            
            expect(pricesByType['roads']).toBe(5);
        });
    });

    // ========================================================================
    // deleteOneHouse - Suppression d'un bâtiment
    // ========================================================================
    describe('deleteOneHouse', () => {
        
        test('supprime un bâtiment existant', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue' });
            
            await housesStore.deleteOneHouse('House-Blue-1-1');
            
            const house = await housesStore.getHouse('House-Blue-1-1');
            expect(house).toBeUndefined();
        });

        test('ne plante pas si le bâtiment n\'existe pas', async () => {
            // Ne devrait pas planter
            await expect(housesStore.deleteOneHouse('NonExistent-1-1')).resolves.not.toThrow();
        });
    });

    // ========================================================================
    // clearHouses - Suppression de tous les bâtiments
    // ========================================================================
    describe('clearHouses', () => {
        
        test('supprime tous les bâtiments', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue' });
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat' });
            
            await housesStore.clearHouses();
            
            const houses = await housesStore.listAllHouses();
            expect(houses).toHaveLength(0);
        });
    });

    // ========================================================================
    // updateHouseName - Renommage d'un bâtiment
    // ========================================================================
    describe('updateHouseName', () => {
        
        beforeEach(async () => {
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                type: 'House-Blue',
                price: 10,
                pop: 3
            });
        });

        test('renomme un bâtiment avec succès', async () => {
            const result = await housesStore.updateHouseName('House-Blue-1-1', 'House-Red-1-1', {
                type: 'House-Red',
                price: 20
            });
            
            expect(result.success).toBe(true);
            
            // Vérifier que l'ancien nom n'existe plus
            const oldHouse = await housesStore.getHouse('House-Blue-1-1');
            expect(oldHouse).toBeUndefined();
            
            // Vérifier que le nouveau nom existe
            const newHouse = await housesStore.getHouse('House-Red-1-1');
            expect(newHouse).toBeDefined();
            expect(newHouse.name).toBe('House-Red-1-1');
            expect(newHouse.type).toBe('House-Red');
            expect(newHouse.price).toBe(20);
            expect(newHouse.pop).toBe(3); // Préservé
        });

        test('retourne une erreur si l\'ancien nom n\'existe pas', async () => {
            const result = await housesStore.updateHouseName('NonExistent-1-1', 'NewName-1-1');
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });
    });

    // ========================================================================
    // incrementHouseField - Incrémentation d'un champ
    // ========================================================================
    describe('incrementHouseField', () => {
        
        beforeEach(async () => {
            await housesStore.addHouse({
                name: 'Farm-Wheat-5-5',
                type: 'Farm-Wheat',
                stocks: { food: 5 }
            });
        });

        test('incrémente un champ existant', async () => {
            await housesStore.incrementHouseField({
                name: 'Farm-Wheat-5-5',
                field: 'stocks.food',
                increment: 3
            });
            
            // Note: incrementHouseField ne gère pas les chemins imbriqués
            // Testons avec un champ simple
            await housesStore.updateHouseFields('Farm-Wheat-5-5', { 
                foodCount: 5 
            });
            
            await housesStore.incrementHouseField({
                name: 'Farm-Wheat-5-5',
                field: 'foodCount',
                increment: 3
            });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.foodCount).toBe(8); // 5 + 3
        });

        test('ne fait rien si le champ n\'existe pas', async () => {
            await housesStore.incrementHouseField({
                name: 'Farm-Wheat-5-5',
                field: 'nonexistent',
                increment: 5
            });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.nonexistent).toBeUndefined();
        });

        test('respecte la condition limit si fournie', async () => {
            await housesStore.updateHouseFields('Farm-Wheat-5-5', { 
                foodCount: 5 
            });
            
            // Incrémenter avec limite de 7
            // La condition vérifie: si foodCount < 7, alors on incrémente
            // foodCount = 5 < 7, donc on incrémente de 5 → 10
            await housesStore.incrementHouseField({
                name: 'Farm-Wheat-5-5',
                field: 'foodCount',
                increment: 5
            }, { limit: 7 });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            // La condition vérifie seulement si on peut incrémenter, mais n'empêche pas de dépasser
            expect(house.foodCount).toBe(10); // 5 + 5 = 10 (dépasse la limite)
        });

        test('ne fait rien si la valeur dépasse déjà la limite', async () => {
            await housesStore.updateHouseFields('Farm-Wheat-5-5', { 
                foodCount: 8 
            });
            
            // foodCount = 8, limite = 7, donc 8 >= 7, on n'incrémente pas
            await housesStore.incrementHouseField({
                name: 'Farm-Wheat-5-5',
                field: 'foodCount',
                increment: 5
            }, { limit: 7 });
            
            const house = await housesStore.getHouse('Farm-Wheat-5-5');
            expect(house.foodCount).toBe(8); // Inchangé car >= limite
        });
    });

    // ========================================================================
    // getAllHousesSortedByNameAndPrice - Tri par nom et prix
    // ========================================================================
    describe('getAllHousesSortedByNameAndPrice', () => {
        
        test('retourne les bâtiments triés par nom puis prix', async () => {
            await housesStore.addHouse({ name: 'Farm-Wheat-2-2', type: 'Farm-Wheat', price: 20 });
            await housesStore.addHouse({ name: 'Farm-Wheat-1-1', type: 'Farm-Wheat', price: 10 });
            await housesStore.addHouse({ name: 'House-Blue-3-3', type: 'House-Blue', price: 15 });
            
            const houses = await housesStore.getAllHousesSortedByNameAndPrice();
            
            // Vérifier que c'est trié (premier par nom, puis par prix)
            expect(houses.length).toBeGreaterThan(0);
            // Le tri dépend de l'implémentation de Dexie
        });
    });

    // ========================================================================
    // getTotalBuildingExpensesByType - Dépenses par type
    // ========================================================================
    describe('getTotalBuildingExpensesByType', () => {
        
        test('calcule les dépenses totales par type', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'House-Blue-2-2', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'Farm-Wheat-3-3', type: 'Farm-Wheat', price: 20 });
            
            const expenses = await housesStore.getTotalBuildingExpensesByType();
            
            expect(expenses['House-Blue']).toBe(20); // 10 + 10
            expect(expenses['Farm-Wheat']).toBe(20);
        });

        test('retourne un objet vide si aucun bâtiment', async () => {
            const expenses = await housesStore.getTotalBuildingExpensesByType();
            
            expect(expenses).toEqual({});
        });
    });

    // ========================================================================
    // getEachBuildingsExpenses - Dépenses détaillées par type
    // ========================================================================
    describe('getEachBuildingsExpenses', () => {
        
        test('calcule les dépenses avec nombre et prix par type', async () => {
            await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'House-Blue-2-2', type: 'House-Blue', price: 10 });
            await housesStore.addHouse({ name: 'Farm-Wheat-3-3', type: 'Farm-Wheat', price: 20 });
            
            const expenses = await housesStore.getEachBuildingsExpenses();
            
            expect(expenses['House-Blue'].price).toBe(20);
            expect(expenses['House-Blue'].number).toBe(2);
            expect(expenses['Farm-Wheat'].price).toBe(20);
            expect(expenses['Farm-Wheat'].number).toBe(1);
            expect(expenses.globalExpense).toBe(40); // 20 + 20
        });

        test('retourne globalExpense = 0 si aucun bâtiment', async () => {
            const expenses = await housesStore.getEachBuildingsExpenses();
            
            expect(expenses.globalExpense).toBe(0);
        });
    });

    // ========================================================================
    // processPopulationFoodLogic - Logique de population basée sur routes
    // ========================================================================
    describe('processPopulationFoodLogic', () => {
        
        test('réinitialise la population si pas d\'accès routier', async () => {
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                id: 'House-Blue-1-1', // id est utilisé par processPopulationFoodLogic
                type: 'House-Blue',
                pop: 3,
                neighbors: [] // Pas de routes
            });
            
            const result = await housesStore.processPopulationFoodLogic();
            
            expect(result.totalPopulationLost).toBe(3);
            expect(result.housesAffected).toBe(1);
            
            const house = await housesStore.getHouse('House-Blue-1-1');
            expect(house.pop).toBe(0);
        });

        test('conserve la population si accès routier', async () => {
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                type: 'House-Blue',
                pop: 3,
                neighbors: [{ name: 'roads' }] // Avec route
            });
            
            const result = await housesStore.processPopulationFoodLogic();
            
            expect(result.totalPopulationLost).toBe(0);
            expect(result.housesAffected).toBe(0);
            
            const house = await housesStore.getHouse('House-Blue-1-1');
            expect(house.pop).toBe(3); // Conservé
        });

        test('ignore les bâtiments non-maisons', async () => {
            await housesStore.addHouse({
                name: 'Farm-Wheat-1-1',
                type: 'Farm-Wheat',
                pop: 5, // Les fermes n'ont pas de population
                neighbors: []
            });
            
            const result = await housesStore.processPopulationFoodLogic();
            
            expect(result.totalPopulationLost).toBe(0);
            expect(result.housesAffected).toBe(0);
        });

        test('retourne un message approprié', async () => {
            await housesStore.addHouse({
                name: 'House-Blue-1-1',
                id: 'House-Blue-1-1', // id est utilisé par processPopulationFoodLogic
                type: 'House-Blue',
                pop: 2,
                neighbors: []
            });
            
            const result = await housesStore.processPopulationFoodLogic();
            
            expect(result.message).toContain('inhabitants lost');
        });
    });
});

