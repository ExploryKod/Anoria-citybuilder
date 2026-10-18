/**
 * Services tab — view layer (DOM only).
 *
 * Two visually separate rows (2026-10-10): `items` (informative facts — Route, Marché reach, Entrepôt
 * activité — unrelated to tier evolution) render plainly, as before; `evolutionRequirements` render under
 * their own "Besoins pour l'évolution" title, so the player can tell "what my house can reach" apart from
 * "what my house needs to grow" at a glance, even though both use the exact same chip markup.
 */

const SERVICE_DENIED_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m15 9-6 6"></path>
    <path d="m9 9 6 6"></path>
  </svg>
`;

/**
 * @typedef {ReadonlyArray<{ emoji: string, label: string, value: string | null, status: 'ok' | 'off', ariaLabel: string }>} ServiceChipRow
 * @typedef {object} ServicesViewModel
 * @property {ServiceChipRow} items Informative chips — no bearing on tier evolution.
 * @property {ServiceChipRow} [evolutionRequirements] Every tier requirement, uniformly met/unmet.
 */

/**
 * @param {HTMLElement} container
 * @param {ServiceChipRow} chips
 */
function appendServiceRow(container, chips) {
  const row = document.createElement('div');
  row.className = 'building-info-services-row';

  for (const item of chips) {
    const chip = document.createElement('div');
    chip.className = `building-info-service-item building-info-service-item--${item.status}`;
    chip.title = item.ariaLabel;
    chip.setAttribute('aria-label', item.ariaLabel);

    const valueMarkup = item.value == null
      ? `<span class="building-info-service-item__denied">${SERVICE_DENIED_ICON}</span>`
      : `<span class="building-info-service-item__value">${item.value}</span>`;

    chip.innerHTML = `
      <span class="building-info-service-item__emoji" aria-hidden="true">${item.emoji}</span>
      ${valueMarkup}
      <span class="building-info-service-item__label">${item.label}</span>
    `;
    row.appendChild(chip);
  }

  container.appendChild(row);
}

/**
 * @param {HTMLElement | null} container
 * @param {ServicesViewModel | null} model
 */
export function renderServicesTab(container, model) {
  if (!container) return;
  container.innerHTML = '';

  const hasItems = Boolean(model?.items?.length);
  const hasRequirements = Boolean(model?.evolutionRequirements?.length);
  if (!hasItems && !hasRequirements) return;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-services';

  if (hasItems) {
    appendServiceRow(wrap, model.items);
  }

  if (hasRequirements) {
    const title = document.createElement('p');
    title.className = 'building-info-stock-group-label';
    title.textContent = "Besoins pour l'évolution";
    wrap.appendChild(title);
    appendServiceRow(wrap, model.evolutionRequirements);
  }

  container.appendChild(wrap);
}
