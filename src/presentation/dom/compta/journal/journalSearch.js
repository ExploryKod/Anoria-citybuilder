/**
 * The journal's search, as pure rules over text. What the player types is only ever *compared* with text: it is never written into the page as markup, never turned into a
 * regular expression (no pattern to inject, no catastrophic backtracking), and its length is bounded. A word matches whatever the accents and the case; several words all
 * have to match (an AND), in any order.
 */

/** The longest search kept: what is typed beyond is ignored. */
export const SEARCH_MAX_LENGTH = 60;

/** The most words a search is made of: what is typed beyond is ignored. */
export const SEARCH_MAX_WORDS = 8;

/**
 * @param {unknown} value
 * @returns {string} the text in the form it is compared in: no accent, lower case, single spaces
 */
export function normalizeForSearch(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} typed what the player typed
 * @returns {string[]} the words to look for (none: nothing is filtered)
 */
export function searchWordsOf(typed) {
  const normalized = normalizeForSearch(String(typed).slice(0, SEARCH_MAX_LENGTH));
  return normalized === '' ? [] : normalized.split(' ').slice(0, SEARCH_MAX_WORDS);
}

/**
 * @param {string} text the text of an entry, as the player reads it
 * @param {string[]} words from `searchWordsOf`
 * @returns {boolean} whether every word is somewhere in the text
 */
export function matchesSearchWords(text, words) {
  const haystack = normalizeForSearch(text);
  return words.every((word) => haystack.includes(word));
}
