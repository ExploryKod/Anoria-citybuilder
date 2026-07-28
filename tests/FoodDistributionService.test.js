/**
 * Tests pour FoodDistributionService
 * 
 * FoodDistributionService gère la distribution alimentaire à l'échelle de la ville :
 * - Fermes → Marchés (collecte)
 * - Marchés → Maisons (distribution)
 * - Gestion des saisons (hiver, automne)
 * - Calcul de distance Manhattan
 * - Vérification des routes et employés
 * 
 * Ces tests utilisent fake-indexeddb pour simuler IndexedDB.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { FoodDistributionService } from '../src/js/game/services/FoodDistributionService.js';
import { HouseStore } from '../src/js/stores/HousesStore.js';

// ============================================================================
// Setup : Créer une base de données de test isolée
// ============================================================================
function createTestDb() {
    const db = new Dexie('testFoodDb');
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

// TimeManager est utilisé directement, on utilise le vrai TimeManager
// Pour contrôler les saisons, on passe le bon paramètre `time` (nombre de jours)
// Automne = septembre-octobre-novembre (mois 8, 9, 10)
// Été = juin-juillet-août (mois 5, 6, 7)
// Hiver = janvier-février-mars (mois 0, 1, 2)

// ============================================================================
// Tests pour FoodDistributionService
// ============================================================================
describe('FoodDistributionService', () => {
    let foodService;
    let housesStore;
    let testDb;

    beforeEach(async () => {
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();
        
        // Créer une instance de HousesStore avec la base de test
        housesStore = new HouseStore();
        housesStore.db = testDb;
        
        // Créer une instance du service
        foodService = new FoodDistributionService();
    });

    afterEach(async () => {
        // Nettoyer après chaque test
        if (testDb && testDb.isOpen()) {
            await testDb.delete();
        }
    });

    // ========================================================================
    // calculateDistance - Distance Manhattan
    // ========================================================================
    describe('calculateDistance', () => {
        
        test('calcule la distance Manhattan correctement', () => {
            // Distance horizontale : |5 - 2| = 3
            // Distance verticale : |3 - 1| = 2
            // Total : 3 + 2 = 5
            const distance = foodService.calculateDistance(5, 3, 2, 1);
            
            expect(distance).toBe(5);
        });

        test('retourne 0 si les points sont identiques', () => {
            const distance = foodService.calculateDistance(5, 3, 5, 3);
            
            expect(distance).toBe(0);
        });

        test('gère les coordonnées négatives', () => {
            // Distance : |5 - (-2)| + |3 - (-1)| = 7 + 4 = 11
            const distance = foodService.calculateDistance(5, 3, -2, -1);
            
            expect(distance).toBe(11);
        });

        test('gère les distances horizontales uniquement', () => {
            // Même Y, distance = |10 - 5| = 5
            const distance = foodService.calculateDistance(10, 5, 5, 5);
            
            expect(distance).toBe(5);
        });

        test('gère les distances verticales uniquement', () => {
            // Même X, distance = |10 - 5| = 5
            const distance = foodService.calculateDistance(5, 10, 5, 5);
            
            expect(distance).toBe(5);
        });
    });

    // ========================================================================
    // findHousesInRange - Trouve les maisons dans la portée
    // ========================================================================
    describe('findHousesInRange', () => {
        
        const market = {
            id: 'Market-Stall-5-5',
            name: 'Market-Stall-5-5',
            type: 'Market-Stall',
            x: 5,
            y: 5
        };

        beforeEach(() => {
            // foodDistributionDistance est lu depuis config, on ne peut pas le mocker facilement
            // On va tester avec la valeur par défaut (5)
        });

        test('retourne les maisons dans la portée', () => {
            const allHouses = [
                {
                    id: 'House-Blue-5-3',
                    name: 'House-Blue-5-3',
                    type: 'House-Blue',
                    x: 5,
                    y: 3, // Distance = 2 (dans la portée)
                    roads: 1,
                },
                {
                    id: 'House-Red-7-5',
                    name: 'House-Red-7-5',
                    type: 'House-Red',
                    x: 7,
                    y: 5, // Distance = 2 (dans la portée)
                    roads: 1,
                }
            ];
            
            const housesInRange = foodService.findHousesInRange(market, allHouses);
            
            expect(housesInRange).toHaveLength(2);
        });

        test('exclut les maisons trop loin', () => {
            const allHouses = [
                {
                    id: 'House-Blue-5-3',
                    name: 'House-Blue-5-3',
                    type: 'House-Blue',
                    x: 5,
                    y: 3, // Distance = 2 (dans la portée)
                    roads: 1,
                },
                {
                    id: 'House-Red-15-15',
                    name: 'House-Red-15-15',
                    type: 'House-Red',
                    x: 15,
                    y: 15, // Distance = 20 (trop loin)
                    roads: 1,
                }
            ];
            
            const housesInRange = foodService.findHousesInRange(market, allHouses);
            
            expect(housesInRange).toHaveLength(1);
            expect(housesInRange[0].id).toBe('House-Blue-5-3');
        });

        test('exclut les maisons sans route', () => {
            const allHouses = [
                {
                    id: 'House-Blue-5-3',
                    name: 'House-Blue-5-3',
                    type: 'House-Blue',
                    x: 5,
                    y: 3,
                    roads: 0,
                }
            ];
            
            const housesInRange = foodService.findHousesInRange(market, allHouses);
            
            expect(housesInRange).toHaveLength(0);
        });

        test('exclut les bâtiments non-maisons', () => {
            const allHouses = [
                {
                    id: 'Farm-Wheat-5-3',
                    name: 'Farm-Wheat-5-3',
                    type: 'Farm-Wheat',
                    x: 5,
                    y: 3,
                    roads: 1,
                }
            ];
            
            const housesInRange = foodService.findHousesInRange(market, allHouses);
            
            expect(housesInRange).toHaveLength(0);
        });

        test('retourne un tableau vide si le marché n\'a pas de coordonnées', () => {
            const marketWithoutCoords = {
                id: 'Market-Stall-1',
                type: 'Market-Stall'
                // Pas de x, y
            };
            
            const housesInRange = foodService.findHousesInRange(marketWithoutCoords, []);
            
            expect(housesInRange).toEqual([]);
        });
    });

    // ========================================================================
    // processMarket - Traitement d'un marché (logique principale)
    // ========================================================================
    describe('processMarket', () => {
        
        // Utilise le vrai TimeManager - pas besoin de mock

        test('ne fait rien si le marché n\'existe pas dans la base', async () => {
            const market = {
                id: 'NonExistent-Market',
                type: 'Market-Stall'
            };
            
            await foodService.processMarket(market, housesStore, [], 0);
            
            // Ne devrait pas planter
            expect(true).toBe(true);
        });

        test('ne fait rien si le marché n\'a pas d\'accès routier', async () => {
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 0,
                neighbors: [],
            };
            
            await housesStore.addHouse(market);
            await foodService.processMarket(market, housesStore, [], 0);
            
            // Le marché ne devrait pas avoir de stocks
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.stocks?.food || 0).toBe(0);
        });

        test('ne fait rien si le marché n\'a pas d\'employés', async () => {
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }],
                employees: { worker: 0, worker_need: 3 } // Pas d'employés
            };
            
            await housesStore.addHouse(market);
            await foodService.processMarket(market, housesStore, [], 0);
            
            // Le marché ne devrait pas avoir de stocks
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.stocks?.food || 0).toBe(0);
        });

        test('met à jour noFarmsNearby si pas de fermes à proximité', async () => {
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }], // Pas de fermes
                employees: { worker: 2, worker_need: 2 }
            };
            
            await housesStore.addHouse(market);
            await foodService.processMarket(market, housesStore, [], 0);
            
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.noFarmsNearby).toBe(true);
        });

        test('met à jour noFarmsNearby à false si des fermes sont à proximité', async () => {
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                neighbors: [
                    { name: 'roads', isRoad: true },
                    { name: 'Farm-Wheat-5-4', type: 'Farm-Wheat', x: 5, y: 4 }
                ],
                employees: { worker: 2, worker_need: 2 }
            };
            
            await housesStore.addHouse(market);
            await foodService.processMarket(market, housesStore, [], 0);
            
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.noFarmsNearby).toBe(false);
        });
    });

    // ========================================================================
    // simulate - Orchestration globale
    // ========================================================================
    describe('simulate', () => {
        
        test('met à jour isBuying en automne', async () => {
            // Avec DAYS_PER_MONTH = 1 (mode test), septembre = mois 8 = jour 8
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }],
                employees: { worker: 2, worker_need: 2 }
            };
            
            await housesStore.addHouse(market);
            
            const city = { size: 16, tiles: [] };
            // Jour 8 = septembre (mois 8) = Automne
            await foodService.simulate(city, housesStore, 8);
            
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.isBuying).toBe(true);
        });

        test('met à jour isBuying à false hors automne', async () => {
            // Avec DAYS_PER_MONTH = 1, juillet = mois 6 = jour 6
            const market = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }],
                employees: { worker: 2, worker_need: 2 },
                isBuying: true // Initialement true
            };
            
            await housesStore.addHouse(market);
            
            const city = { size: 16, tiles: [] };
            // Jour 6 = juillet (mois 6) = Été (pas Automne)
            await foodService.simulate(city, housesStore, 6);
            
            const marketData = await housesStore.getHouse('Market-Stall-5-5');
            expect(marketData.isBuying).toBe(false);
        });

        test('traite tous les marchés', async () => {
            const market1 = {
                id: 'Market-Stall-5-5',
                name: 'Market-Stall-5-5',
                type: 'Market-Stall',
                x: 5,
                y: 5,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }],
                employees: { worker: 2, worker_need: 2 }
            };
            
            const market2 = {
                id: 'Market-Stall-10-10',
                name: 'Market-Stall-10-10',
                type: 'Market-Stall',
                x: 10,
                y: 10,
                roads: 1,
                neighbors: [{ name: 'roads', isRoad: true }],
                employees: { worker: 2, worker_need: 2 }
            };
            
            await housesStore.addHouse(market1);
            await housesStore.addHouse(market2);
            
            const city = { size: 16, tiles: [] };
            // Jour 8 = septembre = Automne
            await foodService.simulate(city, housesStore, 8);
            
            const data1 = await housesStore.getHouse('Market-Stall-5-5');
            const data2 = await housesStore.getHouse('Market-Stall-10-10');
            
            expect(data1.isBuying).toBe(true);
            expect(data2.isBuying).toBe(true);
        });
    });
});

