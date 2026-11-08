import { describe, test, expect } from '@jest/globals';
import { debtCeilingOf } from '../../../src/contexts/accounting/domain/policies/PublicDebtPolicy.js';
import { benefactorOf } from '../../../src/contexts/accounting/domain/policies/BenefactorGiftPolicy.js';
import {
  capitalStatusOf,
  computeLoanRate,
  computeLoanInterestAmount,
  householdSavingsMoveOf,
  loanInstallmentOf,
  policyRateStatusOf,
  savingsRateOf,
} from '../../../src/contexts/accounting/domain/policies/LoanRatePolicy.js';

// The rates of money all follow the policy rate in force, all per year (BankCatalog.js).
describe('the policy rate and the rates it gives', () => {
  test('the player\'s levers are in force only while a central bank stands with all its posts filled; otherwise the defaults are', () => {
    const status = (centralBanks) => policyRateStatusOf({ setRate: 0.05, defaultRate: 0.14, setReserveRatio: 0.5, defaultReserveRatio: 0.2, centralBanks });
    expect(status([])).toMatchObject({ available: false, rate: 0.14, reserveRatio: 0.2, reasons: ['noCentralBank'] });
    expect(status([{ named: 1, posts: 2 }])).toMatchObject({ available: false, rate: 0.14, reserveRatio: 0.2, reasons: ['notStaffed'] });
    expect(status([{ named: 2, posts: 2 }])).toMatchObject({ available: true, rate: 0.05, reserveRatio: 0.5, reasons: [] });
  });

  test('the savings rate is under the policy rate, never below zero; a loan\'s is above it, more for a city in poor health', () => {
    expect(savingsRateOf(0.14)).toBeCloseTo(0.12);
    expect(savingsRateOf(0.01)).toBe(0);
    expect(computeLoanRate({ loanType: 'bank', financialHealthStatus: 'healthy', policyRate: 0.14 })).toBeCloseTo(0.20);
    expect(computeLoanRate({ loanType: 'bank', financialHealthStatus: 'critical', policyRate: 0.14 })).toBeCloseTo(0.30);
    expect(() => computeLoanRate({ loanType: 'mortgage', financialHealthStatus: 'healthy', policyRate: 0.14 })).toThrow();
  });

  test('a loan\'s interest is its yearly rate for the share of a year it lasts, and each turn pays an equal share of it', () => {
    // 15 turns out of a 60-turn year: a quarter of 20 % on 500.
    const interest = computeLoanInterestAmount({ amount: 500, yearlyRate: 0.2, durationTurns: 15, turnsPerYear: 60 });
    expect(interest).toBe(25);
    expect(loanInstallmentOf({ id: 'l', total: 525, interest, duration: 15 })).toEqual({ payment: 35, interest: 2, principal: 33 });
  });
});

// How the policy rate reaches the households: they keep a month to live on, and save a share of the rest that grows with what the savings pay.
describe('what a household does with its money', () => {
  const household = { income: 10000, spending: 8000, savings: 0 };

  test('it keeps a month of what it lives on, and saves more of the rest when the savings pay more', () => {
    // 300 in cash, a buffer of 100 (its income): 200 above it, of which 20 % + 2 × the rate.
    expect(householdSavingsMoveOf({ ...household, cash: 30000, savingsRate: 0 })).toEqual({ deposit: 4000, withdraw: 0 });
    expect(householdSavingsMoveOf({ ...household, cash: 30000, savingsRate: 0.12 })).toEqual({ deposit: 8800, withdraw: 0 });
    // A household with no income keeps what it spent the month before.
    expect(householdSavingsMoveOf({ income: 0, spending: 8000, savings: 0, cash: 8000, savingsRate: 0.12 })).toEqual({ deposit: 0, withdraw: 0 });
  });

  test('short of its buffer, it draws what it lacks on its savings, as far as they go', () => {
    expect(householdSavingsMoveOf({ ...household, cash: 4050, savings: 100000, savingsRate: 0.12 })).toEqual({ deposit: 0, withdraw: 6000 });
    expect(householdSavingsMoveOf({ ...household, cash: 0, savings: 2550, savingsRate: 0.12 })).toEqual({ deposit: 0, withdraw: 2500 });
  });
});

describe('the supervisor reads the bank\'s capital against its loans', () => {
  test('sound, warned, lending frozen, insolvent: well before the equity is below nothing', () => {
    expect(capitalStatusOf({ equity: 150, loans: 1000 }).status).toBe('sound');
    expect(capitalStatusOf({ equity: 100, loans: 1000 }).status).toBe('warning');
    expect(capitalStatusOf({ equity: 50, loans: 1000 }).status).toBe('frozen');
    expect(capitalStatusOf({ equity: -1, loans: 1000 }).status).toBe('insolvent');
    expect(capitalStatusOf({ equity: 0, loans: 0 })).toEqual({ status: 'sound', ratio: null });
  });
});

describe('the partner city that offers the gift', () => {
  test('only a city with no money left is offered one, by the first partner in the catalog\'s order', () => {
    const benefactors = ['olivea', 'silvania', 'briga'];
    expect(benefactorOf({ funds: 50, borrowingOpen: false, partnerIds: ['olivea'], benefactors })).toBeNull();
    expect(benefactorOf({ funds: 0, borrowingOpen: false, partnerIds: [], benefactors })).toBeNull();
    expect(benefactorOf({ funds: 0, borrowingOpen: false, partnerIds: ['briga', 'silvania'], benefactors })).toBe('silvania');
    // A State that can still borrow is not rescued from abroad.
    expect(benefactorOf({ funds: 0, borrowingOpen: true, partnerIds: ['olivea'], benefactors })).toBeNull();
  });
});

describe('the gift is offered only in the first years', () => {
  test('a city out of money is offered nothing once the first years are over', async () => {
    const { BenefactorGift } = await import('../../../src/contexts/accounting/application/services/BenefactorGift.js');
    const saved = [];
    const gift = (year) => new BenefactorGift({
      repository: { get: async () => null, save: async (row) => saved.push(row) },
      cityFunds: async () => 0,
      borrowingOpen: async () => false,
      catalog: { amount: 100, firstYears: 5, benefactors: ['olivea'] },
      getTimeInfo: () => ({ year }),
      cityName: () => 'Olivea',
    });
    expect(await gift(4).offerIfDue({ time: 1, partnerIds: ['olivea'] })).toEqual({ cityId: 'olivea', cityName: 'Olivea', amount: 100 });
    expect(await gift(5).offerIfDue({ time: 1, partnerIds: ['olivea'] })).toBeNull();
    expect(saved).toHaveLength(1);
  });
});

describe('what a State can owe', () => {
  test('the ceiling follows its domestic product, with a minimum for a young State; the headroom is what is left', () => {
    expect(debtCeilingOf({ debt: 0, gdp: 0 })).toEqual({ debt: 0, gdp: 0, ceiling: 5000, headroom: 5000 });
    expect(debtCeilingOf({ debt: 3000, gdp: 20000 })).toEqual({ debt: 3000, gdp: 20000, ceiling: 12000, headroom: 9000 });
    expect(debtCeilingOf({ debt: 15000, gdp: 20000 }).headroom).toBe(0);
  });
});

describe('a loan from a partner city', () => {
  test('its rate is the external loan\'s, plus the spread its lender asks', () => {
    const base = computeLoanRate({ loanType: 'external', financialHealthStatus: 'healthy', policyRate: 0.1 });
    expect(base).toBeCloseTo(0.17);
    expect(computeLoanRate({ loanType: 'external', financialHealthStatus: 'healthy', policyRate: 0.1, lenderSpread: 0.03 })).toBeCloseTo(0.2);
  });
});

describe('a young economy that loses money', () => {
  test('a domestic product below nothing leaves the minimum ceiling, and the day does not fail (regression)', () => {
    expect(debtCeilingOf({ debt: 0, gdp: -54 })).toMatchObject({ ceiling: 5000, headroom: 5000 });
  });
});
