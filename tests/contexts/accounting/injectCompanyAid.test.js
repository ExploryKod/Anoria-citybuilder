import { beforeEach, describe, expect, test } from '@jest/globals';
import { InjectCompanyAid } from '../../../src/contexts/accounting/application/services/InjectCompanyAid.js';
import { companyAidOf } from '../../../src/contexts/accounting/domain/policies/CompanyAidLedgerPolicy.js';
import { stakeOf } from '../../../src/contexts/accounting/domain/policies/CompanyAidPolicy.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';
import { booked } from '../../helpers/booked.js';

describe('the city puts money into a company that already lives', () => {
  let journal;
  let fold;
  let service;
  const write = (line) => {
    const entry = booked({ hamletId: 'h', ...line });
    journal.push(entry);
    fold.add(entry);
  };

  beforeEach(() => {
    useHamletForTests('h');
    // The mill was founded with 400 of participation (the city holds no stake yet: it holds capital with no return).
    journal = [];
    fold = new LegsFold();
    write({ type: 'company_capital_received', amount: 400, turn: 10, year: 0, month: 3, accountBuildingId: 'mill', accountKind: null });
    service = new InjectCompanyAid({
      listCompanies: async () => [{ buildingId: 'mill', name: 'Moulin' }],
      getJournalEntries: async () => journal,
      getLegsFold: async () => fold,
      getCompanyAidPolicy: async () => ({ loanInterestRate: 0.06, interestStartsAfterMonths: 3 }),
      getTimeInfo: () => ({ year: 2, monthIndex: 4, month: 'Mai' }),
      recordLedgerEntry: async (line) => {
        write({ ...line, year: 2, month: 5 });
        return { recorded: true };
      },
    });
  });

  test('becoming a shareholder in the middle of the company\'s life gives the city a stake, which grows with each contribution', async () => {
    expect(stakeOf(companyAidOf(journal, 'mill'))).toBe(0);

    await service.execute({ buildingId: 'mill', amount: 100, form: 'shareholder', time: 100 });
    // 100 of a capital of 500.
    expect(stakeOf(companyAidOf(journal, 'mill'))).toBeCloseTo(0.2, 5);

    await service.execute({ buildingId: 'mill', amount: 300, form: 'shareholder', time: 110 });
    expect(stakeOf(companyAidOf(journal, 'mill'))).toBeCloseTo(0.5, 5);
    // Both accounts carry it: the city's holding goes out, the company's capital comes in.
    expect(journal.filter((line) => line.type === 'shareholder_capital_paid').map((line) => line.accountBuildingId)).toEqual([null, null]);
    expect(journal.filter((line) => line.type === 'shareholder_capital_received').map((line) => line.accountBuildingId)).toEqual(['mill', 'mill']);
  });

  test('a company that has grown costs more to enter: the price of a share is its equity over its shares', async () => {
    // The mill made 400 since it was founded: it is worth 800 for 400 shares, 2 a share.
    write({ type: 'producer_revenue', amount: 400, turn: 50, year: 1, month: 6, accountBuildingId: 'mill', accountKind: null });

    await service.execute({ buildingId: 'mill', amount: 100, form: 'shareholder', time: 100 });

    // 100 buys 50 shares of 450: a stake of 11 %, not the 20 % the same sum bought at the price of the capital.
    expect(stakeOf(companyAidOf(journal, 'mill'))).toBeCloseTo(50 / 450, 5);
    // A participation buys no share: it is capital given, which lifts what a share is worth.
    await service.execute({ buildingId: 'mill', amount: 90, form: 'participation', time: 101 });
    expect(companyAidOf(journal, 'mill').totalShares).toBe(450);
    expect((await service.describe())[0].sharePrice).toBeCloseTo(990 / 450, 5);
  });

  test('a company that lost its equity can be bought into at the minimum price, which gives the buyer nearly all of it', async () => {
    write({ type: 'maintenance', amount: 400, turn: 50, year: 1, month: 6, accountBuildingId: 'mill', accountKind: null });

    expect((await service.describe())[0].sharePrice).toBe(0.1);
    await service.execute({ buildingId: 'mill', amount: 10, form: 'shareholder', time: 100 });
    // 10 at 0.1 buys 100 shares of 500.
    expect(stakeOf(companyAidOf(journal, 'mill'))).toBeCloseTo(0.2, 5);
  });

  test('a loan made later carries the terms of the policy in force when it is made', async () => {
    await service.execute({ buildingId: 'mill', amount: 200, form: 'loan', time: 100 });

    expect(companyAidOf(journal, 'mill').loans).toMatchObject([{ principal: 20000, outstanding: 20000, terms: { interestRate: 0.06, interestStartsAfterMonths: 3 } }]);
  });

  test('an amount of nothing, a form that does not exist and a building that is no company are refused', async () => {
    await expect(service.execute({ buildingId: 'mill', amount: 0, form: 'loan', time: 100 })).rejects.toThrow('more than 0');
    await expect(service.execute({ buildingId: 'mill', amount: 10, form: 'gift', time: 100 })).rejects.toThrow('not a form of aid');
    await expect(service.execute({ buildingId: 'house', amount: 10, form: 'loan', time: 100 })).rejects.toThrow('not a company');
  });

  test('describing the companies tells what the city holds in each', async () => {
    await service.execute({ buildingId: 'mill', amount: 100, form: 'shareholder', time: 100 });

    expect(await service.describe()).toMatchObject([{ buildingId: 'mill', capital: 500, shareholderCapital: 100, loanOutstanding: 0 }]);
  });
});
