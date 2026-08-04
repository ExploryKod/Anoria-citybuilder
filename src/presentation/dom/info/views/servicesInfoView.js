/**
 * Services tab — view layer (DOM only).
 */

const SERVICE_DENIED_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m15 9-6 6"></path>
    <path d="m9 9 6 6"></path>
  </svg>
`;

/**
 * @typedef {object} ServicesViewModel
 * @property {ReadonlyArray<{
 *   emoji: string,
 *   label: string,
 *   value: string | null,
 *   status: 'ok' | 'off',
 *   ariaLabel: string,
 * }>} items
 */

/**
 * @param {HTMLElement | null} container
 * @param {ServicesViewModel | null} model
 */
export function renderServicesTab(container, model) {
  if (!container) return;
  container.innerHTML = '';

  if (!model?.items?.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-services';

  const row = document.createElement('div');
  row.className = 'building-info-services-row';

  for (const item of model.items) {
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

  wrap.appendChild(row);
  container.appendChild(wrap);
}
