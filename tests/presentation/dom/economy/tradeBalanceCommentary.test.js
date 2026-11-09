import { balanceStateOf, commentaryOf, commentaryText } from '../../../../src/presentation/dom/economy/tradeBalanceCommentary.js';

// The commentary reads the state of the balance and the catalog's words: every state must resolve, and each calls for the paragraphs it should.
describe('trade balance commentary', () => {
  const period = (overrides = {}) => ({
    exports: 0, imports: 0, freight: 0, customs: 0, goodsBalance: 0, currentBalance: 0, coverage: null, goods: [], partners: [], partnersKnown: true, ...overrides,
  });
  const dependence = (overrides = {}) => ({ exportPartner: null, importPartner: null, exportGood: null, ...overrides });
  const words = { period: 'ce mois', previous: 'le mois précédent' };
  const read = (parameters) => commentaryOf({ previous: null, interest: null, words, goodName: (good) => `bien:${good}`, cityName: (id) => `ville:${id}`, ...parameters });

  test('the state follows the balance against the purchases, and a side with nothing bought is a surplus with no rate', () => {
    expect(balanceStateOf(period())).toBe('none');
    expect(balanceStateOf(period({ exports: 100, imports: 0, currentBalance: 100 }))).toBe('surplus-only');
    expect(balanceStateOf(period({ exports: 70, imports: 100, currentBalance: -30, coverage: 0.7 }))).toBe('deficit');
    expect(balanceStateOf(period({ exports: 102, imports: 100, currentBalance: 2, coverage: 1.02 }))).toBe('balanced');
    expect(balanceStateOf(period({ exports: 150, imports: 100, currentBalance: 50, coverage: 1.5 }))).toBe('surplus');
  });

  test('a deficit says what weighs, what it costs abroad and what can be done, and names the good and the city', () => {
    const shown = period({
      exports: 70, imports: 100, currentBalance: -30, coverage: 0.7,
      goods: [{ good: 'coal', exports: 0, imports: 100, balance: -100 }, { good: 'wood', exports: 70, imports: 0, balance: 70 }],
      partners: [{ cityId: 'briga', exports: 0, imports: 100, balance: -100 }],
    });
    const entries = read({ shown, year: period({ ...shown, dependence: dependence() }), interest: 25 });
    expect(entries.map((entry) => entry.id)).toEqual(['trade.balance', 'trade.balance.causes', 'trade.balance.interest', 'trade.balance.levers']);
    const text = commentaryText(entries);
    expect(text).toContain('bien:coal');
    expect(text).toContain('ville:briga');
    expect(text).toContain('cède des devises');
  });

  test('a detail by city that is not kept is left out, not guessed: the good alone is named', () => {
    const shown = period({ exports: 10, imports: 100, currentBalance: -90, coverage: 0.1, goods: [{ good: 'coal', exports: 0, imports: 100, balance: -100 }], partnersKnown: false });
    const entries = read({ shown, year: period({ ...shown, dependence: dependence() }) });
    expect(entries.find((entry) => entry.id === 'trade.balance.causes').reading.state).toBe('deficit-goods');
  });

  test('one partner or one good that holds too much of a side is warned of, at its level', () => {
    const shown = period({ exports: 100, imports: 100, coverage: 1 });
    const year = period({ ...shown, dependence: dependence({ exportPartner: { id: 'briga', share: 0.8 }, exportGood: { id: 'wood', share: 0.55 } }) });
    const warnings = read({ shown, year }).filter((entry) => entry.id.startsWith('trade.dependence'));
    expect(warnings.map((entry) => [entry.id, entry.reading.state])).toEqual([['trade.dependence.exportPartner', 'strong'], ['trade.dependence.exportGood', 'warning']]);
    expect(() => commentaryText(warnings)).not.toThrow();
  });
});
