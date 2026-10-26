import { describe, test, expect } from '@jest/globals';
import { FundNewCompanies } from '../../../src/contexts/accounting/application/services/FundNewCompanies.js';
import { foundedAccountsOf, foundingCapitalOf } from '../../../src/contexts/accounting/domain/policies/FoundingCapitalPolicy.js';
import { buildYearClosingLine } from '../../../src/contexts/accounting/domain/policies/YearClosingPolicy.js';
import { balanceSheetOf } from '../../../src/contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { deriveTreasuryFigures } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { booked } from '../../helpers/booked.js';

// The city pays a company its founding capital once, as the company's equity: the company starts with money, the city's treasury pays it as an investment.
function fund(journal, needs) {
  const service = new FundNewCompanies({
    getTimeInfo: () => ({ year: 1, monthIndex: 2, month: 'Mars' }),
    listFoundingNeeds: async () => needs,
    getJournalEntries: async () => journal,
    getCompanyAidPolicy: async () => ({ workingCapitalShare: 0.5, loanShare: 0, shareholderShare: 0 }),
    recordLedgerEntry: async (line) => {
      journal.push(booked({ ...line, year: 1, month: 3 }));
      return { recorded: true };
    },
  });
  return service.execute({ time: 70 });
}

const NEEDS = [{ buildingId: 'farm', accountKind: null, monthlyNeed: 50, stockValue: 0, name: 'Ferme' }];

describe('the founding capital of a company', () => {
  test('the city pays the months of the company\'s charges once: the city\'s holding, the company\'s capital', async () => {
    const journal = [];
    await fund(journal, NEEDS);
    expect(foundingCapitalOf(50)).toBe(10000);
    const paid = journal.find((line) => line.type === 'company_capital_paid');
    const received = journal.find((line) => line.type === 'company_capital_received');
    expect([paid.amount, paid.accountBuildingId]).toEqual([100, null]);
    expect([received.amount, received.accountBuildingId]).toEqual([100, 'farm']);
    await fund(journal, NEEDS);
    expect(journal.filter((line) => line.type === 'company_capital_received')).toHaveLength(1);
  });

  test('a company that carries a stock is also given working capital, in the forms the player\'s policy sets: participation, loan, shareholder', async () => {
    // 50 a month for 2 months, plus 50 % of a stock worth 1000 when full = 500: 20 % lent, 30 % as a shareholder, the rest a participation.
    const journal = [];
    const service = new FundNewCompanies({
      getTimeInfo: () => ({ year: 1, monthIndex: 2, month: 'Mars' }),
      listFoundingNeeds: async () => [{ buildingId: 'mill', accountKind: null, monthlyNeed: 50, stockValue: 1000, name: 'Moulin' }],
      getJournalEntries: async () => journal,
      getCompanyAidPolicy: async () => ({ workingCapitalShare: 0.5, loanShare: 0.2, shareholderShare: 0.3 }),
      recordLedgerEntry: async (line) => {
        journal.push(booked({ ...line, year: 1, month: 3 }));
        return { recorded: true };
      },
    });

    await service.execute({ time: 70 });

    const amountOf = (type) => journal.find((line) => line.type === type)?.amount;
    // 100 of charges + 250 of participation, 150 as a shareholder, 100 lent; each is written on both accounts.
    expect([amountOf('company_capital_received'), amountOf('shareholder_capital_received'), amountOf('aid_loan_received')]).toEqual([350, 150, 100]);
    expect([amountOf('company_capital_paid'), amountOf('shareholder_capital_paid'), amountOf('aid_loan_paid')]).toEqual([350, 150, 100]);
    // The three add up to what the city pays: nothing is lost in the split.
    expect(350 + 150 + 100).toBe(100 + 500);
    // A company funded by a loan alone is funded all the same: it is not funded again the month after.
    expect(foundedAccountsOf([booked({ type: 'aid_loan_received', amount: 100, turn: 70, year: 1, month: 3, accountBuildingId: 'mill', accountKind: null })]).has('mill')).toBe(true);
  });

  test('a company that already has its capital is not funded again, even once the year that paid it is purged', () => {
    const lines = [booked({ type: 'company_capital_received', amount: 150, turn: 70, year: 1, month: 3, accountBuildingId: 'farm', accountKind: null })];
    expect(foundedAccountsOf(lines).has('farm')).toBe(true);
    const closing = buildYearClosingLine({ year: 1, hamletId: 'h', accountBuildingId: 'farm', accountKind: null, lines, getTimeInfo: () => ({ monthIndex: 2 }) });
    expect(foundedAccountsOf([closing]).has('farm')).toBe(true);
  });

  test('the company\'s capital is its equity and its cash; the city\'s payment is an investment, not a running expense', () => {
    const lines = [booked({ type: 'company_capital_received', amount: 150, turn: 70, year: 1, month: 3, accountBuildingId: 'farm', accountKind: null })];
    const sheet = balanceSheetOf(lines, 'farm', { cash: 150, stock: [], currentYear: 1 });
    expect(sheet.liabilities.capital).toBe(150);
    expect(sheet.assets.cash).toBe(150);
    expect(moneyDirectionOf(booked({ type: 'company_capital_paid', amount: 150, turn: 70, accountBuildingId: null }))).toBe('debit');
    const cityLines = [
      booked({ type: 'capital_funds', amount: 500, turn: 0, year: 0, month: 1, hamletId: 'h' }),
      booked({ type: 'company_capital_paid', amount: 150, turn: 70, year: 1, month: 3, hamletId: 'h', description: 'Fonds propres' }),
    ];
    const city = deriveTreasuryFigures(cityLines, { currentTurn: 70 });
    const fold = new LegsFold();
    for (const line of cityLines) fold.add(line);
    expect(fold.balanceOf('512', { accountKey: null })).toBe(35000);
    expect(city.expenses).toBe(0);
    expect(city.totalInvestments).toBe(150);
  });
});
