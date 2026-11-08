import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { RecordLedgerEntry } from '../../../src/contexts/accounting/application/commands/journal/RecordLedgerEntry.js';
import { cashChangeOfLegs, entryLegsOf, stateCanAfford } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';

// The State may not spend more than its account at its central bank holds (docs/gameplay/PLAN_BANK_MONEY.md). The month's settlement must not freeze when the Treasury
// runs dry (a refused line is no defect): the State leaves unpaid what it cannot pay, and the other side of that flow is not written (nobody is paid what the State did not pay).

describe('stateCanAfford — the rule', () => {
  test('a payment is refused when the Treasury would end below nothing; money coming in or none moving is never refused', () => {
    expect(stateCanAfford({ held: 10000, change: -10000 })).toBe(true);
    expect(stateCanAfford({ held: 10000, change: -10001 })).toBe(false);
    expect(stateCanAfford({ held: 0, change: 500 })).toBe(true);
    expect(stateCanAfford({ held: -300, change: 0 })).toBe(true);
  });
});

describe('RecordLedgerEntry — the State\'s Treasury is a floor', () => {
  useHamletForTests('h1');

  function command(held) {
    const written = [];
    const port = {
      hasBusinessKey: async (key) => written.some((entry) => entry.businessKey === key),
      appendEntry: async (entry) => {
        written.push(entry);
        return { recorded: true };
      },
    };
    const time = { getTimeInfo: () => ({ year: 1, monthIndex: 0 }) };
    return { service: new RecordLedgerEntry(port, time, async () => held), written };
  }
  const salary = { turn: 1, type: 'salary', amount: 50, description: 'Traitement' };

  test('a payment the Treasury holds is written; one it does not is refused with its reason, and nothing is written', async () => {
    const rich = command(5000);
    expect(await rich.service.execute(salary)).toMatchObject({ recorded: true });
    const poor = command(4999);
    expect(await poor.service.execute(salary)).toMatchObject({ recorded: false, reason: 'treasury_insufficient' });
    expect(poor.written).toHaveLength(0);
  });

  test('the companies and the households are not held by it: only the State\'s account is a floor', async () => {
    const { service, written } = command(0);
    expect(await service.execute({ turn: 1, type: 'producer_purchase', amount: 50, description: 'Achat', accountBuildingId: 'farm' })).toMatchObject({ recorded: true });
    expect(written).toHaveLength(1);
  });

  test('a line already written is a duplicate whatever the Treasury holds now: idempotence comes first', async () => {
    const { service } = command(5000);
    await service.execute({ ...salary, businessKey: 'salary:1' });
    // The Treasury holds less than a second payment would take, but the line is already written.
    const again = new RecordLedgerEntry(
      { hasBusinessKey: async () => true, appendEntry: async () => ({ recorded: false, skipped: true, reason: 'duplicate_business_key' }) },
      { getTimeInfo: () => ({ year: 1, monthIndex: 0 }) },
      async () => 0,
    );
    expect(await again.execute({ ...salary, businessKey: 'salary:1' })).toMatchObject({ recorded: false, reason: 'duplicate_business_key' });
  });
});

describe('the month\'s settlement when the Treasury is short', () => {
  useHamletForTests('h1');

  /** @param {number} held what the State's account holds, in centimes (it falls as the State pays) */
  async function settle(held) {
    const journal = [];
    let treasury = held;
    const service = new SettleProducerCharges({
      borrowFromBank: async () => 0,
      getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
      listBuildings: async () => [{ id: 'house', type: 'House-Blue', workerSources: {} }],
      sumGoodsFlowsByPair: async () => [],
      sumServiceFlows: async () => [],
      getServiceSubsidies: async () => ({}),
      getServicePrice: () => 0,
      fundsOf: async () => 0,
      companyFundsOf: async () => 1e9,
      getJournalEntries: async () => [],
      getVatRates: async () => ({}),
      sumHouseSales: async () => [],
      sumBankInterestByBuilding: async () => [],
      sumOtherExpensesByBuilding: async () => [],
      // 3 unemployed: a benefit of 3 × 100 × 0.7 = 210.
      listHouses: async () => [{ id: 'house', pop: 3, salaried: 0, invalid: 0 }],
      getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0.7, employerContributionRate: 0, employeeContributionRate: 0, administratorStipend: 0 }),
      getWageRateOf: async () => () => 100,
      getSalaryTax: async () => ({ threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 }),
      getCorporateTaxRate: async () => 0.25,
      getHouseMaintenanceSubsidyRate: async () => 1,
      listSpoilage: async () => [],
      recordServiceCutOff: async () => {},
      buildingMaintenanceCost: () => 0,
      readCompanyYear: companyYearReaderOf(journal),
      // The journal's own rule: the State's lines are held by its Treasury, which falls as it pays.
      recordLedgerEntry: async (line) => {
        if (line.accountBuildingId === null) {
          const change = cashChangeOfLegs(entryLegsOf({ type: line.type, amount: line.amount, accountBuildingId: null, legs: line.legs ?? null }).legs);
          if (change < 0 && !stateCanAfford({ held: treasury, change })) return { recorded: false, skipped: true, reason: 'treasury_insufficient' };
          treasury += change;
        }
        journal.push(line);
        return { recorded: true };
      },
    });
    const month = await service.execute({ time: 2, deliveredTime: 1 });
    return { journal, month, treasury };
  }

  test('with the money, the State pays the benefit and the household receives it', async () => {
    const { journal, month } = await settle(100000);
    expect(journal.find((line) => line.type === 'unemployment_benefit')).toMatchObject({ amount: 210, accountBuildingId: null });
    expect(journal.find((line) => line.type === 'household_benefit')).toMatchObject({ amount: 210, accountBuildingId: 'house' });
    expect(month.stateUnpaid).toEqual({});
  });

  test('with an empty Treasury the month settles anyway: the benefit is not paid, nothing is written on the household\'s side, and the unpaid is told', async () => {
    const { journal, month, treasury } = await settle(100);
    expect(journal.find((line) => line.type === 'unemployment_benefit')).toBeUndefined();
    expect(journal.find((line) => line.type === 'household_benefit')).toBeUndefined();
    expect(journal.find((line) => line.type === 'payroll_tax')).toBeUndefined();
    expect(month.stateUnpaid).toEqual({ unemployment_benefit: 210 });
    // The State kept what it had: it never went below nothing.
    expect(treasury).toBe(100);
  });
});
