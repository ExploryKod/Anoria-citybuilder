/**
 * Construction — placeBuildingWithPayment + findBuildingAtTile
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { resetConstructionContextForTests } from '../../../src/composition/createConstructionContext.js';
import { createConstructionContext } from '../../../src/composition/createConstructionContext.js';
import {
  findBuildingAtTile,
  placeBuildingWithPayment,
} from '../../../src/js/acl/construction.js';
import { initializeTreasury, resetAccountingContextForTests } from '../../../src/js/acl/accounting.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/acl/accountingSessionJournal.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

async function clearTables() {
  await db.open();
  await db.houses.clear();
  await db.budget.clear();
}

async function seedBudget(funds = null) {
  resetSessionLedgerBufferForTests();
  resetAccountingContextForTests();
  await initializeTreasury(funds);
}

describe('Construction — placement with payment (step 2)', () => {
  beforeEach(async () => {
    resetConstructionContextForTests();
    await clearTables();
    await seedBudget();
  });

  afterEach(async () => {
    resetConstructionContextForTests();
    await clearTables();
  });

  test('findBuildingAtTile returns building occupying tile', async () => {
    const record = makeHouseRecord({ type: 'House-Blue', x: 4, y: 5 });
    await db.houses.add(record);

    const atTile = await findBuildingAtTile({ x: 4, y: 5 });
    expect(atTile?.instanceId).toBe(record.instanceId);
    expect(atTile?.type).toBe('House-Blue');
  });

  test('placeBuildingWithPayment persists row and debits budget', async () => {
    const record = makeHouseRecord({
      type: 'Farm-Wheat',
      x: 2,
      y: 2,
      extra: { price: 50 },
    });

    const result = await placeBuildingWithPayment(record);
    expect(result.success).toBe(true);
    expect(result.instanceId).toBe(record.instanceId);

    const row = await db.houses.get(record.instanceId);
    expect(row?.type).toBe('Farm-Wheat');

    const budget = await db.budget.get('budget_current');
    // BudgetManager default initialFunds (config) minus construction price
    expect(budget.funds).toBe(150);
  });

  test('placeBuildingWithPayment rejects duplicate instanceId', async () => {
    const record = makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } });
    await db.houses.add(record);

    const result = await placeBuildingWithPayment({
      ...record,
      price: 10,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('duplicate');
  });

  test('refunds budget when insert fails after payment', async () => {
    const record = makeHouseRecord({ type: 'House-Red', x: 3, y: 3, extra: { price: 30 } });

    const failingRepo = {
      findAtTile: async () => null,
      findById: async () => null,
      addRecord: async () => ({
        success: false,
        reason: 'database_error',
        error: 'simulated failure',
      }),
    };

    resetConstructionContextForTests();
    const ctx = createConstructionContext({
      buildingRepository: failingRepo,
      recordExpense: async (amount) => {
        const budget = await db.budget.get('budget_current');
        budget.funds -= amount;
        await db.budget.put(budget);
        return { success: true, budget };
      },
      recordRefund: async (amount) => {
        const budget = await db.budget.get('budget_current');
        budget.funds += amount;
        await db.budget.put(budget);
        return { success: true, budget };
      },
    });

    const result = await ctx.placeBuildingWithPayment(record);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('database_error');

    const budget = await db.budget.get('budget_current');
    expect(budget.funds).toBe(200);
  });
});
