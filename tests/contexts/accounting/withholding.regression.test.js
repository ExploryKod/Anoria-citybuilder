/**
 * The withholding at source: each pay of a household keeps back its share of the employee's contribution and of the household's income tax, which is
 * progressive over everything it receives in the month; the shares add up, to the centime, to what the same bands give on the whole income.
 */
import { describe, test, expect } from '@jest/globals';
import { payslipLegs, planWithholding } from '../../../src/contexts/accounting/domain/policies/WithholdingPolicy.js';
import { assertBalanced } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';
import { withholdIncomeTax } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';

const FLAT_TEN = { threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 };

describe('planWithholding — what each pay of a household keeps back', () => {
  test('a wage keeps back the employee\'s share, and the tax is on what is left', () => {
    const plan = planWithholding({ slots: [{ key: 'w', houseId: 'h', kind: 'wage', gross: 30000 }], employeeRate: 0.1, taxRate: FLAT_TEN });

    expect(plan.get('w')).toEqual({ contribution: 3000, tax: 2700 });
  });

  test('several pays of one household add up, to the centime, to the contribution and the tax of its whole income', () => {
    const slots = [
      { key: 'a', houseId: 'h', kind: 'wage', gross: 10001 },
      { key: 'b', houseId: 'h', kind: 'wage', gross: 20002 },
      { key: 'benefit', houseId: 'h', kind: 'public', gross: 5005 },
      { key: 'other', houseId: 'other-house', kind: 'wage', gross: 10000 },
    ];

    const plan = planWithholding({ slots, employeeRate: 0.1, taxRate: FLAT_TEN });

    const ofHouse = ['a', 'b', 'benefit'].map((key) => plan.get(key));
    const contribution = ofHouse.reduce((sum, pay) => sum + pay.contribution, 0);
    const tax = ofHouse.reduce((sum, pay) => sum + pay.tax, 0);
    expect(contribution).toBe(Math.round(30003 * 0.1));
    expect(tax).toBe(Math.round(withholdIncomeTax({ gross: (30003 - contribution + 5005) / 100, ...FLAT_TEN }).incomeTax * 100));
    // The city's own pay carries no contribution, and another household is another income.
    expect(plan.get('benefit').contribution).toBe(0);
    expect(plan.get('other')).toEqual({ contribution: 1000, tax: 900 });
  });

  test('a progressive tax is on the whole income of the household, not on each pay on its own', () => {
    const bands = { threshold1: 100, rate1: 0.1, threshold2: 200, rate2: 0.2 };
    const together = planWithholding({ slots: [{ key: 'a', houseId: 'h', kind: 'wage', gross: 15000 }, { key: 'b', houseId: 'h', kind: 'wage', gross: 15000 }], employeeRate: 0, taxRate: bands });
    const apart = planWithholding({ slots: [{ key: 'a', houseId: 'h1', kind: 'wage', gross: 15000 }], employeeRate: 0, taxRate: bands });

    expect(together.get('a').tax + together.get('b').tax).toBeGreaterThan(2 * apart.get('a').tax);
  });
});

describe('payslipLegs — the household\'s écriture of a pay', () => {
  test('the gross is credited to what the payer owes, against what is withheld and what reaches the account', () => {
    const legs = payslipLegs({ creditAccount: '421', gross: 30000, contribution: 3000, tax: 2700 });

    expect(legs).toEqual([
      { account: '512', debit: 24300, credit: 0 },
      { account: '431', debit: 3000, credit: 0 },
      { account: '4421', debit: 2700, credit: 0 },
      { account: '421', debit: 0, credit: 30000 },
    ]);
    expect(() => assertBalanced(legs, 'household_wage')).not.toThrow();
  });

  test('a pay that withholds nothing is an écriture of two legs like any other: it has none of its own', () => {
    expect(payslipLegs({ creditAccount: '421', gross: 30000, contribution: 0, tax: 0 })).toBeNull();
  });

  test('a pay cannot withhold more than it pays', () => {
    expect(() => payslipLegs({ creditAccount: '421', gross: 1000, contribution: 800, tax: 500 })).toThrow(/more than it pays/);
  });
});
