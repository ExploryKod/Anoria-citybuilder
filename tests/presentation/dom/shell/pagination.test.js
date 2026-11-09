/**
 * Long lists show ten entries a page: the slice never goes past the list, a page that no longer exists falls back to the last one, and the bar shows the first, the last and the
 * current page with its neighbours.
 */

import { describe, test, expect } from '@jest/globals';
import { PAGE_SIZE, pageNumbersOf, pageSlice } from '../../../../src/presentation/dom/shell/pagination.js';

const list = Array.from({ length: 27 }, (_, index) => index + 1);

describe('pageSlice', () => {
  test('cuts ten at a time, the last page holds the rest', () => {
    expect(PAGE_SIZE).toBe(10);
    expect(pageSlice(list, 1)).toMatchObject({ page: 1, pageCount: 3, items: list.slice(0, 10) });
    expect(pageSlice(list, 3)).toMatchObject({ page: 3, pageCount: 3, items: [21, 22, 23, 24, 25, 26, 27] });
  });

  test('a page past the end falls back to the last one, an empty list has one page, a page that is no number throws', () => {
    expect(pageSlice(list, 9)).toMatchObject({ page: 3 });
    expect(pageSlice([], 1)).toEqual({ items: [], page: 1, pageCount: 1 });
    expect(() => pageSlice(list, 0)).toThrow(/whole number/);
    expect(() => pageSlice(list, 1.5)).toThrow(/whole number/);
  });
});

describe('pageNumbersOf', () => {
  test('all the pages when there are few, "…" (null) for a gap of several, the page itself for a gap of one', () => {
    expect(pageNumbersOf(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbersOf(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageNumbersOf(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbersOf(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageNumbersOf(10, 10)).toEqual([1, null, 9, 10]);
  });
});
