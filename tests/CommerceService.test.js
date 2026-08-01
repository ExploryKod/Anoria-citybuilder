/**
 * Tests pour CommerceService avec les partenaires commerciaux
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { CommerceService } from '../src/js/game/services/CommerceService.js';
import { BudgetManager } from './helpers/testBudgetFacade.js';
import { JournalManager } from '../src/js/acl/accountingSessionJournal.js';
import commerceStore from '../src/js/stores/CommerceStore.js';
import db from '../src/core/persistence/dexie/db.js';
import { resetSupplyContextForTests } from '../src/composition/createSupplyContext.js';
import { resetCommerceContextForTests } from '../src/composition/createCommerceContext.js';
import { resetAccountingContextForTests } from '../src/js/acl/accounting.js';
import { resetSessionLedgerBufferForTests } from '../src/js/acl/accountingSessionJournal.js';
import { makeHouseRecord, createBuildingInstanceId } from './fixtures/buildingRecord.js';
import appRegistry from '../src/js/game/AppRegistry.js';
import { TimeManager } from '../src/js/game/utils/TimeManager.js';

// ============================================================================
// Setup : Créer une base de données de test isolée
// ============================================================================
function createTestDb() {
    const db = new Dexie('testCommerceDb');
    db.version(1).stores({
        houses: 'name, [name+price]',
        game: 'name',
        budget: 'name',
        journal: '++id, turn, date, type, amount, description'
    });
    return db;
}

// ============================================================================
// Tests pour CommerceService - Partenaires
// ============================================================================
describe('CommerceService - Partenaires', () => {
    let commerceService;
    let testDb;
    let budgetManager;

    beforeEach(async () => {
        resetSessionLedgerBufferForTests();
        resetAccountingContextForTests();
        resetCommerceContextForTests();
        // Créer une nouvelle base de données pour chaque test
        testDb = createTestDb();
        await testDb.open();

        // Nettoyer localStorage (déjà mocké dans setup.js)
        global.localStorage.clear();

        // Mock TimeManager
        appRegistry.register('timeManager', {
            getTimeInfo: (turn) => {
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
        });

        // Créer BudgetManager
        budgetManager = new BudgetManager();
        budgetManager.db = testDb;

        const journalManager = new JournalManager();
        journalManager.db = testDb;
        budgetManager.journalManager = journalManager;
        budgetManager.wireAccountingContext();

        // Créer CommerceService
        commerceService = new CommerceService();

        // Initialiser le budget
        await budgetManager.initialize(1000);
    });

    afterEach(async () => {
        resetCommerceContextForTests();
        resetSupplyContextForTests();
        appRegistry.register('timeManager', TimeManager);
        if (testDb && testDb.isOpen()) {
            await testDb.delete();
            testDb = null;
        }
        if (db.isOpen()) {
            await db.houses.clear();
        }
        global.localStorage.clear();
    });

    test('charge les partenaires depuis le store', () => {
        const mockPartners = [
            { id: 'deserta', name: 'Deserta', imports: [], exports: [] }
        ];

        global.localStorage.setItem('commerce_partners', JSON.stringify(mockPartners));

        const partners = commerceService.loadPartners();

        expect(partners).toBeDefined();
        expect(partners).toHaveLength(1);
        expect(partners[0].id).toBe('deserta');
    });

    test('récupère un partenaire par son ID', () => {
        const mockPartners = [
            { id: 'deserta', name: 'Deserta', imports: [], exports: [] },
            { id: 'tropicala', name: 'Tropicala', imports: [], exports: [] }
        ];

        commerceService.partnersData = mockPartners;

        const partner = commerceService.getPartner('tropicala');

        expect(partner).toBeDefined();
        expect(partner.name).toBe('Tropicala');
    });

    test('vérifie si on peut trader avec un partenaire (mois correct)', () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                isActive: true,
                imports: [
                    {
                        productId: 'carrot',
                        months: [7, 8, 11],
                        maxOccurrences: 9,
                        currentOccurrences: 0
                    }
                ],
                exports: []
            }
        ];

        commerceService.partnersData = mockPartners;

        // Tour 7 = mois index 7 (Août)
        const canTrade = commerceService.canTradeWithPartner('deserta', 'carrot', 'export', 7);

        expect(canTrade).toBe(true);
    });

    test('refuse le trade avec un partenaire (mois incorrect)', () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                imports: [
                    {
                        productId: 'carrot',
                        months: [7, 8, 11],
                        maxOccurrences: 9,
                        currentOccurrences: 0
                    }
                ],
                exports: []
            }
        ];

        commerceService.partnersData = mockPartners;

        // Tour 5 = mois index 5 (Juin) - pas dans la liste des mois
        const canTrade = commerceService.canTradeWithPartner('deserta', 'carrot', 'export', 5);

        expect(canTrade).toBe(false);
    });

    test('refuse le trade avec un partenaire (limite atteinte)', () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                imports: [
                    {
                        productId: 'carrot',
                        months: [7, 8, 11],
                        maxOccurrences: 9,
                        currentOccurrences: 9  // Limite atteinte
                    }
                ],
                exports: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const canTrade = commerceService.canTradeWithPartner('deserta', 'carrot', 'export', 7);

        expect(canTrade).toBe(false);
    });

    test('met à jour le compteur d\'occurrences après un trade', () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                imports: [
                    {
                        productId: 'carrot',
                        maxOccurrences: 9,
                        currentOccurrences: 0,
                        currentYearly: 0
                    }
                ],
                exports: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const success = commerceService.updatePartnerTrade('deserta', 'carrot', 'export');

        expect(success).toBe(true);
        expect(mockPartners[0].imports[0].currentOccurrences).toBe(1);
        expect(mockPartners[0].imports[0].currentYearly).toBe(1);
    });

    test('récupère les limites d\'un partenaire pour un produit', () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                imports: [
                    {
                        productId: 'carrot',
                        maxPerTurn: 8,
                        maxOccurrences: 9,
                        currentOccurrences: 2
                    }
                ],
                exports: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const limit = commerceService.getPartnerTradeLimit('deserta', 'carrot', 'export');

        expect(limit).toBeDefined();
        expect(limit.maxPerTurn).toBe(8);
        expect(limit.maxOccurrences).toBe(9);
        expect(limit.currentOccurrences).toBe(2);
    });

    test('traite un import depuis un partenaire', async () => {
        const mockPartners = [
            {
                id: 'deserta',
                name: 'Deserta',
                isActive: true,
                imports: [],
                exports: [
                    {
                        productId: 'dattes',
                        months: [0, 2],
                        maxOccurrences: 2,
                        currentOccurrences: 0
                    }
                ]
            }
        ];

        commerceService.partnersData = mockPartners;

        // Mock config
        const mockConfig = [
            {
                id: 'dattes',
                name: 'Dattes',
                buyingPrice: 12,
                buyingMax: 200,
                stockpiling: false
            }
        ];
        global.localStorage.setItem('commerce_config', JSON.stringify(mockConfig));

        await db.open();
        await db.houses.clear();
        const windmillId = createBuildingInstanceId();
        await db.houses.add(
            makeHouseRecord({
                type: 'Windmill-001',
                x: 1,
                y: 1,
                instanceId: windmillId,
                extra: {
                    isActive: true,
                    commercializeEnabled: true,
                    stocks: { wheat: 0, carrot: 0, cabbage: 0, dattes: 0, food: 0 },
                    lastImport: { wheat: 0, carrot: 0, cabbage: 0, dattes: 0, total: 0 },
                },
            })
        );

        const result = await commerceService.processProductImport({
            productId: 'dattes',
            time: 0,
            quantity: 1,
            partnerId: 'deserta',
        });

        expect(result).toBeDefined();
        expect(result.productId).toBe('dattes');
        expect(result.quantity).toBe(1);
        expect(result.totalCost).toBe(12);
    });
});
