/**
 * A statement table is laid out as lines on a phone held in portrait (game-mobile-portrait.css): each row becomes a small card whose figures sit side by side. A figure
 * then needs to say which column it is in, since the head row is no longer above it: each cell gets the name of its column, which the stylesheet prints over it.
 * Call it once the table has its head and its rows (and again when the rows are filled anew).
 * @param {HTMLTableElement} table
 */
export function labelCells(table) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  for (const row of table.querySelectorAll('tbody tr, tfoot tr')) {
    let column = 0;
    for (const cell of row.children) {
      if (cell.tagName === 'TD' && cell.colSpan === 1 && heads[column]) cell.dataset.label = heads[column];
      column += cell.colSpan;
    }
  }
}
