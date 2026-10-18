import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';

// Every private movement the journal books for a company or a house is also in the economy register, once, with the same
// amount: the register is the source the journal is read from, so the two must never disagree.
const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';

function settle(pairs, buildings) {
  const journal = [];
  const register = [];
  const service = new SettleProducerCharges({
    // The month delivered is the last of the year: the settlement that closes the fiscal year, the one that books the corporate tax.
    getTimeInfo: () => ({ year: 1, monthIndex: 11, month: 'Décembre' }),
    listBuildings: async () => buildings,
    sumGoodsFlowsByPair: async () => pairs,
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    companyFundsOf: async () => 1e9, // a company that can pay everything: these tests are not about debts
    getJournalEntries: async () => [],
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    sumBankInterestByBuilding: async () => [],
    sumOtherExpensesByBuilding: async () => [],
    listHouses: async () => [],
    getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
    getWageRateOf: async () => () => 100,
    getSalaryTax: async () => ({ threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 }),
    getCorporateTaxRate: async () => 0.25,
    getHouseMaintenanceSubsidyRate: async () => 1,
    listSpoilage: async () => [],
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 10,
    readCompanyYear: companyYearReaderOf(journal),
    recordLedgerEntry: async (line) => {
      journal.push(line);
      return { recorded: true };
    },
    recordEconomyMovement: async (movement) => {
      register.push(movement);
    },
  });
  return service.execute({ time: 2, deliveredTime: 1 }).then(() => ({ journal, register }));
}

describe('economy register — each private movement of the journal is in the register, with its amount', () => {
  test('a company wage and the house that receives it are both in the register, with the journal amount', async () => {
    const { journal, register } = await settle(
      [{ sellerId: 'farm', buyerId: null, amountHT: 2000 }], // more than the payroll of its 4 workers (400), so it has a profit to tax
      [
        { id: 'farm', type: FARM, workerSources: { house: 4 } },
        { id: 'house', type: HOUSE, workerSources: {} },
      ]
    );

    for (const kind of ['producer_wage', 'household_wage', 'maintenance', 'corporate_tax']) {
      const booked = journal.filter((line) => line.type === kind);
      expect(booked.length).toBeGreaterThan(0);
      const written = register.filter((movement) => movement.kind === kind);
      expect(written.map((movement) => movement.amount)).toEqual(booked.map((line) => line.amount));
    }
  });
});
