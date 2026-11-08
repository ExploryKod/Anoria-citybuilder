import { describe, test, expect } from '@jest/globals';
import { SettleProducerCharges } from '../../../src/contexts/accounting/application/services/SettleProducerCharges.js';
import { claimsPaidOf, companyToJoin, membershipOf } from '../../../src/contexts/accounting/domain/policies/InsurancePolicy.js';
import { insuranceLawStatusOf } from '../../../src/contexts/accounting/domain/policies/InsuranceLawPolicy.js';
import { unpairedFlowsOf } from '../../../src/contexts/accounting/domain/policies/TransactionLinkPolicy.js';
import { companyYearReaderOf } from '../../helpers/companyYearReader.js';
import { householdYearReaderOf } from '../../helpers/householdYearReader.js';
import { booked } from '../../helpers/booked.js';

// An insurance company is paid a premium by the households that can pay it (after the fact, out of their net wages) and, once a household has paid it two
// months in a row, indemnifies its sick workers, never more than it holds. The social security and the insurance never pay the same absence.
const HAMLET = 'hamlet-1';

async function runMonths(months, { sicknessCover = 'none', reserve = 1e9, canPay = () => true, cash = 1e9, insuranceMandatory = false, staffedInsurer = false } = {}) {
  const journal = [];
  // A month is 10 turns; a settlement runs on the first turn of the next month and dates its lines there (ProcessTurnBudget.js).
  const getTimeInfo = (turn) => {
    const month = Math.floor(turn / 10);
    return { year: 1 + Math.floor(month / 12), monthIndex: month % 12, month: `M${month}` };
  };
  for (let delivered = 0; delivered < months; delivered += 1) {
    const time = (delivered + 1) * 10;
    const record = async (line) => {
      if (line.businessKey && journal.some((previous) => previous.businessKey === line.businessKey)) return { recorded: false, reason: 'duplicate_business_key' };
      const { year, monthIndex } = getTimeInfo(line.turn);
      journal.push(booked({ ...line, hamletId: HAMLET, year, month: monthIndex + 1 }));
      return { recorded: true };
    };
    await record({ type: 'loan_interest_received', amount: 1000, accountBuildingId: 'bank-1', turn: time - 1 });
    await new SettleProducerCharges({
      borrowFromBank: async () => 0, // no bank: nothing is lent
      getTimeInfo,
      listBuildings: async () => [
        { id: 'bank-1', type: 'Bank', workerSources: { 'house-1': 4 }, absentSources: { 'house-1': 1 }, sickAbsentSources: { 'house-1': 1 } },
        // Staffed, the insurer employs a worker of another house: the law of compulsory insurance can then be in force.
        { id: 'insurance-1', type: 'Insurance', companyId: 'ano', workerSources: staffedInsurer ? { 'house-2': 1 } : {}, absentSources: {} },
        { id: 'house-1', type: 'House-Blue', workerSources: {}, absentSources: {} },
        { id: 'house-2', type: 'House-Blue', workerSources: {}, absentSources: {} },
      ],
      sumGoodsFlowsByPair: async () => [],
      sumServiceFlows: async () => [],
      getServiceSubsidies: async () => ({}),
      getServicePrice: () => 0,
      fundsOf: async (houseId) => (canPay(delivered, houseId) ? cash : 0),
      companyFundsOf: async (buildingId) => (buildingId === 'insurance-1' ? reserve : 1e9),
      getJournalEntries: async () => journal,
      getVatRates: async () => ({}),
      sumHouseSales: async () => [],
      sumBankInterestByBuilding: async () => [{ buildingId: 'bank-1', amountHT: 1000 }],
      sumOtherExpensesByBuilding: async () => [],
      listHouses: async () => [{ id: 'house-1', pop: 4, salaried: 0, invalid: 0 }, { id: 'house-2', pop: 1, salaried: 0, invalid: 0 }],
      getPublicPay: async () => ({ benefitBase: 100, unemploymentBenefitRate: 0, employerContributionRate: 0, employeeContributionRate: 0.1, administratorStipend: 0, sicknessCover, insuranceMandatory }),
      getWageRateOf: async () => () => 100,
      getSalaryTax: async () => ({ threshold1: 1e6, rate1: 0, threshold2: 1e6, rate2: 0 }),
      getCorporateTaxRate: async () => 0,
      getHouseMaintenanceSubsidyRate: async () => 1,
      listSpoilage: async () => [],
      recordServiceCutOff: async () => {},
      buildingMaintenanceCost: () => 0,
      readCompanyYear: companyYearReaderOf(journal),
      readHouseholdYear: householdYearReaderOf(journal),
      recordLedgerEntry: record,
    }).execute({ time, deliveredTime: time - 1 });
  }
  const premiumMonths = journal.filter((line) => line.type === 'service_purchase' && line.resource === 'insurance' && line.accountBuildingId === 'house-1').map((line) => line.month - 2);
  const benefits = journal.filter((line) => line.type === 'insurance_benefit');
  return { journal, premiumMonths, benefits, benefitMonths: benefits.map((line) => line.month - 2) };
}

describe('insurance — premiums, waiting period, cover limited to the reserve', () => {
  test('a household pays its premium every month out of its net wages, and is covered only after two in a row', async () => {
    const { journal, premiumMonths, benefitMonths, benefits } = await runMonths(4);

    expect(premiumMonths).toEqual([0, 1, 2, 3]);
    // 3 at work of 4 assigned: 300 of wages, 270 net of the employee's 10 %; the company's 4 % is 10.80 a month.
    expect(journal.find((line) => line.type === 'service_sales' && line.resource === 'insurance')?.amount ?? journal.find((line) => line.type === 'service_purchase' && line.resource === 'insurance').amount).toBeCloseTo(10.8, 2);
    // The sick worker misses 100 a month; 60 % of it is indemnified, from the third settlement (premiums of the months 0 and 1 are in).
    expect(benefitMonths).toEqual([2, 3]);
    expect(benefits.every((line) => line.amount === 60)).toBe(true);
    expect(journal.filter((line) => line.type === 'household_insurance_benefit').map((line) => line.amount)).toEqual([60, 60]);
    expect(unpairedFlowsOf(journal).lonely).toEqual([]);
  });

  test('a company never pays more than it holds: its members share the reserve', async () => {
    const { benefits } = await runMonths(4, { reserve: 25 });

    expect(benefits.map((line) => line.amount)).toEqual([25, 25]);
  });

  test('a household that cannot pay one month loses its cover, and nothing is written for it', async () => {
    const { premiumMonths, benefitMonths } = await runMonths(5, { canPay: (month) => month !== 2 });

    expect(premiumMonths).toEqual([0, 1, 3, 4]);
    // Covered at month 2 (premiums 0 and 1), not at month 3 (no premium at 2); at month 4 it has paid only once in a row, so waits again.
    expect(benefitMonths).toEqual([2]);
  });

  test('when the social security is the city\'s choice, the insurance does not pay the same absence', async () => {
    const { journal, benefits } = await runMonths(4, { sicknessCover: 'secu' });

    expect(benefits).toEqual([]);
    expect(journal.some((line) => line.type === 'sickness_benefit')).toBe(true);
  });
});

describe('insurance is the household\'s choice unless the law makes it compulsory', () => {
  // A household that holds 20 can pay the 10.80 premium but would be left under a month of its net wages (270): it goes without when the choice is its own.
  test('a household that would keep less than a month of net wages does not take the insurance', async () => {
    const { premiumMonths } = await runMonths(3, { cash: 20 });

    expect(premiumMonths).toEqual([]);
  });

  test('with the law in force, it pays its premium as soon as it can', async () => {
    const { premiumMonths } = await runMonths(3, { cash: 20, insuranceMandatory: true, staffedInsurer: true });

    expect(premiumMonths).toEqual([0, 1, 2]);
  });

  test('a law passed while the insurance has no staff in post is suspended: the household is free again', async () => {
    const { premiumMonths } = await runMonths(3, { cash: 20, insuranceMandatory: true, staffedInsurer: false });

    expect(premiumMonths).toEqual([]);
  });

  test('compulsory or not, a household that cannot pay the premium at all pays nothing', async () => {
    const { premiumMonths } = await runMonths(3, { cash: 5, insuranceMandatory: true, staffedInsurer: true });

    expect(premiumMonths).toEqual([]);
  });
});

describe('the law of compulsory insurance', () => {
  const working = { staffed: true, defaultMonths: 0 };

  test('it can be passed only while a company stands, is staffed and is not in default', () => {
    expect(insuranceLawStatusOf({ mandatory: true, companies: [working], graceMonths: 3 })).toEqual({ mandatory: true, available: true, inForce: true, reasons: [] });
    expect(insuranceLawStatusOf({ mandatory: true, companies: [], graceMonths: 3 })).toMatchObject({ available: false, inForce: false, reasons: ['noCompany'] });
    expect(insuranceLawStatusOf({ mandatory: false, companies: [{ staffed: false, defaultMonths: 0 }], graceMonths: 3 })).toMatchObject({ available: false, reasons: ['notStaffed'] });
    expect(insuranceLawStatusOf({ mandatory: true, companies: [{ staffed: true, defaultMonths: 3 }], graceMonths: 3 })).toMatchObject({ inForce: false, reasons: ['allInDefault'] });
  });

  test('one working company is enough, and a law not passed is never in force', () => {
    expect(insuranceLawStatusOf({ mandatory: true, companies: [{ staffed: true, defaultMonths: 5 }, working], graceMonths: 3 }).inForce).toBe(true);
    expect(insuranceLawStatusOf({ mandatory: false, companies: [working], graceMonths: 3 })).toMatchObject({ available: true, inForce: false });
  });

  test('the setting is a yes or a no: anything else is a defect', () => {
    expect(() => insuranceLawStatusOf({ mandatory: undefined, companies: [working], graceMonths: 3 })).toThrow(/set or not/);
  });
});

describe('insurance policy', () => {
  const standing = new Set(['a', 'b']);
  const paid = (company, ...months) => new Map([[company, new Set(months)]]);

  test('membership: the company paid last month, covered after the waiting months in a row, and only while it stands', () => {
    expect(membershipOf(paid('a', 3, 4), 5, 2, standing)).toEqual({ companyId: 'a', covered: true });
    expect(membershipOf(paid('a', 4), 5, 2, standing)).toEqual({ companyId: 'a', covered: false });
    expect(membershipOf(paid('a', 2, 4), 5, 2, standing)).toEqual({ companyId: 'a', covered: false });
    expect(membershipOf(paid('a', 3, 4), 6, 2, standing)).toEqual({ companyId: null, covered: false });
    expect(membershipOf(paid('gone', 3, 4), 5, 2, standing)).toEqual({ companyId: null, covered: false });
  });

  test('a newcomer joins the company that holds the most per member', () => {
    expect(companyToJoin([{ id: 'a', reserve: 100, members: 4 }, { id: 'b', reserve: 100, members: 1 }])).toBe('b');
    expect(companyToJoin([{ id: 'a', reserve: 50, members: 0 }, { id: 'b', reserve: 50, members: 0 }])).toBe('a');
    expect(companyToJoin([])).toBeNull();
  });

  test('claims are paid whole when the reserve covers them, otherwise shared in proportion, to the centime', () => {
    expect(claimsPaidOf([{ houseId: 'x', amount: 60 }, { houseId: 'y', amount: 30 }], 1000)).toEqual([{ houseId: 'x', amount: 60 }, { houseId: 'y', amount: 30 }]);
    const shared = claimsPaidOf([{ houseId: 'x', amount: 60 }, { houseId: 'y', amount: 30 }], 45);
    expect(shared).toEqual([{ houseId: 'x', amount: 30 }, { houseId: 'y', amount: 15 }]);
    expect(claimsPaidOf([{ houseId: 'x', amount: 10 }], 0)).toEqual([{ houseId: 'x', amount: 0 }]);
  });

  // Regression: each share is rounded on its own, and the rounding used to be able to push the last share below nothing (dropped by the caller), so the company paid
  // a centime or two more than it held. Whatever the claims and the reserve, the total is the reserve (or the claims when it covers them) and no share is negative.
  test('whatever the claims and the reserve, the total paid never goes over the reserve and no share is negative', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 500; round += 1) {
      const claims = Array.from({ length: 1 + Math.floor(next() * 6) }, (_, index) => ({ houseId: `h${index}`, amount: Math.round(next() * 500) / 100 }));
      const reserve = Math.round(next() * 1500) / 100;
      const paid = claimsPaidOf(claims, reserve);
      const wantedCents = claims.reduce((sum, claim) => sum + Math.round(claim.amount * 100), 0);
      const paidCents = paid.reduce((sum, share) => sum + Math.round(share.amount * 100), 0);
      expect(paid.every((share) => share.amount >= 0)).toBe(true);
      expect(paidCents).toBe(Math.min(wantedCents, Math.round(reserve * 100)));
    }
  });
});
