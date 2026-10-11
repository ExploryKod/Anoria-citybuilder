/**
 * Every type of line that moves money has its place in the chart of accounts (and so its colour): a new type added to the treasury's
 * rules without one would show in the journal with no account number and no tone. Real catalog and policy; the types are read off the
 * treasury policy's own rules.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';
import { pcgOfJournalType, JOURNAL_TONES, statementLineOfAccount } from '../../../src/shared/accounting-catalog/PcgJournalCatalog.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';

const policySource = fs.readFileSync(
  path.resolve('src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js'),
  'utf8',
);

/** The quoted words of the policy that it treats as a type of money line (a prefix such as `export_` included). */
function moneyTypesOfThePolicy() {
  const words = new Set([...policySource.matchAll(/'([a-z][a-z_]*)'/g)].map((match) => match[1]));
  return [...words].filter((word) => {
    try {
      return ['credit', 'debit'].includes(moneyDirectionOf({ type: word, turn: 0 }));
    } catch {
      return false;
    }
  });
}

describe('PcgJournalCatalog — the journal read in the chart of accounts', () => {
  test('every type of line that moves money sits in an account, with a known tone', () => {
    // The policy's umbrella prefix `duty_paid_` stands for the two flows, each with its own account.
    const types = moneyTypesOfThePolicy().flatMap((type) => (type === 'duty_paid_' ? ['duty_paid_import_coal', 'duty_paid_export_wood'] : [type]));
    expect(types.length).toBeGreaterThan(20);
    for (const type of types) {
      const pcg = pcgOfJournalType(type);
      expect({ type, account: pcg?.account ?? null }).toEqual({ type, account: expect.stringMatching(/^\d{3,4}$/) });
      expect(JOURNAL_TONES).toContain(pcg.tone);
    }
  });

  test('every charge (class 6) and product (class 7) account of a line sits on a line of the compte de résultat', () => {
    const types = moneyTypesOfThePolicy().flatMap((type) => (type === 'duty_paid_' ? ['duty_paid_import_coal', 'duty_paid_export_wood'] : [type]));
    for (const type of types) {
      const pcg = pcgOfJournalType(type);
      if (!pcg || pcg.household || !/^[67]/.test(pcg.account)) continue;
      expect({ type, line: statementLineOfAccount(pcg.account)?.line.id ?? null }).toEqual({ type, line: expect.any(String) });
    }
  });

  test('the trade lines carry their good in their type and still find their account', () => {
    expect(pcgOfJournalType('import_coal')).toMatchObject({ account: '607', tone: 'purchase' });
    expect(pcgOfJournalType('freight_coal')).toMatchObject({ account: '6241', tone: 'external' });
    expect(pcgOfJournalType('abroad_sale_book')).toMatchObject({ account: '707', tone: 'sales' });
  });

  test('every tax and every duty is blue, the lighter blue for what the city receives and the deeper for what is paid', () => {
    for (const type of ['citizen_tax', 'payroll_tax', 'vat', 'corporate_tax_revenue', 'customs_import_coal', 'export_wood']) {
      expect({ type, tone: pcgOfJournalType(type).tone }).toEqual({ type, tone: 'tax-received' });
    }
    for (const type of ['income_tax', 'citizen_tax_paid', 'corporate_tax', 'duty_paid_import_coal', 'duty_paid_export_wood']) {
      expect({ type, tone: pcgOfJournalType(type).tone }).toEqual({ type, tone: 'tax-paid' });
    }
  });

  test('the households\' incomes are a nuance of green of their own', () => {
    for (const type of ['household_wage', 'public_wage', 'household_benefit']) {
      expect(pcgOfJournalType(type).tone).toBe('household');
    }
  });

  test('a type with no account has none: the catalog never invents one', () => {
    expect(pcgOfJournalType('info_loan_interest')).toBeNull();
    expect(pcgOfJournalType('something_new')).toBeNull();
  });
});
