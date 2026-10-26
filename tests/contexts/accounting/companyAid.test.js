import { beforeEach, describe, expect, test } from '@jest/globals';
import { SettleCompanyAid } from '../../../src/contexts/accounting/application/services/SettleCompanyAid.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { dividendOf, monthlyInterestOf, repaymentOf, splitWorkingCapital, stakeOf, assertCompanyAidPolicy } from '../../../src/contexts/accounting/domain/policies/CompanyAidPolicy.js';
import { DEFAULT_COMPANY_AID } from '../../../src/contexts/accounting/domain/catalogs/CompanyAidCatalog.js';
import { companyAidOf } from '../../../src/contexts/accounting/domain/policies/CompanyAidLedgerPolicy.js';
import { useHamletForTests } from '../../../src/core/persistence/hamlet/hamletSession.js';
import { booked } from '../../helpers/booked.js';

describe('the rules of the aid the city gives its companies', () => {
  test('the working capital splits to the centime among participation, loan and shareholder, and the policy refuses shares above 1', () => {
    expect(splitWorkingCapital(100001, { loanShare: 0.2, shareholderShare: 0.3 })).toEqual({ participation: 50001, loan: 20000, shareholder: 30000 });
    expect(() => assertCompanyAidPolicy({ ...DEFAULT_COMPANY_AID, loanShare: 0.7, shareholderShare: 0.5 })).toThrow('leave nothing');
    expect(() => assertCompanyAidPolicy({ ...DEFAULT_COMPANY_AID, commitmentYears: 1 })).toThrow('between 2 and 8');
    expect(() => assertCompanyAidPolicy({ ...DEFAULT_COMPANY_AID, commitmentYears: 9 })).toThrow('between 2 and 8');
  });

  test('a loan owes no interest in its grace period, then a twelfth of the annual rate a month', () => {
    const owed = (monthsSinceGranted) => monthlyInterestOf({ outstanding: 120000, annualRate: 0.12, monthsSinceGranted, startsAfterMonths: 6, monthsPerYear: 12 });
    expect([owed(5), owed(6), owed(20)]).toEqual([0, 1200, 1200]);
  });

  test('a company pays back its month\'s profit, no more than it owes and holds, and nothing in a month it lost', () => {
    expect(repaymentOf({ outstanding: 1000, monthResult: 300, cash: 500 })).toBe(300);
    expect(repaymentOf({ outstanding: 200, monthResult: 300, cash: 500 })).toBe(200);
    expect(repaymentOf({ outstanding: 1000, monthResult: 300, cash: 100 })).toBe(100);
    expect(repaymentOf({ outstanding: 1000, monthResult: -50, cash: 500 })).toBe(0);
  });

  test('the stake is what the city put in over the capital, and the dividend is that stake of what can be distributed at the payout rate', () => {
    expect(stakeOf({ shareholderShares: 600, totalShares: 1000 })).toBe(0.6);
    expect(stakeOf({ shareholderShares: 0, totalShares: 0 })).toBe(0);
    // A year's result of 1000 and 4000 made in all: 1000 is distributable; 60 % × 50 % of it is paid.
    expect(dividendOf({ stake: 0.6, payoutRate: 0.5, yearResult: 1000, accumulatedResult: 4000, cash: 5000 })).toBe(300);
    // Losses carried over leave only what has been made in all; no profit, no dividend; never more than the cash.
    expect(dividendOf({ stake: 1, payoutRate: 1, yearResult: 1000, accumulatedResult: 200, cash: 5000 })).toBe(200);
    expect(dividendOf({ stake: 1, payoutRate: 1, yearResult: -10, accumulatedResult: 200, cash: 5000 })).toBe(0);
    expect(dividendOf({ stake: 1, payoutRate: 1, yearResult: 1000, accumulatedResult: 1000, cash: 150 })).toBe(150);
  });
});

describe('SettleCompanyAid', () => {
  let lines;
  let journal;
  let fold;
  const sale = (year, month, amount) => booked({ type: 'producer_revenue', amount: amount / 100, turn: year * 60 + month, year, month, hamletId: 'h', accountBuildingId: 'mill', accountKind: null, journal: 'BQ', legs: [{ account: '512', debit: amount, credit: 0 }, { account: '707', debit: 0, credit: amount }] });
  const service = (cash, time, timeInfo) =>
    new SettleCompanyAid({
      getTimeInfo: () => timeInfo,
      listCompanies: async () => [{ buildingId: 'mill', name: 'Moulin' }],
      getJournalEntries: async () => journal,
      getLegsFold: async () => fold,
      companyFundsOf: async () => cash,
      getCompanyAidPolicy: async () => ({ dividendPayoutRate: 0.5 }),
      recordLedgerEntry: async (line) => {
        lines.push(line);
        return { recorded: true };
      },
    }).execute({ time });

  beforeEach(() => {
    useHamletForTests('h');
    lines = [];
    // The mill was lent 1000 at 12 % a year, interest due after 2 months, in month 1 of year 1; its capital is 400 of participation and 600 as a shareholder.
    journal = [
      booked({ type: 'aid_loan_received', amount: 1000, turn: 61, year: 1, month: 1, accountBuildingId: 'mill', accountKind: null, loan: { interestRate: 0.12, interestStartsAfterMonths: 2 } }),
      booked({ type: 'company_capital_received', amount: 400, turn: 61, year: 1, month: 1, accountBuildingId: 'mill', accountKind: null }),
      booked({ type: 'shareholder_capital_received', amount: 600, turn: 61, year: 1, month: 1, accountBuildingId: 'mill', accountKind: null }),
    ];
    fold = new LegsFold();
    for (const line of [sale(1, 4, 30000), sale(1, 6, 100000)]) fold.add(line);
  });

  test('the company pays its interest once the grace period is over, then pays back the profit of the month', async () => {
    // Month 4 of year 1 (index 3): three months after the loan, interest due: 1000 × 12 % / 12 = 10. The month made 300 of profit and the company holds 500.
    await service(500, 3 * 5, { year: 1, monthIndex: 3, month: 'Avril' });

    const byType = Object.fromEntries(lines.map((line) => [line.type, line.amount]));
    expect(byType).toMatchObject({ aid_interest_paid: 10, aid_interest_received: 10, aid_loan_repaid: 300, aid_loan_repayment_received: 300 });
    // Each is written on both accounts, once for the month.
    expect(lines.find((line) => line.type === 'aid_loan_repaid')).toMatchObject({ accountBuildingId: 'mill' });
    expect(lines.find((line) => line.type === 'aid_loan_repayment_received')).toMatchObject({ accountBuildingId: null });
    expect(new Set(lines.map((line) => line.businessKey)).size).toBeGreaterThan(1);
  });

  test('no interest in the grace period, and no repayment from a month without profit', async () => {
    await service(500, 2 * 5, { year: 1, monthIndex: 1, month: 'Février' });
    expect(lines).toEqual([]);
  });

  test('in January the company pays the city its stake of last year\'s distributable result', async () => {
    // Year 1 made 1300 in all (300 + 1000): the stake is 60 %, the payout rate 50 %: 0.6 × 0.5 × 1300 = 390. The loan is repaid first by nothing: no month result in January.
    await service(5000, 12 * 5, { year: 2, monthIndex: 0, month: 'Janvier' });

    const dividend = lines.find((line) => line.type === 'state_dividend_paid');
    expect(dividend.amount).toBe(390);
    expect(lines.find((line) => line.type === 'state_dividend_received')).toMatchObject({ amount: 390, accountBuildingId: null });
  });

  test('the aid is read from the journal: the loan, its terms, the stake', () => {
    expect(companyAidOf(journal, 'mill')).toMatchObject({ outstanding: 100000, loans: [{ lentKey: 12, principal: 100000, terms: { interestRate: 0.12, interestStartsAfterMonths: 2 } }], shareholderCapital: 60000, totalCapital: 100000, shareholderShares: 600, totalShares: 1000 });
  });

  test('a second loan keeps its own terms, and what is paid back takes off the oldest first', () => {
    const second = booked({ type: 'aid_loan_received', amount: 500, turn: 90, year: 1, month: 6, accountBuildingId: 'mill', accountKind: null, loan: { interestRate: 0.06, interestStartsAfterMonths: 0 } });
    const repaid = booked({ type: 'aid_loan_repaid', amount: 300, turn: 100, year: 1, month: 8, accountBuildingId: 'mill', accountKind: null });

    const aid = companyAidOf([...journal, second, repaid], 'mill');

    expect(aid.outstanding).toBe(120000);
    expect(aid.loans.map((loan) => [loan.outstanding, loan.terms.interestRate])).toEqual([[70000, 0.12], [50000, 0.06]]);
  });
});
