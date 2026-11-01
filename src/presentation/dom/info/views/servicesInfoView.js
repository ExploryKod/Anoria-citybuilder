/**
 * Services tab — view layer (DOM only).
 *
 * One row of chips, no title: all of it is what the house's evolution needs. `items` (Route, Marché reach, Entrepôt
 * activité) are facts the house also depends on, listed first; `evolutionRequirements` are the tier's own requirements.
 * Both use the same chip markup.
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
 * Whether the model has any chip to show: a building with none (a farm, a workshop) has no Services tab or section at all, rather than an empty one.
 * @param {ServicesViewModel | null} model
 * @returns {boolean}
 */
export function hasServicesToShow(model) {
  return Boolean(model?.items?.length || model?.evolutionRequirements?.length);
}

/**
 * @param {HTMLElement | null} container
 * @param {ServicesViewModel | null} model
 */
export function renderServicesTab(container, model) {
  if (!container) return;
  container.innerHTML = '';

  // Everything on this tab is a need of the house's evolution: the tier's requirements, and the facts it also depends on (Route, Marché, the
  // warehouse of its business). One row, no title. A fact the tier already asks for under the same name is said once, as the requirement.
  const requirements = model?.evolutionRequirements ?? [];
  const requirementLabels = new Set(requirements.map((requirement) => requirement.label));
  const chips = [...(model?.items ?? []).filter((item) => !requirementLabels.has(item.label)), ...requirements];
  if (chips.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-services';
  appendServiceRow(wrap, chips);
  container.appendChild(wrap);
}
