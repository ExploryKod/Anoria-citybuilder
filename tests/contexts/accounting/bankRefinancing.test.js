import { describe, test, expect, beforeEach } from '@jest/globals';
import { BankRefinancing } from '../../../src/contexts/accounting/application/services/BankRefinancing.js';
import { BankCompanyCredit } from '../../../src/contexts/accounting/application/services/BankCompanyCredit.js';
import { LiquidateDemolishedBuilding } from '../../../src/contexts/accounting/application/services/LiquidateDemolishedBuilding.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { balanceSheetOf } from '../../../src/contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { depositBalanceOf } from '../../../src/contexts/accounting/domain/policies/DepositBalancePolicy.js';
import { accountKeyOf } from '../../../src/contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { isCashAccount } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';
import { booked } from '../../helpers/booked.js';

// The central bank refinances the bank by creating money, and the bank repays it out of its surplus (BankRefinancing.js); the bank lends the companies short of cash
// (BankCompanyCredit.js); a bank that is liquidated repays its depositors, the city guaranteeing the rest (LiquidateDemolishedBuilding.js). Money is created and destroyed
// only by the central bank, and every balance sheet balances all along.
const HAMLET = 'h1';

// A month a turn, to keep the dates simple: turn 12 is January of year 1.
const timeOf = (turn) => ({ year: Math.floor(turn / 12), monthIndex: turn % 12, month: `mois ${turn % 12}` });

function world({ bankCash, centralBankWorks = true, policyRate = 0.12, reserveRatio = 0, withBank = true, capitalStatus = 'sound' }) {
  const journal = [];
  const fold = new LegsFold();
  const write = (line) => {
    const { year, monthIndex } = timeOf(line.turn ?? 0);
    const entry = booked({ hamletId: HAMLET, year, month: monthIndex + 1, ...line });
    journal.push(entry);
    fold.add(entry);
  };
  // The bank's opening cash: its capital (none at all is no line).
  if (bankCash > 0) write({ type: 'capital_funds', amount: bankCash, accountBuildingId: 'bank' });
  const cashOf = (buildingId, accountKind = null) => journal
    .filter((line) => accountKeyOf(line) === accountKeyOf({ accountBuildingId: buildingId, accountKind }))
    .flatMap((line) => line.legs)
    // A company's or a household's money (512), the city's (515, its account at its central bank).
    .filter((leg) => isCashAccount(leg.account))
    .reduce((sum, leg) => sum + leg.debit - leg.credit, 0) / 100;
  const recordLedgerEntry = async (line) => {
    write(line);
    return { recorded: true };
  };
  // This State's central bank works (it alone refinances this State's bank); the rates are the federation's.
  const status = async () => ({ available: centralBankWorks, refinancingAvailable: centralBankWorks, rate: policyRate, reserveRatio });
  const refinancing = new BankRefinancing({
    getTimeInfo: timeOf,
    findBankBuildingId: async () => (withBank ? 'bank' : null),
    findCentralBankId: async () => 'central',
    getPolicyRateStatus: status,
    getCapitalStatus: async () => ({ status: capitalStatus }),
    cashOf: async (buildingId) => cashOf(buildingId),
    getLegsFold: async () => fold,
    recordLedgerEntry,
  });
  const credit = new BankCompanyCredit({
    getTimeInfo: timeOf,
    findBankBuildingId: async () => 'bank',
    coverBankShortfall: (params) => refinancing.coverShortfall(params),
    getPolicyRateStatus: status,
    monthlyNeedOf: async () => 100, // a ceiling of 3 months: 300
    listCompanies: async () => [{ buildingId: 'farm', name: 'Ferme' }],
    cashOf: async (buildingId) => cashOf(buildingId),
    getLegsFold: async () => fold,
    recordLedgerEntry,
  });
  const sheetOf = (buildingId, currentYear = 0) => balanceSheetOf(journal, buildingId, { cash: cashOf(buildingId), stock: [], currentYear });
  return { refinancing, credit, write, cashOf, sheetOf, journal, fold, recordLedgerEntry };
}

describe('the central bank refinances the bank', () => {
  beforeEach(() => useHamletForTests(HAMLET));

  test('it lends exactly the shortfall, created for it, and refuses nothing it can cover; without a central bank at work, nothing is lent', async () => {
    const { refinancing, cashOf, sheetOf } = world({ bankCash: 100 });
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 60, depositsAdded: 0 })).toEqual({ covered: true, borrowed: 0 });
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 250, depositsAdded: 0 })).toEqual({ covered: true, borrowed: 150 });
    expect(cashOf('bank')).toBe(250);
    // The central bank holds no cash: it lent money it created (274 against 1678).
    expect(cashOf('central')).toBe(0);
    expect(sheetOf('bank').liabilities.loans).toBe(150);
    expect(sheetOf('central').assets.loansLent).toBe(150);
    expect(sheetOf('central').liabilities.issuedMoney).toBe(150);

    const idle = world({ bankCash: 100, centralBankWorks: false });
    expect(await idle.refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 250, depositsAdded: 0 })).toEqual({ covered: false, borrowed: 0, reason: 'no_central_bank' });
  });

  test('the central bank lends only against collateral: the bank\'s loans less the haircut, the marginal lending dearer than the main refinancing', async () => {
    const { refinancing, write, sheetOf } = world({ bankCash: 100, policyRate: 0.12 });
    // A loan of 1000 to lend with 100 of its own: at most 900 can be owed to the central bank for it (haircut of 10 %), so a loan of 1100 cannot be refinanced.
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 1100, depositsAdded: 0 })).toEqual({ covered: false, borrowed: 0, reason: 'collateral' });
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 1000, depositsAdded: 0 })).toEqual({ covered: true, borrowed: 900 });
    // The urgent borrowing is the marginal lending, on its own account, dearer by the corridor: 15 % when the policy rate is 12 %.
    expect(sheetOf('bank').liabilities.loans).toBe(900);
    write({ type: 'loan_capital_lent', amount: 1000, accountBuildingId: 'bank' });
    await refinancing.settleMonth({ time: 5 });
    expect(await refinancing.outstanding(5)).toBeCloseTo(900 + (900 * 0.15) / 12);
  });

  test('the supervisor freezes the lending of a bank thin on capital, whatever its reserves, but not its upkeep', async () => {
    const { refinancing } = world({ bankCash: 1000, capitalStatus: 'frozen' });
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 100, depositsAdded: 0 })).toEqual({ covered: false, borrowed: 0, reason: 'capital' });
    // No new lending is asked at the month's close: the reserve upkeep goes on.
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 0, depositsAdded: 0 })).toEqual({ covered: true, borrowed: 0 });
  });

  test('a loan to the State takes the reserves; a credit to a company creates its deposit and only raises the reserve due', async () => {
    const { refinancing, write } = world({ bankCash: 0, reserveRatio: 0.2 });
    // 500 put in savings: the bank holds 500 of reserves and must keep 100 of them.
    write({ type: 'deposit_received', amount: 500, accountBuildingId: 'bank', counterpartyBuildingId: 'house' });
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 450, depositsAdded: 0 })).toEqual({ covered: true, borrowed: 50 });
    // A credit of 450 to a company: no reserve leaves, the deposits are 1000, so 200 must be kept, and the bank holds 550.
    expect(await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 0, depositsAdded: 450 })).toEqual({ covered: true, borrowed: 0 });
  });

  test('the bank\'s money is its customers\' deposits and its reserves at the central bank: a payment between customers moves neither, one from the State moves both', async () => {
    const { refinancing, write, sheetOf } = world({ bankCash: 0 });
    // The State pays a household 300; the household pays a company 100.
    write({ type: 'salary', amount: 300 });
    write({ type: 'public_wage', amount: 300, accountBuildingId: 'house', accountKind: 'particulier' });
    write({ type: 'consumer_purchase', amount: 100, accountBuildingId: 'house', accountKind: 'particulier' });
    write({ type: 'producer_revenue', amount: 100, accountBuildingId: 'farm' });

    await refinancing.centraliseBank({ time: 1 });
    await refinancing.centraliseBank({ time: 1 });
    // The bank owes its customers their 300, and holds 300 at the central bank, which owes it as much: a second run writes nothing more.
    expect(sheetOf('bank').liabilities.sightDeposits).toBe(300);
    expect(sheetOf('bank').assets.reserves).toBe(300);
    expect(sheetOf('central').liabilities.reservesHeld).toBe(300);
  });

  test('each month the bank pays the interest, adds to its debt what it cannot pay, and repays out of its cash above the reserve', async () => {
    const { refinancing, write, cashOf, sheetOf } = world({ bankCash: 200, policyRate: 0.02 });
    await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 1200, depositsAdded: 0, facility: 'main' });
    // The bank lends it all to the city (1000 borrowed against a loan of 1200): no cash left for the interest of the month (1000 × 2 % / 12 = 1,67), which is added to the debt.
    write({ type: 'loan_capital_lent', amount: 1200, accountBuildingId: 'bank' });
    await refinancing.settleMonth({ time: 5 });
    expect(await refinancing.outstanding(5)).toBeCloseTo(1001.67);
    expect(sheetOf('central').assets.loansLent).toBeCloseTo(1001.67);

    // The city repays: the bank pays the interest of the month (1,67) in cash and repays its whole debt out of its cash (no depositors, so no reserve).
    write({ type: 'loan_repayment_received', amount: 1200, accountBuildingId: 'bank' });
    await refinancing.settleMonth({ time: 6 });
    expect(sheetOf('bank').assets.reserves).toBeCloseTo(196.66);
    expect(await refinancing.outstanding(6)).toBeCloseTo(0);
    // What the bank paid back, its interest included, is money that came back to the central bank: none of what it created is still out. The central bank holds
    // no money of its own; what it earned is the interest of the two months, its result.
    expect(sheetOf('central').liabilities.issuedMoney).toBeCloseTo(0);
    expect(cashOf('central')).toBe(0);
    expect(sheetOf('central').assets.loansLent).toBeCloseTo(0);
    expect(sheetOf('central').liabilities.equity).toBeCloseTo(3.34);
  });

  test('every January the central bank pays its State what it earned, on the Treasury\'s account, once', async () => {
    const { refinancing, write, cashOf, sheetOf, journal } = world({ bankCash: 200, policyRate: 0.02 });
    await refinancing.coverShortfall({ turn: 1, bankId: 'bank', reservesOut: 1200, depositsAdded: 0, facility: 'main' });
    write({ turn: 1, type: 'loan_capital_lent', amount: 1200, accountBuildingId: 'bank' });
    await refinancing.settleMonth({ time: 5 }); // 1,67 of interest, added to the debt
    write({ turn: 5, type: 'loan_repayment_received', amount: 1200, accountBuildingId: 'bank' });
    await refinancing.settleMonth({ time: 6 }); // 1,67 paid

    // January of year 1: all it earned (3,34) goes to its State, credited to the Treasury's account it holds. A second run pays nothing more.
    await refinancing.settleMonth({ time: 12 });
    await refinancing.settleMonth({ time: 12 });
    const toState = journal.filter((line) => line.type === 'central_bank_profit_received');
    expect(toState).toHaveLength(1);
    expect(toState[0].accountBuildingId).toBeNull();
    expect(toState[0].amount).toBeCloseTo(3.34);
    expect(cashOf(null)).toBeCloseTo(3.34);
    expect(sheetOf('central', 1).liabilities.treasuryAccount).toBeCloseTo(3.34);
    expect(sheetOf('central', 1).liabilities.distributions).toBeCloseTo(-3.34);
  });

  test('the Treasury\'s account at the central bank is the State\'s money, its founding endowment created once', async () => {
    const { refinancing, write, cashOf, sheetOf, journal } = world({ bankCash: 0 });
    // The State is founded with 2000, collects 300 of tax and pays 100 of wages in its first month.
    write({ turn: 0, type: 'capital_funds', amount: 2000 });
    write({ turn: 0, type: 'citizen_tax', amount: 300 });
    write({ turn: 0, type: 'salary', amount: 100 });
    expect(cashOf(null)).toBe(2200);

    await refinancing.centraliseTreasury({ time: 1 });
    await refinancing.centraliseTreasury({ time: 1 });
    const central = sheetOf('central');
    expect(central.liabilities.treasuryAccount).toBe(2200);
    expect(central.assets.stateEndowment).toBe(2000);
    // A second run writes nothing: the centralisation is read from the balances.
    expect(journal.filter((line) => line.type.startsWith('od_treasury_'))).toHaveLength(2);
  });

  test('money from abroad is converted by the central bank, against its foreign reserves; without a bank, the public holds it in banknotes', async () => {
    for (const withBank of [false, true]) {
      const { refinancing, write, sheetOf } = world({ bankCash: 0, withBank, policyRate: 0.02 });
      // The State pays a household 300, then a farm sells 100 abroad.
      write({ type: 'salary', amount: 300 });
      write({ type: 'public_wage', amount: 300, accountBuildingId: 'house', accountKind: 'particulier' });
      write({ type: 'abroad_sale_bread', amount: 100, accountBuildingId: 'farm' });
      await refinancing.settleMonth({ time: 1 });
      await refinancing.settleMonth({ time: 1 });

      const central = sheetOf('central');
      // Only the 100 sold abroad is foreign money; the rest is the State's, paid out of its account.
      expect(central.assets.foreignReserves).toBe(100);
      // Without a bank, the public's 400 are banknotes; with one, they are its deposits, backed by its reserves at the central bank.
      expect(central.liabilities.issuedMoney).toBe(withBank ? 0 : 400);
      expect(central.liabilities.reservesHeld).toBe(withBank ? 400 : 0);
    }
  });
});

describe('the bank lends the companies short of cash', () => {
  beforeEach(() => useHamletForTests(HAMLET));

  test('it lends the shortfall up to the ceiling the credit rate leaves, and the company pays the interest and repays out of its month\'s profit', async () => {
    const { credit, write, cashOf, sheetOf } = world({ bankCash: 1000 });
    // 500 short, a ceiling of 300; at 20 % a year the farm takes 60 % of it, 180. The rest of the month becomes debts, as before.
    expect(await credit.lend({ time: 1, companyId: 'farm', shortfall: 50000 })).toBe(18000);
    expect(cashOf('farm')).toBe(180);
    expect(await credit.outstanding('farm', 1)).toBe(180);
    // The bank does not lend to itself.
    expect(await credit.lend({ time: 1, companyId: 'bank', shortfall: 100 })).toBe(0);

    // Next month the farm sells 100: it pays 20 % a year on 180 (3), then repays out of its profit of the month (100 − 3).
    write({ turn: 2, type: 'producer_revenue', amount: 100, accountBuildingId: 'farm' });
    await credit.settleMonth({ time: 2 });
    expect(await credit.outstanding('farm', 2)).toBeCloseTo(83);
    expect(cashOf('bank')).toBeCloseTo(1000 - 180 + 3 + 97);
    // Both books balance: the farm's credit is its borrowing, the bank's its loan.
    expect(sheetOf('farm').liabilities.loans).toBeCloseTo(83);
    expect(sheetOf('bank').assets.loansLent).toBeCloseTo(83);
  });

  test('the dearer the credit, the less a company borrows; at the rate no company accepts, nothing', async () => {
    const dear = world({ bankCash: 1000, policyRate: 0.42 }); // credit at 50 %
    expect(await dear.credit.lend({ time: 1, companyId: 'farm', shortfall: 50000 })).toBe(0);
    const free = world({ bankCash: 1000, policyRate: 0 }); // credit at 8 %: 84 % of 300
    expect(await free.credit.lend({ time: 1, companyId: 'farm', shortfall: 50000 })).toBe(25200);
  });
});

describe('a liquidated bank repays its depositors, and the city guarantees what it cannot', () => {
  beforeEach(() => useHamletForTests(HAMLET));

  test('its savings are repaid as far as its cash goes, the rest guaranteed, the refinancing it cannot repay lost by the central bank', async () => {
    const { refinancing, write, cashOf, sheetOf, journal, fold, recordLedgerEntry } = world({ bankCash: 0 });
    // The State pays a house 400, which it puts in savings; the bank loses 250 on its charges, and is refinanced 200 (to lend the State 350). It holds 350 of reserves,
    // owes the house 400 and the central bank 200: insolvent by 250.
    write({ type: 'salary', amount: 400 });
    write({ type: 'public_wage', amount: 400, accountBuildingId: 'house', accountKind: 'particulier' });
    write({ type: 'deposit', amount: 400, accountBuildingId: 'house', accountKind: 'particulier', counterpartyBuildingId: 'bank' });
    write({ type: 'deposit_received', amount: 400, accountBuildingId: 'bank', counterpartyBuildingId: 'house' });
    write({ type: 'maintenance', amount: 250, accountBuildingId: 'bank' });
    await refinancing.coverShortfall({ turn: 0, bankId: 'bank', reservesOut: 350, depositsAdded: 0 });
    expect(sheetOf('bank').liabilities.equity).toBe(-250);

    const liquidator = new LiquidateDemolishedBuilding({
      getJournalEntries: async () => journal,
      recordLedgerEntry,
      inJournalBatch: async (work) => work(),
      getTimeInfo: timeOf,
      listBuildings: async () => [{ id: 'bank', type: 'Bank' }, { id: 'house', type: 'House-Blue' }, { id: 'central', type: 'CentralBank' }],
      getAccountsOf: async (id) => (id === 'bank' ? [{ accountKind: null, stockNature: null }] : null),
      cashOf: async (id, accountKind) => cashOf(id, accountKind),
      valueStock: async () => [],
      getOwner: async () => null,
      getLegsFold: async () => fold,
      findBankBuildingId: async () => 'bank',
      findCentralBankId: async () => 'central',
      bankBooks: {
        liveReservesOf: (bankId, turn) => refinancing.liveReservesOf(bankId, turn),
        centraliseBankBooks: (params) => refinancing.centraliseBankBooks(params),
      },
    });
    // The bank holds 350, owes the house 400 and the central bank 200: the house gets 350 back and the city guarantees 50; the central bank loses its 200.
    const preview = await liquidator.preview({ buildingId: 'bank', turn: 1 });
    expect(preview.accounts[0]).toMatchObject({ depositsRepaid: 350, depositsGuaranteed: 50, refinancingLost: 200 });

    await liquidator.execute({ buildingId: 'bank', turn: 1 });
    // The house has all its savings back in its cash, 350 from the bank and 50 from the city; its claim on the bank is closed.
    expect(cashOf('house', 'particulier')).toBe(400);
    expect(depositBalanceOf(journal, 'house', 'bank')).toBe(0);
    expect(cashOf(null)).toBe(-400 - 50);
    // The bank's books are closed: no cash, no reserves, nothing owed to its customers or anyone; the central bank holds no reserves for it, lost its claim, and the
    // money it created stays issued.
    expect(cashOf('bank')).toBe(0);
    expect(sheetOf('bank').assets.reserves).toBe(0);
    expect(sheetOf('bank').liabilities.deposits).toBe(0);
    expect(sheetOf('bank').liabilities.sightDeposits).toBe(0);
    expect(sheetOf('bank').liabilities.loans).toBe(0);
    expect(sheetOf('central').assets.loansLent).toBe(0);
    expect(sheetOf('central').liabilities.reservesHeld).toBe(0);
    expect(sheetOf('central').liabilities.issuedMoney).toBe(200);
  });
});

describe('the gift of a partner city is money from abroad', () => {
  beforeEach(() => useHamletForTests(HAMLET));

  test('the central bank converts it against its foreign reserves, with or without a bank; it is not a founding endowment', async () => {
    for (const withBank of [false, true]) {
      const { refinancing, write, sheetOf, cashOf } = world({ bankCash: 0, withBank, policyRate: 0.02 });
      write({ turn: 0, type: 'capital_funds', amount: 2000 });
      await refinancing.settleMonth({ time: 1 });
      write({ turn: 2, type: 'benefactor_gift', amount: 2000, accountBuildingId: null });
      await refinancing.settleMonth({ time: 2 });
      await refinancing.settleMonth({ time: 2 });
      const central = sheetOf('central');
      // The 2000 of the founding treasure is the endowment the central bank created; the gift's 2000 came from another State.
      expect(central.assets.stateEndowment).toBe(2000);
      expect(central.assets.foreignReserves).toBe(2000);
      expect(central.liabilities.treasuryAccount).toBe(cashOf(null));
    }
  });
});
