import { html } from './safeHtml.js';

/**
 * Paging of the long lists a player reads (the archives of the dépêches, the chronology of a relation): ten at a time, the rest behind the buttons of a bar at the
 * foot of the list. One convention for all of them: `pageSlice` cuts the list, `pagerHtml` draws the bar, `bindPager` listens to it.
 */

/** How many entries one page shows. */
export const PAGE_SIZE = 10;

/**
 * @template T
 * @param {ReadonlyArray<T>} items the whole list, in the order it is read
 * @param {number} page the page asked for, from 1: a page past the end (the last entry of the last page was deleted) falls back to the last one
 * @param {number} [size]
 * @returns {{ items: T[], page: number, pageCount: number }} `page` is the page really shown
 */
export function pageSlice(items, page, size = PAGE_SIZE) {
  if (!Number.isInteger(page) || page < 1) throw new Error(`[pagination] a page is a whole number from 1, got ${page}`);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const shown = Math.min(page, pageCount);
  return { items: items.slice((shown - 1) * size, shown * size), page: shown, pageCount };
}

/**
 * The page numbers of the bar: the first, the last and the one shown with its two neighbours; a gap of one page shows that page, a longer gap shows "…" (null).
 * @param {number} page @param {number} pageCount @returns {Array<number | null>}
 */
export function pageNumbersOf(page, pageCount) {
  const wanted = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((number) => number >= 1 && number <= pageCount).sort((a, b) => a - b);
  const numbers = [];
  for (const number of wanted) {
    const previous = numbers.at(-1);
    if (previous != null && number - previous === 2) numbers.push(previous + 1);
    else if (previous != null && number - previous > 2) numbers.push(null);
    numbers.push(number);
  }
  return numbers;
}

/**
 * The bar at the foot of a list: previous, the page numbers, next. Nothing when there is one page. The buttons carry `data-page` (the page they lead to).
 * On a phone only the first, the last and the current page stay (the neighbours are `pager__near`, hidden by the stylesheet), so the bar fits one line.
 * @param {{ page: number, pageCount: number }} state
 * @returns {string} markup built with `html` (values escaped)
 */
export function pagerHtml({ page, pageCount }) {
  if (pageCount <= 1) return '';
  const button = (target, label, extra = {}) => html`<button type="button" class="pager__button ${extra.current ? 'pager__button--current' : ''} ${extra.near ? 'pager__near' : ''}"
    data-page="${target}" aria-current="${extra.current ? 'page' : 'false'}" ${extra.disabled ? 'disabled' : ''} aria-label="${extra.label ?? `Page ${target}`}">${label}</button>`;
  const numbers = pageNumbersOf(page, pageCount).map((number) => (number === null
    ? html`<span class="pager__gap" aria-hidden="true">…</span>`
    : button(number, String(number), { current: number === page, near: number !== 1 && number !== pageCount && number !== page })));
  return html`<nav class="pager" aria-label="Pagination">
    ${button(Math.max(1, page - 1), '‹', { disabled: page === 1, label: 'Page précédente' })}
    ${numbers}
    ${button(Math.min(pageCount, page + 1), '›', { disabled: page === pageCount, label: 'Page suivante' })}
  </nav>`;
}

/**
 * Listens to the bars inside a container (one listener, whatever is drawn again under it): a press on a page button calls `onPage` with the page it leads to.
 * @param {HTMLElement} container @param {(page: number) => void} onPage
 */
export function bindPager(container, onPage) {
  container.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.pager [data-page]');
    if (!button || button.disabled || !container.contains(button)) return;
    onPage(Number(button.dataset.page));
  });
}
