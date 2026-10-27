import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { buildingFinanceFigures } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';

// The upkeep of a house is its owner's charge, as in real life: the property company of the mayor's house books it (its own house's included),
// the hamlet pays it the subsidy the player sets, and the tenants pay only their rent.
function settle({ buildings, subsidyRate }) {
  const journal = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 3, month: 'Avril' }),
    listBuildings: async () => buildings.map((building) => ({ ...building, workerSources: {} })),
    sumGoodsFlowsByPair: async () => [],
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    companyFundsOf: async () => 1e9, // a company that can pay everything: these tests are not about debts
    getJournalEntries: async () => [],
    businessFundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => buildings.filter((building) => building.type.startsWith('House')).map((building) => ({ id: building.id, pop: 0, salaried: 0 })),
    getPublicPay: async () => ({ benefitBase: 0, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 8,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
    getCorporateTaxRate: async () => 0.25,
    getHouseMaintenanceSubsidyRate: async () => subsidyRate,
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 6,
    readCompanyYear: companyYearReaderOf(journal),
    readHouseholdYear: householdYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push(booked({ ...line, year: 1, month: 4 }));
      return { recorded: true };
    },
  });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => journal);
}

describe('the upkeep of the houses is their owner\'s charge', () => {
  const buildings = [
    { id: 'mayor', type: 'House-Mayor' },
    { id: 'artisans', type: 'House-Red' },
  ];

  test('the property company books the upkeep of every house, its own included, and the hamlet pays it the subsidy', async () => {
    const journal = await settle({ buildings, subsidyRate: 0.5 });

    const upkeep = journal.filter((line) => line.type === 'maintenance');
    expect(upkeep).toHaveLength(2);
    expect(upkeep.every((line) => line.accountBuildingId === 'mayor' && line.accountKind === 'entreprise:sci' && line.amount === 6)).toBe(true);
    expect(journal.filter((line) => line.type === 'subsidy_housing_received').every((line) => line.accountBuildingId === 'mayor' && line.amount === 3)).toBe(true);
    // No household is charged for it: its personal account has no such line.
    expect(journal.some((line) => line.accountKind === 'particulier' && line.type === 'maintenance')).toBe(false);

    // The statement of the property company carries the whole upkeep as a charge and the subsidy as an income: the rest is what the rent has to cover.
    const figures = buildingFinanceFigures(journal, 'mayor', { year: 1, accountKind: 'entreprise:sci', salesNature: null });
    expect(figures.statement.results.operating).toBe(-6); // 2 × 3 left to the owner after the hamlet's half
  });

  test('with the owner\'s house demolished, the hamlet bears the whole upkeep and the line says so', async () => {
    const journal = await settle({ buildings: [{ id: 'artisans', type: 'House-Red' }], subsidyRate: 0.25 });

    expect(journal.filter((line) => line.type === 'maintenance')).toHaveLength(0);
    const line = journal.find((entry) => entry.type === 'subsidy_housing');
    expect(line).toMatchObject({ amount: 6, accountBuildingId: null });
    expect(line.description).toContain('sans propriétaire');
  });

  test('the subsidy received is money in for its owner, and the line moves the owner\'s cash', () => {
    expect(moneyDirectionOf(booked({ type: 'subsidy_housing_received', amount: 1, accountBuildingId: 'sci' }))).toBe('credit');
  });
});
