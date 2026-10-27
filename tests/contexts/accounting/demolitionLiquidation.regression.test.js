import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { LiquidateDemolishedBuilding } from '../../../src/contexts/accounting/application/services/LiquidateDemolishedBuilding.js';
import { BulldozeBuildingAtTile } from '../../../src/contexts/construction/application/services/BulldozeBuildingAtTile.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { payablesOf } from '../../../src/contexts/accounting/domain/policies/DebtPolicy.js';
import { assertBalanced, entryLegsOf } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';

// The month of a farm whose workers live in `house`. `buildings` is what stands that month; `pairs`, `serviceFlows` and `spoilage` are what the supply says moved in the month.
function settleMonth(journal, { monthIndex, cash, buildings, pairs = [], serviceFlows = [], spoilage = [] }) {
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex, month: `Mois ${monthIndex}` }),
    listBuildings: async () => buildings,
    sumGoodsFlowsByPair: async () => pairs,
    sumServiceFlows: async () => serviceFlows,
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    companyFundsOf: async () => cash,
    getJournalEntries: async () => journal,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0.1, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    getCorporateTaxRate: async () => 0,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => spoilage,
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 10,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: monthIndex + 1 });
      return { recorded: true };
    },
  });
  return service.execute({ time: monthIndex, deliveredTime: monthIndex - 1 });
}

/**
 * The liquidation over an in-memory journal. `farm` is a company (a production stock), `house` a house with no business; `cash` is what the farm holds.
 * @param {Array<object>} journal
 * @param {{ cash?: number, stock?: number, standing?: string[] }} [facts] `stock`: what the farm's stock is worth now, in euros
 */
function liquidatorOf(journal, { cash = 0, stock = 0, standing = ['farm', 'house'] } = {}) {
  const accounts = { farm: [{ accountKind: null, stockNature: 'production' }], house: [] };
  const types = { farm: FARM, house: HOUSE };
  return new LiquidateDemolishedBuilding({
    getJournalEntries: async () => journal,
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: 5 });
      return { recorded: true };
    },
    inJournalBatch: async (work) => work(),
    getTimeInfo: () => ({ year: 1, monthIndex: 4, month: 'Mois 4' }),
    listBuildings: async () => standing.map((id) => ({ id, type: types[id] })),
    getAccountsOf: async (id) => accounts[id] ?? null,
    cashOf: async () => cash,
    valueStock: async () => [{ value: stock }],
    getOwner: async () => null,
  });
}

const amountOf = (journal, type) => journal.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0);
const balanced = (journal) => journal.filter((line) => line.legs === undefined && line.type !== undefined)
  .every((line) => { try { assertBalanced(entryLegsOf({ type: line.type, amount: line.amount, accountBuildingId: line.accountBuildingId ?? null, legs: null }).legs, line.type); return true; } catch { return false; } });
const farmDebtsOf = (journal) => [...payablesOf(journal).values()].filter((debt) => debt.debtorId === 'farm');

// The farm cannot pay its month: it owes its workers' house 400 of wages and the city 40 of contributions.
async function farmInDifficulty({ capital = 0, stockPosted = 0 } = {}) {
  const journal = [];
  await settleMonth(journal, { monthIndex: 3, cash: 0, buildings: [{ id: 'farm', type: FARM, workerSources: { house: 4 } }, { id: 'house', type: HOUSE, workerSources: {} }] });
  if (capital > 0) journal.push({ turn: 0, type: 'company_capital_received', amount: capital, accountBuildingId: 'farm', accountKind: null, counterpartyBuildingId: null, year: 0, month: 1 });
  if (stockPosted > 0) journal.push({ turn: 3, type: 'od_stock_up_production', amount: stockPosted, accountBuildingId: 'farm', accountKind: null, counterpartyBuildingId: null, year: 1, month: 4 });
  return journal;
}

describe('a demolished building leaves no debt that can never be paid', () => {
  test('the wages a company owed a house the player then demolished are abandoned, and the next month still settles', async () => {
    const journal = await farmInDifficulty();
    expect([...payablesOf(journal).values()].some((debt) => debt.kind === 'wage' && debt.creditorId === 'house')).toBe(true);

    // Before the demolition the player is told what it will do.
    const liquidator = liquidatorOf(journal);
    const preview = await liquidator.preview({ buildingId: 'house', turn: 4 });
    expect(preview.abandoned).toEqual([{ debtorId: 'farm', kind: 'wage', label: 'Salaires', amount: 400 }]);

    // The house is demolished: the debt owed to it is abandoned by an opération diverse that balances, exactly as announced.
    const { abandoned } = await liquidator.execute({ buildingId: 'house', turn: 4 });
    expect(abandoned).toEqual([{ debtorId: 'farm', kind: 'wage', amount: 400 }]);
    expect(abandoned.map((debt) => debt.amount)).toEqual(preview.abandoned.map((debt) => debt.amount));
    expect(amountOf(journal, 'od_abandoned_wage')).toBe(400);
    expect(balanced(journal)).toBe(true);
    expect([...payablesOf(journal).values()].some((debt) => debt.creditorId === 'house')).toBe(false);

    // The farm, with money now, settles its month: it used to try to pay the missing house by name, and the whole month failed, every month.
    await expect(settleMonth(journal, { monthIndex: 4, cash: 1000, buildings: [{ id: 'farm', type: FARM, workerSources: {} }] })).resolves.not.toThrow();
    expect(amountOf(journal, 'wage_debt_paid')).toBe(0);
    // What is still owed to the city is paid all the same.
    expect(amountOf(journal, 'contribution_debt_paid')).toBe(40);
  });

  // A month's settlement and a demolition may meet in the same month: a building gone mid-month may have traded, served or spoiled goods before it went.
  test('a month whose flows name a building that is gone is settled all the same: nothing is booked for the gone one, the others are', async () => {
    const journal = [];
    // The farm's workers still come from a house a disaster destroyed after the day's employment step: those workers are not paid.
    const buildings = [{ id: 'farm', type: FARM, workerSources: { 'gone-house': 4 } }, { id: 'house', type: HOUSE, workerSources: {} }];
    await expect(settleMonth(journal, {
      monthIndex: 3,
      cash: 1000,
      buildings,
      pairs: [{ sellerId: 'farm', buyerId: 'gone-shop', amountHT: 50 }, { sellerId: 'gone-farm', buyerId: 'farm', amountHT: 30 }],
      serviceFlows: [{ buildingId: 'gone-tank', houseId: 'house', service: 'water', units: 3 }, { buildingId: 'farm', houseId: 'gone-house', service: 'water', units: 1 }],
      spoilage: [{ buildingId: 'gone-farm', units: 2, lostRevenue: 10 }],
    })).resolves.not.toThrow();
    expect(journal.some((line) => [line.accountBuildingId, line.counterpartyBuildingId, line.buildingInstanceId].some((id) => id?.startsWith('gone')))).toBe(false);
    expect(journal.some((line) => line.type === 'maintenance' && line.accountBuildingId === 'farm')).toBe(true);
  });
});

describe('the liquidation of a company the player demolishes', () => {
  test('its stock is sold, its creditors are paid by rank, what is left of a debt is abandoned and the city bears it, and the capital it put in is lost', async () => {
    // 300 in cash, a stock of 200 at cost (sold for half: 100), 100 of capital the city put in. The wages (400, rank 1) take all the 400 there is.
    const journal = await farmInDifficulty({ capital: 100, stockPosted: 200 });
    const liquidator = liquidatorOf(journal, { cash: 300, stock: 200 });
    const preview = await liquidator.preview({ buildingId: 'farm', turn: 4 });
    expect(preview.accounts).toEqual([{
      cash: 300,
      stockProceeds: 100,
      surplusToCity: 0,
      holdingLoss: 100,
      paid: [{ kind: 'wage', label: 'Salaires', amount: 400 }],
      unpaid: [{ kind: 'contribution', label: 'Cotisations sociales', amount: 40, advancedByCity: false }],
    }]);

    await liquidator.execute({ buildingId: 'farm', turn: 4 });

    // Written exactly as announced.
    expect(amountOf(journal, 'od_stock_down_production')).toBe(200);
    expect(amountOf(journal, 'liquidation_stock_sale')).toBe(100);
    expect(amountOf(journal, 'wage_debt_paid')).toBe(400);
    expect(amountOf(journal, 'od_abandoned_contribution')).toBe(40);
    expect(amountOf(journal, 'od_bad_debt_contribution')).toBe(40);
    expect(amountOf(journal, 'od_holding_written_off')).toBe(100);
    expect(amountOf(journal, 'liquidation_surplus_paid')).toBe(0);
    // Every debt of the farm is closed, and every line balances.
    expect(farmDebtsOf(journal)).toEqual([]);
    expect(balanced(journal)).toBe(true);
  });

  test('wages the cash cannot cover are advanced by the city, so the workers are made whole', async () => {
    const journal = await farmInDifficulty();
    const liquidator = liquidatorOf(journal, { cash: 100 });
    await liquidator.execute({ buildingId: 'farm', turn: 4 });
    // 100 of the 400 comes from the cash; the other 300 is advanced by the city and received by the house, and the farm is released of it.
    expect(amountOf(journal, 'wage_debt_paid')).toBe(100);
    expect(amountOf(journal, 'wage_guarantee')).toBe(300);
    expect(journal.filter((line) => line.type === 'household_wage' && line.accountBuildingId === 'house').reduce((sum, line) => sum + line.amount, 0)).toBe(400);
    expect(amountOf(journal, 'od_abandoned_wage')).toBe(300);
    expect(farmDebtsOf(journal).filter((debt) => debt.kind === 'wage')).toEqual([]);
  });

  test('what its creditors leave of its cash goes back to the city, up to the capital the city put in', async () => {
    const journal = [{ turn: 0, type: 'company_capital_received', amount: 100, accountBuildingId: 'farm', accountKind: null, counterpartyBuildingId: null, year: 0, month: 1 }];
    const liquidator = liquidatorOf(journal, { cash: 1000 });
    await liquidator.execute({ buildingId: 'farm', turn: 4 });
    expect(amountOf(journal, 'liquidation_surplus_paid')).toBe(100);
    expect(amountOf(journal, 'liquidation_surplus_received')).toBe(100);
    expect(amountOf(journal, 'od_holding_written_off')).toBe(0);
  });

  test('a building is liquidated once: the second call (the eraser closes the books first, the removal closes them again) writes nothing', async () => {
    const journal = await farmInDifficulty({ capital: 100 });
    const liquidator = liquidatorOf(journal, { cash: 50 });
    await liquidator.execute({ buildingId: 'farm', turn: 4 });
    const written = journal.length;
    await liquidator.execute({ buildingId: 'farm', turn: 4 });
    expect(journal.length).toBe(written);
    expect((await liquidator.preview({ buildingId: 'farm', turn: 4 })).accounts).toEqual([]);
  });
});

describe('the demolition of a building', () => {
  const cityWith = (type, instanceId) => ({ size: 3, tiles: [[{ buildingId: type, instanceId }, {}, {}], [{}, {}, {}], [{}, {}, {}]] });

  test('the mayor\'s house cannot be demolished: nothing is touched', async () => {
    const city = cityWith('House-Mayor', 'mayor');
    const calls = [];
    const bulldoze = new BulldozeBuildingAtTile({
      syncRemovedBuilding: async () => calls.push('sync'),
      liquidateBuilding: async () => calls.push('liquidate'),
      assetCatalog: { 'House-Mayor': { gridSize: 1 } },
    });
    const result = await bulldoze.execute({ city, x: 0, y: 0 });
    expect(result.refused).toBe('building_undemolishable');
    expect(calls).toEqual([]);
    expect(city.tiles[0][0].buildingId).toBe('House-Mayor');
  });

  test('a building\'s books are closed before it leaves the map: if they cannot be, it stays', async () => {
    const city = cityWith(HOUSE, 'house');
    const bulldoze = new BulldozeBuildingAtTile({
      syncRemovedBuilding: async () => {},
      liquidateBuilding: async () => {
        throw new Error('the books could not be closed');
      },
      assetCatalog: { [HOUSE]: { gridSize: 1 } },
    });
    await expect(bulldoze.execute({ city, x: 0, y: 0 })).rejects.toThrow(/could not be closed/);
    expect(city.tiles[0][0].buildingId).toBe(HOUSE);
  });
});
