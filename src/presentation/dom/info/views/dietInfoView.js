/**
 * Diet (Régime) tab — view layer (DOM only).
 * Displays food stocks and whether the house is fed. Diet variety (which
 * food types were consumed) is a separate, not-yet-built feature — this
 * only tracks total quantity.
 */

/**
 * @typedef {object} DietViewModel
 * @property {{
 *   subsistence: Array<{ emoji: string, value: number, ariaLabel: string }>,
 *   farms: Array<{ emoji: string, value: number, ariaLabel: string }>,
 * }} [stockGroups]
 * @property {{
 *   totalUnfed: number,
 *   month: number | null,
 * }} shortages
 */

/**
 * @param {HTMLElement | null} container
 * @param {DietViewModel | null} model
 */
export function renderDietTab(container, model) {
  if (!container) return;
  container.innerHTML = '';

  if (!model) return;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-diet';

  if (model.stockGroups) {
    wrap.appendChild(createStocksSection(model.stockGroups));
  }

  if (model.shortages) {
    wrap.appendChild(createShortagesSection(model.shortages));
  }

  container.appendChild(wrap);
}

/**
 * @param {{
 *   subsistence: Array<{ emoji: string, value: number, ariaLabel: string }>,
 *   farms: Array<{ emoji: string, value: number, ariaLabel: string }>,
 * }} stockGroups
 */
function createStocksSection(stockGroups) {
  const section = document.createElement('div');
  section.className = 'building-info-diet__section';

  const heading = document.createElement('h3');
  heading.className = 'building-info-diet__heading';
  heading.textContent = 'Stocks actuels';
  section.appendChild(heading);

  if (stockGroups.subsistence?.length > 0) {
    const subsistenceLabel = document.createElement('div');
    subsistenceLabel.className = 'building-info-diet__category-label';
    subsistenceLabel.textContent = 'Subsistance (production propre)';
    section.appendChild(subsistenceLabel);

    section.appendChild(createStockRow(stockGroups.subsistence));
  }

  if (stockGroups.farms?.length > 0) {
    const farmsLabel = document.createElement('div');
    farmsLabel.className = 'building-info-diet__category-label';
    farmsLabel.textContent = 'Marché (fermes)';
    section.appendChild(farmsLabel);

    section.appendChild(createStockRow(stockGroups.farms));
  }

  return section;
}

/**
 * @param {Array<{ emoji: string, value: number, ariaLabel: string }>} items
 */
function createStockRow(items) {
  const row = document.createElement('div');
  row.className = 'building-info-diet__stock-row';

  for (const item of items) {
    const chip = document.createElement('div');
    chip.className = 'building-info-diet__stock-item';
    chip.title = item.ariaLabel;
    chip.setAttribute('aria-label', item.ariaLabel);

    chip.innerHTML = `
      <span class="building-info-diet__stock-emoji" aria-hidden="true">${item.emoji}</span>
      <span class="building-info-diet__stock-value">${item.value}</span>
    `;

    row.appendChild(chip);
  }

  return row;
}

/**
 * @param {{ totalUnfed: number, month: number | null }} shortages
 */
function createShortagesSection(shortages) {
  const section = document.createElement('div');
  section.className = 'building-info-diet__section';

  const heading = document.createElement('h3');
  heading.className = 'building-info-diet__heading';
  heading.textContent = shortages.month != null
    ? `Nourriture (mois #${shortages.month})`
    : 'Nourriture';
  section.appendChild(heading);

  const hasShortage = shortages.totalUnfed > 0;

  const statusLabel = document.createElement('div');
  statusLabel.className = hasShortage
    ? 'building-info-diet__category-label building-info-diet__category-label--warning'
    : 'building-info-diet__category-label';
  statusLabel.textContent = hasShortage ? '⚠️ Manque de nourriture' : '✅ Bien nourrie';
  section.appendChild(statusLabel);

  const totalLine = document.createElement('div');
  totalLine.className = hasShortage
    ? 'building-info-diet__total-unfed'
    : 'building-info-diet__total-unfed building-info-diet__total-unfed--neutral';
  totalLine.textContent = hasShortage
    ? `${shortages.totalUnfed} habitant${shortages.totalUnfed > 1 ? 's' : ''} non nourri${shortages.totalUnfed > 1 ? 's' : ''}`
    : '0 habitant non nourri';
  section.appendChild(totalLine);

  return section;
}
