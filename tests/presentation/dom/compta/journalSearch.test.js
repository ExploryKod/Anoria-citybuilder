import {
  matchesSearchWords,
  normalizeForSearch,
  searchWordsOf,
  SEARCH_MAX_LENGTH,
  SEARCH_MAX_WORDS,
} from '../../../../src/presentation/dom/compta/journal/journalSearch.js';

// The search compares what is typed with text; it must never turn it into a pattern or run on without bound.
describe('journal search', () => {
  test('a word matches whatever the accents and the case, several words all have to match', () => {
    const entry = 'Impôt Citoyen — Anoria — 25€ — Tour 12';
    expect(matchesSearchWords(entry, searchWordsOf('impot'))).toBe(true);
    expect(matchesSearchWords(entry, searchWordsOf('CITOYEN anoria'))).toBe(true);
    expect(matchesSearchWords(entry, searchWordsOf('citoyen salaire'))).toBe(false);
    expect(matchesSearchWords(entry, searchWordsOf(''))).toBe(true);
  });

  test('what is typed is compared, never interpreted: pattern characters and markup are plain text', () => {
    const hostile = '(a+)+$ [ \\ .* <img src=x onerror=alert(1)> ';
    expect(() => matchesSearchWords('une écriture', searchWordsOf(hostile))).not.toThrow();
    expect(matchesSearchWords('une écriture', searchWordsOf('.*'))).toBe(false);
    expect(matchesSearchWords('un montant (a+)+$', searchWordsOf('(a+)+$'))).toBe(true);
  });

  test('the search is bounded in length and in words', () => {
    expect(searchWordsOf('x'.repeat(10 * SEARCH_MAX_LENGTH))[0]).toHaveLength(SEARCH_MAX_LENGTH);
    expect(searchWordsOf(Array.from({ length: 50 }, (_, index) => `mot${index}`).join(' '))).toHaveLength(SEARCH_MAX_WORDS);
    expect(normalizeForSearch('  É  t  é ')).toBe('e t e');
  });
});
