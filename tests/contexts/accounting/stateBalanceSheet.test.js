import { describe, test, expect } from '@jest/globals';
import { stateBalanceSheetOf } from '../../../src/contexts/accounting/domain/policies/StateBalanceSheetPolicy.js';
import { businessAccountOf } from '../../../src/contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { sharesHeldIn } from '../../../src/contexts/accounting/domain/policies/CompanyAidLedgerPolicy.js';

const totals = (rows) => new Map(Object.entries(rows).map(([account, [debit, credit]]) => [account, { debit, credit }]));

describe('the balance sheet of the State', () => {
  test('what it holds against what it owes and its result; the two sides agree', () => {
    // A treasury of 300, a building worth 200 and a holding of 100, against a loan of 400 and a gain of 200 (taxes 500 less 300 of charges).
    const sheet = stateBalanceSheetOf(totals({ 515: [30000, 0], 2131: [20000, 0], 261: [10000, 0], 1641: [0, 40000], 7311: [0, 50000], 6411: [30000, 0] }), (account) => account);
    expect(sheet.assets.total).toBe(600);
    expect(sheet.liabilities.total).toBe(600);
    expect(sheet.result).toBe(200);
  });

  test('an écriture that does not balance is a defect, never plugged', () => {
    expect(() => stateBalanceSheetOf(totals({ 515: [100, 0] }), (account) => account)).toThrow(/does not balance/);
  });
});

describe('who holds the shares of a company', () => {
  test('the city holds what it bought less what it sold; the buyer holds what it bought', () => {
    const kind = businessAccountOf('rental');
    const entries = [
      { type: 'shareholder_capital_received', accountBuildingId: 'farm', counterpartyBuildingId: null, amount: 100, shares: 10, year: 0, month: 1 },
      { type: 'stake_sold', accountBuildingId: null, counterpartyBuildingId: 'farm', amount: 30, shares: 3 },
      { type: 'stake_bought', accountBuildingId: 'mayor', accountKind: kind, counterpartyBuildingId: 'farm', amount: 30, shares: 3 },
    ];
    const held = sharesHeldIn(entries, 'farm');
    expect(held.city).toBe(7);
    expect(held.privateHolders).toEqual([{ holderId: 'mayor', accountKind: kind, shares: 3, capital: 3000 }]);
  });
});

describe('the balance sheet of the starter city', () => {
  test('the State of the prefab has one, and its two sides agree', async () => {
    const { loadPrefab } = await import('../../../src/shared/prefabs/prefabCatalog.js');
    const { LegsFold } = await import('../../../src/contexts/accounting/domain/policies/LegsFold.js');
    const { useHamletForTests } = await import('../../../src/core/persistence/hamlet/hamletSession.js');
    const prefab = await loadPrefab('anoria-tour-107');
    useHamletForTests(prefab.hamletId);
    const fold = new LegsFold();
    for (const line of prefab.journal) fold.add(line);
    const sheet = stateBalanceSheetOf(fold.totalsByAccount({ hamletId: prefab.hamletId }).get(null), (account) => account);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
  });
});
