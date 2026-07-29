/**
 * Tests pour HousesStore (PK = instanceId UUID)
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { HouseStore } from '../src/js/stores/HousesStore.js';
import { createBuildingInstanceId } from '../src/shared/building-identity/index.js';
import { makeHouseRecord } from './fixtures/buildingRecord.js';

function createTestDb() {
    const db = new Dexie('testHousesDb');
    db.version(1).stores({
        houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
        game: 'name',
        budget: 'name',
        objectives: 'name',
        journal: '++id, turn, date, type, amount, description',
        foodTraceability:
            '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
    });
    return db;
}

describe('HousesStore', () => {
    let housesStore;
    let testDb;

    beforeEach(async () => {
        testDb = createTestDb();
        await testDb.open();
        housesStore = new HouseStore();
        housesStore.db = testDb;
    });

    afterEach(async () => {
        if (testDb?.isOpen()) {
            await testDb.delete();
        }
    });

    describe('addHouse', () => {
        test('ajoute un bâtiment avec succès', async () => {
            const record = makeHouseRecord({ type: 'House-Blue', x: 5, y: 3 });
            const result = await housesStore.addHouse(record);

            expect(result.success).toBe(true);

            const house = await housesStore.getHouse(record.instanceId);
            expect(house).toBeDefined();
            expect(house.instanceId).toBe(record.instanceId);
            expect(house.type).toBe('House-Blue');
        });

        test('retourne une erreur si le bâtiment existe déjà', async () => {
            const record = makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2 });
            await housesStore.addHouse(record);

            const result = await housesStore.addHouse(record);
            expect(result.success).toBe(false);
            expect(result.reason).toBe('duplicate');
        });

        test('prévient les ajouts en double (pendingAdditions)', async () => {
            const record = makeHouseRecord({ type: 'Market-Stall', x: 1, y: 1 });
            housesStore.pendingAdditions.add(record.instanceId);

            const result = await housesStore.addHouse(record);
            expect(result.success).toBe(false);
            expect(result.reason).toBe('duplicate');
        });
    });

    describe('getHouse', () => {
        test('retourne un bâtiment existant', async () => {
            const record = makeHouseRecord({ type: 'House-Red', x: 3, y: 4, extra: { price: 20 } });
            await housesStore.addHouse(record);

            const house = await housesStore.getHouse(record.instanceId);
            expect(house).toBeDefined();
            expect(house.type).toBe('House-Red');
        });

        test('retourne undefined si le bâtiment n\'existe pas', async () => {
            const house = await housesStore.getHouse(createBuildingInstanceId());
            expect(house).toBeUndefined();
        });
    });

    describe('getHouseItem', () => {
        let houseId;

        beforeEach(async () => {
            const record = makeHouseRecord({
                type: 'House-Blue',
                x: 0,
                y: 0,
                extra: {
                    pop: 3,
                    stocks: { food: 5, wheat: 3, carrot: 2, cabbage: 0 },
                    neighbors: [{ name: 'roads' }],
                },
            });
            houseId = record.instanceId;
            await housesStore.addHouse(record);
        });

        test('retourne un champ existant', async () => {
            expect(await housesStore.getHouseItem(houseId, 'pop')).toBe(3);
        });

        test('retourne la valeur par défaut pour stocks si manquant', async () => {
            const record = makeHouseRecord({ type: 'House-Blue', x: 1, y: 1 });
            await housesStore.addHouse(record);
            expect(await housesStore.getHouseItem(record.instanceId, 'stocks')).toEqual({
                food: 0,
                cabbage: 0,
                wheat: 0,
                carrot: 0,
            });
        });

        test('retourne false pour une clé inconnue', async () => {
            expect(await housesStore.getHouseItem(houseId, 'unknownKey')).toBe(false);
        });
    });

    describe('updateHouseFields', () => {
        let farmId;

        beforeEach(async () => {
            const record = makeHouseRecord({
                type: 'Farm-Wheat',
                x: 5,
                y: 5,
                extra: { pop: 0, stocks: { food: 0 } },
            });
            farmId = record.instanceId;
            await housesStore.addHouse(record);
        });

        test('met à jour un champ existant', async () => {
            await housesStore.updateHouseFields(farmId, { pop: 2 });
            expect((await housesStore.getHouse(farmId)).pop).toBe(2);
        });

        test('ne crée pas un bâtiment s\'il n\'existe pas', async () => {
            const missingId = createBuildingInstanceId();
            await housesStore.updateHouseFields(missingId, { pop: 1 });
            expect(await housesStore.getHouse(missingId)).toBeUndefined();
        });

        test('ajoute aux tableaux si appendToArrays = true', async () => {
            await housesStore.updateHouseFields(farmId, { neighbors: [{ name: 'roads' }] });
            await housesStore.updateHouseFields(farmId, { neighbors: [{ name: 'House-Blue' }] }, true);
            expect((await housesStore.getHouse(farmId)).neighbors).toHaveLength(2);
        });
    });

    describe('findHouseAtTile', () => {
        test('trouve un bâtiment par coordonnées', async () => {
            const record = makeHouseRecord({ type: 'House-Blue', x: 4, y: 6 });
            await housesStore.addHouse(record);

            const found = await housesStore.findHouseAtTile(4, 6);
            expect(found?.instanceId).toBe(record.instanceId);
        });
    });

    describe('listAllHouses', () => {
        test('retourne tous les bâtiments', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1 }));
            await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2 }));
            expect((await housesStore.listAllHouses())).toHaveLength(2);
        });
    });

    describe('getGlobalPopulation', () => {
        test('additionne la population des maisons résidentielles', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 3 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 4 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Purple', x: 3, y: 3, extra: { pop: 6 } }));
            expect(await housesStore.getGlobalPopulation()).toBe(13);
        });

        test('ignore les bâtiments non résidentiels', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 3 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2, extra: { pop: 99 } }));
            expect(await housesStore.getGlobalPopulation()).toBe(3);
        });
    });

    describe('getFamishedPopulation', () => {
        test('calcule correctement la population affamée', async () => {
            await housesStore.addHouse(
                makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 6, stocks: { food: 3 } } })
            );
            await housesStore.addHouse(
                makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 4, stocks: { food: 2 } } })
            );
            expect(await housesStore.getFamishedPopulation()).toBe(5);
        });
    });

    describe('getGlobalBuildingPrices', () => {
        test('additionne tous les prix', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 2, y: 2, extra: { price: 20 } }));
            expect(await housesStore.getGlobalBuildingPrices()).toBe(30);
        });
    });

    describe('getBuildingPricesByType', () => {
        test('groupe les prix par type de bâtiment', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { price: 20 } }));

            const pricesByType = await housesStore.getBuildingPricesByType();
            expect(pricesByType['House-Blue']).toBe(10);
            expect(pricesByType['Farm-Wheat']).toBe(20);
        });
    });

    describe('deleteOneHouse', () => {
        test('supprime un bâtiment existant', async () => {
            const record = makeHouseRecord({ type: 'House-Blue', x: 1, y: 1 });
            await housesStore.addHouse(record);
            await housesStore.deleteOneHouse(record.instanceId);
            expect(await housesStore.getHouse(record.instanceId)).toBeUndefined();
        });
    });

    describe('incrementHouseField', () => {
        let farmId;

        beforeEach(async () => {
            const record = makeHouseRecord({ type: 'Farm-Wheat', x: 5, y: 5 });
            farmId = record.instanceId;
            await housesStore.addHouse(record);
            await housesStore.updateHouseFields(farmId, { foodCount: 5 });
        });

        test('incrémente un champ existant', async () => {
            await housesStore.incrementHouseField({ name: farmId, field: 'foodCount', increment: 3 });
            expect((await housesStore.getHouse(farmId)).foodCount).toBe(8);
        });
    });

    describe('getTotalBuildingExpensesByType', () => {
        test('calcule les dépenses totales par type', async () => {
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 2, y: 2, extra: { price: 10 } }));
            await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { price: 20 } }));

            const expenses = await housesStore.getTotalBuildingExpensesByType();
            expect(expenses['House-Blue']).toBe(20);
            expect(expenses['Farm-Wheat']).toBe(20);
        });
    });

    describe('processPopulationFoodLogic', () => {
        test('réinitialise la population si pas d\'accès routier', async () => {
            const record = makeHouseRecord({
                type: 'House-Blue',
                x: 1,
                y: 1,
                extra: { pop: 3, roads: 0 },
            });
            await housesStore.addHouse(record);

            const result = await housesStore.processPopulationFoodLogic();
            expect(result.totalPopulationLost).toBe(3);
            expect((await housesStore.getHouse(record.instanceId)).pop).toBe(0);
        });

        test('conserve la population si accès routier', async () => {
            const record = makeHouseRecord({
                type: 'House-Blue',
                x: 1,
                y: 1,
                extra: { pop: 3, roads: 1 },
            });
            await housesStore.addHouse(record);

            const result = await housesStore.processPopulationFoodLogic();
            expect(result.totalPopulationLost).toBe(0);
            expect((await housesStore.getHouse(record.instanceId)).pop).toBe(3);
        });
    });
});
