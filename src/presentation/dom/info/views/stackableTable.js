const ROLE_BY_TAG = Object.freeze({ THEAD: 'rowgroup', TBODY: 'rowgroup', TFOOT: 'rowgroup', TR: 'row', TD: 'cell' });

/**
 * A table that the stylesheet lays out as cards (the cells are no longer table cells) still has to be read as a table by a screen reader, which some browsers
 * stop doing once the display changes: its parts say what they are.
 * @param {HTMLTableElement} table
 */
export function keepTableSemantics(table) {
  table.setAttribute('role', 'table');
  for (const part of table.querySelectorAll('thead, tbody, tfoot, tr, th, td')) {
    if (part.tagName === 'TH') {
      part.setAttribute('role', part.closest('thead') ? 'columnheader' : 'rowheader');
    } else {
      part.setAttribute('role', ROLE_BY_TAG[part.tagName]);
    }
  }
}

/**
 * A statement table is laid out as lines when its panel is narrow (game-mobile-portrait.css): each row becomes a small card whose figures sit side by side. A figure
 * then needs to say which column it is in, since the head row is no longer above it: each cell gets the name of its column, which the stylesheet prints over it.
 * Call it once the table has its head and its rows (and again when the rows are filled anew).
 * @param {HTMLTableElement} table
 */
export function labelCells(table) {
  keepTableSemantics(table);
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  for (const row of table.querySelectorAll('tbody tr, tfoot tr')) {
    let column = 0;
    for (const cell of row.children) {
      if (cell.tagName === 'TD' && cell.colSpan === 1 && heads[column]) cell.dataset.label = heads[column];
      column += cell.colSpan;
    }
  }
}
