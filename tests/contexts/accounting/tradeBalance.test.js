import { biggestShareOf, tradeBalanceOf, tradeKindOf } from '../../../src/contexts/accounting/domain/policies/TradeBalancePolicy.js';

// The balance is read from the journal's trade lines: its figures must be sums of those lines, nothing else.
describe('trade balance', () => {
  const timeOf = (turn) => ({ year: Math.floor(turn / 100), monthIndex: turn % 12 });
  const line = (turn, type, amount, partnerId = 'silvania') => ({ turn, type, amount, partnerId });

  test('the lines are told apart by their type, and the duty lines are not external flows', () => {
    expect(tradeKindOf('abroad_sale_wheat')).toEqual({ kind: 'exports', good: 'wheat' });
    expect(tradeKindOf('import_coal')).toEqual({ kind: 'imports', good: 'coal' });
    expect(tradeKindOf('customs_import_coal')).toEqual({ kind: 'customsImport', good: 'coal' });
    expect(tradeKindOf('duty_paid_export_wheat')).toBeNull();
    expect(tradeKindOf('salary')).toBeNull();
  });

  test('exports less imports, the freight off for the current balance, the coverage over the imports, the duties apart', () => {
    const entries = [
      line(100, 'abroad_sale_wheat', 300),
      line(100, 'import_coal', 200),
      line(100, 'freight_coal', 20),
      line(100, 'customs_import_coal', 30, 'briga'),
      line(100, 'salary', 999),
    ];
    const { total, months } = tradeBalanceOf({ entries, timeOf, year: 1 });
    expect(total).toMatchObject({ exports: 300, imports: 200, freight: 20, customs: 30, goodsBalance: 100, currentBalance: 80 });
    expect(total.coverage).toBeCloseTo(1.5);
    // The month the lines belong to carries them; the others are empty.
    expect(months).toHaveLength(12);
    expect(months.filter((month) => month.exports > 0)).toHaveLength(1);
  });

  test('a month with no purchase has no coverage rate, not an infinite one', () => {
    const { total } = tradeBalanceOf({ entries: [line(100, 'abroad_sale_wheat', 50)], timeOf, year: 1 });
    expect(total.coverage).toBeNull();
  });

  test('the detail by city and by good is ranked by what weighs most, and a line without a partner is said to be undetailed', () => {
    const entries = [
      line(100, 'abroad_sale_wheat', 100, 'silvania'),
      line(100, 'abroad_sale_wheat', 300, 'briga'),
      line(100, 'import_coal', 50, 'briga'),
    ];
    const { total } = tradeBalanceOf({ entries, timeOf, year: 1 });
    expect(total.partners.map((row) => row.cityId)).toEqual(['briga', 'silvania']);
    expect(total.partnersKnown).toBe(true);
    const closed = tradeBalanceOf({ entries: [{ turn: 100, type: 'abroad_sale_wheat', amount: 10 }], timeOf, year: 1 });
    expect(closed.total.partnersKnown).toBe(false);
    expect(biggestShareOf(total.partners, 'exports')).toEqual({ id: 'briga', share: 0.75 });
  });
});
