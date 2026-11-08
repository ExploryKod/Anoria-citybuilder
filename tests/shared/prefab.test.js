/**
 * Regression guard for the prefab "anoria-tour-107": its exported buildings keep their positions, and its journal is the
 * whole journal of the hamlet (the city's own account and the flux of the companies and the houses, two exports).
 */

import { describe, test, expect } from '@jest/globals';
import { loadPrefab } from '../../src/shared/prefabs/prefabCatalog.js';
import { canonicalizeHouseRecord } from '../../src/shared/building-identity/index.js';
import { createCitizen } from '../../src/shared/citizens/Citizen.js';
import { BankRefinancing } from '../../src/contexts/accounting/application/services/BankRefinancing.js';
import { LegsFold } from '../../src/contexts/accounting/domain/policies/LegsFold.js';
import { balanceSheetOf } from '../../src/contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { centralBankAccountOf } from '../../src/contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { CASH_ACCOUNTS } from '../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';
import { useHamletForTests } from '../../src/core/persistence/hamlet/hamletSession.js';
import { booked } from '../helpers/booked.js';

const prefab = await loadPrefab('anoria-tour-107');

describe('prefab anoria-tour-107 — its state is the saved one', () => {
  test('every exported building keeps the anchor it was saved at, in its hamlet', () => {
    for (const building of prefab.city.buildings) {
      const record = canonicalizeHouseRecord(building);
      expect(record.anchorX).toBe(building.x);
      expect(record.anchorY).toBe(building.y);
      expect(record.hamletId).toBe(prefab.hamletId);
    }
  });

  test('its citizens are whole citizens of its hamlet, each living in a house of the city; a house carries no count of residents', () => {
    const citizens = prefab.city.citizens.map((row) => createCitizen(row));
    const houseIds = new Set(prefab.city.buildings.filter((building) => building.kind === 'house').map((house) => house.instanceId));
    for (const citizen of citizens) expect(houseIds.has(citizen.houseId)).toBe(true);
    for (const building of prefab.city.buildings) expect(building).not.toHaveProperty('pop');
    expect(new Set(citizens.map((citizen) => citizen.id)).size).toBe(citizens.length);
    for (const citizen of citizens) expect(citizen.hamletId).toBe(prefab.hamletId);
  });

  test('its journal joins the two exports without losing or repeating a line, all in its hamlet', () => {
    const ids = prefab.journal.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of prefab.journal) expect(line.hamletId).toBe(prefab.hamletId);
  });
});

// The State's money is its account at its central bank (515), the customers' their bank account (512): the city's lines of the prefab were written on 512 and are moved
// in its JSON (PLAN_BANK_MONEY.md). Its first month's close then centralises the Treasury's account, the bank and the foreign money from the balances it holds; if one of
// them threw, the month's settlement of the starter city would freeze.
describe('prefab anoria-tour-107 — its money centralises at the first month\'s close', () => {
  const FIRST_CLOSE = { year: 1, monthIndex: 10, month: 'Novembre' };

  function closeFirstMonth() {
    useHamletForTests(prefab.hamletId);
    const journal = [...prefab.journal];
    const fold = new LegsFold();
    for (const line of journal) fold.add(line);
    const bank = prefab.city.buildings.find((building) => building.type === 'Bank');
    const centralBankId = centralBankAccountOf(prefab.hamletId);
    const refinancing = new BankRefinancing({
      getTimeInfo: () => FIRST_CLOSE,
      findBankBuildingId: async () => bank.instanceId,
      findCentralBankId: async () => centralBankId,
      getPolicyRateStatus: async () => ({ available: true, refinancingAvailable: true, rate: 0.14, reserveRatio: 0.2 }),
      getCapitalStatus: async () => ({ status: 'sound' }),
      getLegsFold: async () => fold,
      recordLedgerEntry: async (line) => {
        // Like the real command: a business key already written is refused, which makes a month's close idempotent.
        if (line.businessKey && journal.some((written) => written.businessKey === line.businessKey)) return { recorded: false, reason: 'duplicate_business_key' };
        const entry = booked({ hamletId: prefab.hamletId, year: FIRST_CLOSE.year, month: FIRST_CLOSE.monthIndex + 1, ...line });
        journal.push(entry);
        fold.add(entry);
        return { recorded: true };
      },
    });
    const cashOf = (accountKey) => [...CASH_ACCOUNTS].reduce((sum, account) => sum + fold.balanceOf(account, { hamletId: prefab.hamletId, accountKey }), 0) / 100;
    const stateCash = () => cashOf(null);
    // After the close, the bank's own cash is on its reserves and the central bank holds none: the cash a sheet is given is what the account holds then.
    const sheetOf = (buildingId) => balanceSheetOf(journal, buildingId, { cash: cashOf(buildingId), stock: [], currentYear: FIRST_CLOSE.year });
    return { refinancing, journal, stateCash, sheetOf, cashOf, bankId: bank.instanceId, centralBankId };
  }

  test('the city\'s money is on its account at the central bank, none of it on a bank account', () => {
    const cityLines = prefab.journal.filter((line) => !line.accountBuildingId);
    expect(cityLines.length).toBeGreaterThan(0);
    for (const line of cityLines) expect(line.legs.some((leg) => leg.account === '512')).toBe(false);
  });

  // A State may not spend more than its Treasury holds, so the starter city, which spent 9 418 € more than its 2000 € of capital by turn 30, starts from a gift that covers it.
  test('the city never spent more than its Treasury held, and its bank starts solvent', () => {
    const fold = new LegsFold();
    let lowest = 0;
    for (const line of [...prefab.journal].sort((a, b) => a.id - b.id)) {
      fold.add(line);
      const held = [...CASH_ACCOUNTS].reduce((sum, account) => sum + fold.balanceOf(account, { hamletId: prefab.hamletId, accountKey: null }), 0);
      lowest = Math.min(lowest, held);
    }
    expect(lowest).toBeGreaterThanOrEqual(0);

    const bankRow = prefab.city.buildings.find((building) => building.type === 'Bank');
    const bankCash = [...CASH_ACCOUNTS].reduce((sum, account) => sum + fold.balanceOf(account, { hamletId: prefab.hamletId, accountKey: bankRow.instanceId }), 0) / 100;
    const bank = balanceSheetOf(prefab.journal, bankRow.instanceId, { cash: bankCash, stock: [], currentYear: 1 });
    expect(bank.liabilities.equity).toBeGreaterThanOrEqual(0);
  });

  test('the first close settles, brings the Treasury\'s account level with the State\'s money, and writes nothing the second time', async () => {
    const { refinancing, journal, stateCash, sheetOf, cashOf, bankId, centralBankId } = closeFirstMonth();
    const bankOwnCash = cashOf(bankId);
    await refinancing.settleMonth({ time: 110 });
    const written = journal.length;

    // Every balance sheet the close touched balances (a gap throws), and the Treasury's account is the State's money.
    const central = sheetOf(centralBankId);
    const bank = sheetOf(bankId);
    expect(central.liabilities.treasuryAccount).toBeCloseTo(stateCash());
    // The State's founding endowment is the 16 000 € gift of the benefactor city the starter city started with, created once.
    expect(central.assets.stateEndowment).toBe(16000);
    // With a bank the public holds deposits, not banknotes: the central bank issued none outside the bank, and holds as many reserves for the bank as the bank holds there.
    expect(central.liabilities.issuedMoney).toBeCloseTo(0);
    expect(central.liabilities.reservesHeld).toBeCloseTo(bank.assets.reserves);
    // The bank's reserves are its customers' money (its sight deposits), its own cash, and what the central bank paid it on the reserves above the reserve due.
    const reservesInterest = journal.filter((line) => line.type === 'od_reserves_interest_received').reduce((sum, line) => sum + line.amount, 0);
    expect(bank.assets.reserves).toBeCloseTo(bank.liabilities.sightDeposits + bankOwnCash + reservesInterest);

    await refinancing.settleMonth({ time: 110 });
    expect(journal.length).toBe(written);
  });
});
