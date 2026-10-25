import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { LiquidateDemolishedBuilding } from '../../../src/contexts/accounting/application/services/LiquidateDemolishedBuilding.js';
import { BulldozeBuildingAtTile } from '../../../src/contexts/construction/application/services/BulldozeBuildingAtTile.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { payablesOf } from '../../../src/contexts/accounting/domain/policies/DebtPolicy.js';
import { assertBalanced, entryLegsOf } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';

// The month of a farm whose workers live in `house`. `buildings` is what stands that month.
function settleMonth(journal, { monthIndex, cash, buildings }) {
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex, month: `Mois ${monthIndex}` }),
    listBuildings: async () => buildings,
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
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
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 10,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: monthIndex + 1 });
      return { recorded: true };
    },
    recordEconomyMovement: async () => {},
  });
  return service.execute({ time: monthIndex, deliveredTime: monthIndex - 1 });
}

function liquidatorOf(journal) {
  return new LiquidateDemolishedBuilding({
    getJournalEntries: async () => journal,
    recordLedgerEntry: async (line) => {
      journal.push({ ...line, year: 1, month: 4 });
      return { recorded: true };
    },
  });
}

const amountOf = (journal, type) => journal.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0);

describe('a demolished building leaves no debt that can never be paid', () => {
  test('the wages a company owed a house the player then demolished are abandoned, and the next month still settles', async () => {
    const journal = [];
    // The farm cannot pay: it owes its workers' house 400 of wages.
    await settleMonth(journal, { monthIndex: 3, cash: 0, buildings: [{ id: 'farm', type: FARM, workerSources: { house: 4 } }, { id: 'house', type: HOUSE, workerSources: {} }] });
    expect([...payablesOf(journal).values()].some((debt) => debt.kind === 'wage' && debt.creditorId === 'house')).toBe(true);

    // Before the demolition the player is told what it will do: the debts owed to the house are released, the ones the farm owes itself stay open (nothing pays them yet).
    const liquidator = liquidatorOf(journal);
    const preview = await liquidator.preview({ buildingId: 'house' });
    expect(preview.abandoned).toEqual([{ debtorId: 'farm', kind: 'wage', label: 'Salaires', amount: 400 }]);
    expect((await liquidator.preview({ buildingId: 'farm' })).owed.map((debt) => debt.kind).sort()).toEqual(['contribution', 'wage']);

    // The house is demolished: its books close, the debt owed to it is abandoned by an opération diverse that balances, exactly as announced.
    const { abandoned } = await liquidator.execute({ buildingId: 'house', turn: 4 });
    expect(abandoned).toEqual([{ debtorId: 'farm', kind: 'wage', amount: 400 }]);
    expect(abandoned.map((debt) => debt.amount)).toEqual(preview.abandoned.map((debt) => debt.amount));
    expect(amountOf(journal, 'od_abandoned_wage')).toBe(400);
    expect(() => assertBalanced(entryLegsOf({ type: 'od_abandoned_wage', amount: 400, accountBuildingId: 'farm', legs: null }).legs, 'od_abandoned_wage')).not.toThrow();
    expect([...payablesOf(journal).values()].some((debt) => debt.creditorId === 'house')).toBe(false);

    // The farm, with money now, settles its month: it used to try to pay the missing house by name, and the whole month failed, every month.
    await expect(settleMonth(journal, { monthIndex: 4, cash: 1000, buildings: [{ id: 'farm', type: FARM, workerSources: {} }] })).resolves.not.toThrow();
    expect(amountOf(journal, 'wage_debt_paid')).toBe(0);
    // What is still owed to the city is paid all the same.
    expect(amountOf(journal, 'contribution_debt_paid')).toBe(40);
  });

  test('a debt that the catalog gives no way to abandon is not papered over: the liquidation refuses, naming it', async () => {
    const journal = [{
      turn: 3, type: 'od_payable_premises_rent', amount: 12, description: 'Loyer dû', year: 1, month: 4,
      accountBuildingId: 'farm', accountKind: null, counterpartyBuildingId: 'owner',
    }];
    await expect(liquidatorOf(journal).execute({ buildingId: 'owner', turn: 4 })).rejects.toThrow(/no way to abandon/);
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
