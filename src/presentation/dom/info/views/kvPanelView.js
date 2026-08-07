/**
 * Shared KV panel — view only (DOM).
 * Renders into the given container (tab panel), never into a global foyer target.
 */

/**
 * @param {HTMLElement} container
 * @param {import('../buildingInfoTypes.js').InfoKvPanelModel | null} model
 */
export function renderKvPanelView(container, model) {
  if (!container || !model?.sections?.length) return;

  container.innerHTML = '';

  for (const section of model.sections) {
    const title = document.createElement('h3');
    title.className = 'info-section-title';
    title.textContent = section.title;
    container.appendChild(title);

    for (const row of section.rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kv-row';

      const k = document.createElement('div');
      k.className = 'kv-key';
      k.textContent = row.label;

      const v = document.createElement('div');
      v.className = 'kv-value';
      v.textContent = row.value !== undefined && row.value !== null ? String(row.value) : '';

      if (row.subtext) {
        const sub = document.createElement('div');
        sub.className = 'kv-subtext';
        sub.textContent = row.subtext;
        sub.style.cssText =
          'color: #888; font-size: 11px; font-style: italic; font-weight: 400; margin-top: 2px;';
        v.appendChild(sub);
      }

      rowEl.appendChild(k);
      rowEl.appendChild(v);
      container.appendChild(rowEl);
    }

    for (const banner of section.banners ?? []) {
      const p = document.createElement('p');
      p.className = `anoria-text info-building-item building-info-status building-info-status--${banner.variant ?? 'neutral'}`;
      p.setAttribute('role', 'status');
      p.textContent = banner.text;
      container.appendChild(p);
    }
  }
}
