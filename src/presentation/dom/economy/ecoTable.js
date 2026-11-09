import { helpSlotHtml } from '../shell/HelpButton.js';
import { html } from '../shell/safeHtml.js';

/**
 * A table of the economy panel: a caption, its column heads, its rows. The first cell of a row is its label (with an optional hint under it); the others are figures, right-aligned. On a phone the heads
 * go and each figure carries its own head above it (`data-label`), the label spanning the row.
 * A "?" (HelpCatalog.js) goes after the caption (`help`) or after a row's label (`row.help`), as `{ id, reading }`, where the term or the figure is not obvious.
 * @param {{ caption: string, heads: string[], rows: Array<{ cells: string[], hint?: string, strong?: boolean, tone?: 'good' | 'bad', bar?: number | null, help?: { id: string, reading?: object } }>, note?: string, help?: { id: string, reading?: object } | null }} table
 * @returns {import('../shell/safeHtml.js').SafeHtml} html: every value is escaped by `html`, and a table can sit inside another html`` without being escaped twice
 */
export function tableHtml({ caption, heads, rows, note = '', warning = '', help = null }) {
  const columns = `minmax(0, 2fr) ${heads.slice(1).map(() => 'minmax(88px, 1fr)').join(' ')}`;
  const head = html`<div class="eco-row eco-head" role="row">${heads.map((label, at) => html`<div role="columnheader" class="${at === 0 ? 'eco-label' : 'eco-figure'}">${label}</div>`)}</div>`;
  const body = rows
    .map(
      (row) => html`<div class="eco-row${row.strong ? ' eco-row--strong' : ''}${row.muted ? ' eco-row--muted' : ''}${row.tone ? ` eco-row--${row.tone}` : ''}" role="row">
      <div role="cell" class="eco-label">${row.cells[0]}${row.help ? helpSlotHtml(row.help.id, row.help.reading) : ''}${row.hint ? html`<small>${row.hint}</small>` : ''}</div>
      ${row.cells
        .slice(1)
        .map((cell, at) => html`<div role="cell" class="eco-figure" data-label="${heads[at + 1]}">${cell}</div>`)}
      ${row.bar === undefined ? '' : html`<span class="eco-bar" aria-hidden="true"><span style="width:${Math.round((row.bar ?? 0) * 100)}%"></span></span>`}
    </div>`,
    );
  return html`<section class="eco-card">
    <h5>${caption}${help ? helpSlotHtml(help.id, help.reading) : ''}</h5>
    <div class="eco-table" role="table" style="--eco-columns:${columns}">${head}${body}</div>
    ${warning ? html`<p class="eco-warning">${warning}</p>` : ''}
    ${note ? html`<p class="eco-note">${note}</p>` : ''}
  </section>`;
}
