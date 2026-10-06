import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';

// Every private movement the journal books for a company or a house is also in the economy register, once, with the same
// amount: the register is the source the journal is read from, so the two must never disagree.
const FARM = 'Farm-Wheat';
const HOUSE = 'House-Blue';

function settle(pairs, buildings) {
  const journal = [];
  const register = [];
  const service = new SettleProducerCharges({
    getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
    listBuildings: async () => buildings,
    sumGoodsFlowsByPair: async () => pairs,
    sumServiceFlows: async () => [],
    getServiceSubsidies: async () => ({}),
    getServicePrice: () => 0,
    fundsOf: async () => 0,
    getVatRates: async () => ({}),
    sumHouseSales: async () => [],
    listHouses: async () => [],
    getPublicPay: async () => ({ salaryPerMonth: 100, unemploymentBenefitRate: 0.7 }),
    getSalaryTax: async () => ({ rate: 0.1, threshold: 0 }),
    recordServiceCutOff: async () => {},
    buildingMaintenanceCost: () => 10,
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
      [{ sellerId: 'farm', buyerId: null, amountHT: 200 }],
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
