/**
 * Tests pour CommerceService avec les partenaires commerciaux
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { createCommerceContext } from '../src/composition/createCommerceContext.js';
import { BudgetManager } from './helpers/testBudgetFacade.js';
import { JournalManager } from '../src/composition/accountingSessionJournal.js';
import {
  createDefaultPartners,
  normalizePartners,
} from '../src/composition/commerceOps.js';
import db from '../src/core/persistence/dexie/db.js';
import { resetSupplyContextForTests } from '../src/composition/createSupplyContext.js';
import { resetCommerceContextForTests } from '../src/composition/createCommerceContext.js';
import { resetAccountingContextForTests } from '../src/composition/accountingOps.js';
import { resetSessionLedgerBufferForTests } from '../src/composition/accountingSessionJournal.js';
import appRegistry from '../src/composition/AppRegistry.js';
import { TimeManager } from '../src/shared/time/TimeManager.js';

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

describe('CommerceService - Partenaires', () => {
    let commerceService;
    let testDb;
    let budgetManager;

    beforeEach(async () => {
        resetSessionLedgerBufferForTests();
        resetAccountingContextForTests();
        resetCommerceContextForTests();
        testDb = createTestDb();
        await testDb.open();

        global.localStorage.clear();

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

        budgetManager = new BudgetManager();
        budgetManager.db = testDb;

        const journalManager = new JournalManager();
        journalManager.db = testDb;
        budgetManager.journalManager = journalManager;
        budgetManager.wireAccountingContext();

        commerceService = createCommerceContext().simulation;

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

    test('seed MVP contient olivea et silvania', () => {
        const partners = createDefaultPartners();
        expect(partners).toHaveLength(2);
        expect(partners.map((p) => p.id).sort()).toEqual(['olivea', 'silvania']);
    });

    test('normalizePartners remplace un catalogue non-MVP', () => {
        const stale = [
            { id: 'deserta', name: 'Deserta', buysFromUs: [], sellsToUs: [] },
            { id: 'tropicala', name: 'Tropicala', buysFromUs: [], sellsToUs: [] },
        ];
        const { partners, needsSave } = normalizePartners(stale);
        expect(needsSave).toBe(true);
        expect(partners).toHaveLength(2);
        expect(partners[0].id).toBe('olivea');
    });

    test('charge les partenaires depuis le store', () => {
        const mockPartners = [
            { id: 'olivea', name: 'Olivea', buysFromUs: [], sellsToUs: [] },
            { id: 'silvania', name: 'Silvania', buysFromUs: [], sellsToUs: [] },
        ];

        global.localStorage.setItem('commerce_partners', JSON.stringify(mockPartners));

        const partners = commerceService.loadPartners();

        expect(partners).toBeDefined();
        expect(partners).toHaveLength(2);
        expect(partners[0].id).toBe('olivea');
    });

    test('récupère un partenaire par son ID', () => {
        const mockPartners = createDefaultPartners();
        commerceService.partnersData = mockPartners;

        const partner = commerceService.getPartner('silvania');

        expect(partner).toBeDefined();
        expect(partner.name).toBe('Silvania');
    });

    test('vérifie si on peut trader avec un partenaire (mois correct)', () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                isActive: true,
                buysFromUs: [
                    {
                        productId: 'wood',
                        months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                        yearlyQuota: 25,
                        currentYearly: 0
                    }
                ],
                sellsToUs: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const canTrade = commerceService.canTradeWithPartner('olivea', 'wood', 'export', 7);

        expect(canTrade).toBe(true);
    });

    test('refuse le trade avec un partenaire (mois incorrect pour figues)', () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                isActive: true,
                buysFromUs: [],
                sellsToUs: [
                    {
                        productId: 'figs',
                        months: [6, 7, 8, 9, 10],
                        yearlyQuota: 10,
                        currentYearly: 0
                    }
                ]
            }
        ];

        commerceService.partnersData = mockPartners;

        const canTrade = commerceService.canTradeWithPartner('olivea', 'figs', 'import', 0);

        expect(canTrade).toBe(false);
    });

    test('refuse le trade avec un partenaire (limite atteinte)', () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                isActive: true,
                buysFromUs: [
                    {
                        productId: 'wood',
                        months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                        yearlyQuota: 25,
                        currentYearly: 25
                    }
                ],
                sellsToUs: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const canTrade = commerceService.canTradeWithPartner('olivea', 'wood', 'export', 7);

        expect(canTrade).toBe(false);
    });

    test('met à jour le compteur annuel après un trade', () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                buysFromUs: [
                    {
                        productId: 'wood',
                        yearlyQuota: 25,
                        currentYearly: 0
                    }
                ],
                sellsToUs: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const success = commerceService.updatePartnerTrade('olivea', 'wood', 'export');

        expect(success).toBe(true);
        expect(mockPartners[0].buysFromUs[0].currentYearly).toBe(1);
    });

    test('récupère les limites d\'un partenaire pour un produit', () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                buysFromUs: [
                    {
                        productId: 'wood',
                        maxPerTurn: 1,
                        yearlyQuota: 25,
                        currentYearly: 2
                    }
                ],
                sellsToUs: []
            }
        ];

        commerceService.partnersData = mockPartners;

        const limit = commerceService.getPartnerTradeLimit('olivea', 'wood', 'export');

        expect(limit).toBeDefined();
        expect(limit.maxPerTurn).toBe(1);
        expect(limit.yearlyQuota).toBe(25);
        expect(limit.currentYearly).toBe(2);
    });

    test('traite un import depuis un partenaire', async () => {
        const mockPartners = [
            {
                id: 'olivea',
                name: 'Olivea',
                isActive: true,
                buysFromUs: [],
                sellsToUs: [
                    {
                        productId: 'figs',
                        months: [6, 7, 8, 9, 10],
                        yearlyQuota: 10,
                        currentYearly: 0,
                        pricePerUnit: 14,
                    }
                ]
            }
        ];

        commerceService.partnersData = mockPartners;

        const mockConfig = [
            {
                id: 'figs',
                name: 'Figues',
                buyingMax: 10,
            }
        ];
        global.localStorage.setItem('commerce_config', JSON.stringify(mockConfig));

        await db.open();
        await db.houses.clear();

        const result = await commerceService.processProductImport({
            productId: 'figs',
            time: 6,
            quantity: 1,
            partnerId: 'olivea',
        });

        expect(result).toBeDefined();
        expect(result.productId).toBe('figs');
        expect(result.quantity).toBe(1);
        expect(result.totalCost).toBe(14);
    });
});
