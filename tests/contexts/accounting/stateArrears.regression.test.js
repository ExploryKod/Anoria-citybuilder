import { describe, test, expect, beforeEach } from '@jest/globals';
import { SettleStateArrears } from '../../../src/contexts/accounting/application/services/SettleStateArrears.js';
import { stateArrearsOf } from '../../../src/contexts/accounting/domain/policies/StateArrearsPolicy.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';

// What the State owes and could not pay becomes arrears (StateArrearsCatalog.js): paid later, the households first, as far as its Treasury holds the money; owed to a
// building that is gone, abandoned. The debt is derived from the journal's lines.
const timeOf = (turn) => ({ year: Math.floor(turn / 12), monthIndex: turn % 12, month: `mois ${turn % 12}` });
const owed = (type, creditor, amount) => ({ type, amount, accountBuildingId: null, counterpartyBuildingId: creditor, description: type });

describe('the State pays its arrears when its Treasury allows, the households first', () => {
  beforeEach(() => useHamletForTests('h1'));

  test('a short Treasury pays the households before the services; the rest stays owed; a creditor that is gone is released', async () => {
    const journal = [
      owed('od_state_arrears_salary', 'house1', 100),
      owed('od_state_arrears_service_subsidy', 'farm1', 80),
      owed('od_state_arrears_unemployment_benefit', 'gone', 30),
    ];
    const written = [];
    const settle = (cash) => new SettleStateArrears({
      getTimeInfo: timeOf,
      getJournalEntries: async () => journal,
      stateCash: async () => cash,
      listBuildings: async () => [{ id: 'house1', type: 'House-Blue' }, { id: 'farm1', type: 'Farm-Wheat' }],
      getBuildingDisplayName: (type) => type,
      recordLedgerEntry: async (line) => {
        written.push(line);
        journal.push({ ...line, accountBuildingId: line.accountBuildingId ?? null, counterpartyBuildingId: line.counterpartyBuildingId ?? null });
        return { recorded: true };
      },
    });

    // 120 € in the Treasury: the house is paid in full (100), the service gets what is left (20 of 80); the gone creditor's 30 is abandoned.
    await settle(12000).execute({ time: 5 });
    const paid = (type) => written.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0);
    expect(paid('state_arrears_paid_salary')).toBe(100);
    expect(paid('state_arrears_paid_service_subsidy')).toBe(20);
    expect(written.some((line) => line.type === 'od_state_arrears_abandoned_unemployment_benefit' && line.amount === 30)).toBe(true);
    // The one paid is credited with its usual receipt.
    expect(paid('public_wage')).toBe(100);
    expect(stateArrearsOf(journal)).toEqual([expect.objectContaining({ kind: 'service_subsidy', creditorId: 'farm1', centimes: 6000 })]);

    // Next month the Treasury holds enough: the service is paid the rest; nothing is owed any more.
    await settle(50000).execute({ time: 6 });
    expect(paid('state_arrears_paid_service_subsidy')).toBe(80);
    expect(stateArrearsOf(journal)).toEqual([]);
  });
});
