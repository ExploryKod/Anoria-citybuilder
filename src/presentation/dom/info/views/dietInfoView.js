/**
 * Diet (Régime) tab — view layer (DOM only).
 * Displays food stocks, consumption, production, and requirements.
 */

/**
 * @typedef {object} DietViewModel
 * @property {{
 *   subsistence: Array<{ emoji: string, value: number, ariaLabel: string }>,
 *   farms: Array<{ emoji: string, value: number, ariaLabel: string }>,
 * }} [stockGroups]
 * @property {{
 *   unfed: Record<string, number>,
 *   totalUnfed: number,
 *   month: number | null,
 * }} shortages
 * @property {object} [lastConsumption]
 * @property {Record<string, number>} [lastConsumption.consumed]
 * @property {number} [lastConsumption.totalUnfed]
 * @property {number} [lastConsumption.month]
 */

const FOOD_EMOJI = Object.freeze({
  fruit: '🍎',
  game: '🦌',
  wheat: '🌾',
  carrot: '🥕',
  cabbage: '🥬',
});

const FOOD_LABELS = Object.freeze({
  fruit: 'Fruits',
  game: 'Gibier',
  wheat: 'Blé',
  carrot: 'Carottes',
  cabbage: 'Choux',
});

const FOOD_TYPE_ORDER = Object.freeze(['fruit', 'game', 'wheat', 'carrot', 'cabbage']);

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

  if (model.lastConsumption) {
    wrap.appendChild(createConsumptionSection(model.lastConsumption));
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
 * @param {{
 *   unfed: Record<string, number>,
 *   totalUnfed: number,
 *   month: number | null,
 * }} shortages
 */
function createShortagesSection(shortages) {
  const section = document.createElement('div');
  section.className = 'building-info-diet__section';

  const heading = document.createElement('h3');
  heading.className = 'building-info-diet__heading';
  heading.textContent = shortages.month != null
    ? `Manques alimentaires (mois #${shortages.month})`
    : 'Manques alimentaires';
  section.appendChild(heading);

  const hasShortage = shortages.totalUnfed > 0
    || Object.values(shortages.unfed || {}).some((qty) => qty > 0);

  const shortageLabel = document.createElement('div');
  shortageLabel.className = hasShortage
    ? 'building-info-diet__category-label building-info-diet__category-label--warning'
    : 'building-info-diet__category-label';
  shortageLabel.textContent = hasShortage ? '⚠️ Manques détectés' : 'Par type de nourriture';
  section.appendChild(shortageLabel);

  const shortageRow = document.createElement('div');
  shortageRow.className = 'building-info-diet__shortage-row';

  for (const type of FOOD_TYPE_ORDER) {
    if (!Object.hasOwn(shortages.unfed, type)) continue;

    const qty = shortages.unfed[type] ?? 0;
    const item = document.createElement('div');
    item.className = qty > 0
      ? 'building-info-diet__shortage-item'
      : 'building-info-diet__shortage-item building-info-diet__shortage-item--neutral';
    const emoji = FOOD_EMOJI[type] || '❓';
    const label = FOOD_LABELS[type] || type;
    const displayValue = qty > 0 ? `-${qty.toFixed(1)}` : '0';

    item.innerHTML = `
      <span aria-hidden="true">${emoji}</span>
      <span class="building-info-diet__shortage-value">${displayValue}</span>
      <span class="building-info-diet__item-label">${label}</span>
    `;
    item.setAttribute(
      'aria-label',
      qty > 0
        ? `Manque de ${qty.toFixed(1)} panier${qty > 1 ? 's' : ''} de ${label.toLowerCase()}`
        : `Aucun manque de ${label.toLowerCase()}`,
    );
    shortageRow.appendChild(item);
  }

  section.appendChild(shortageRow);

  const totalLine = document.createElement('div');
  totalLine.className = shortages.totalUnfed > 0
    ? 'building-info-diet__total-unfed'
    : 'building-info-diet__total-unfed building-info-diet__total-unfed--neutral';
  totalLine.textContent = shortages.totalUnfed > 0
    ? `${shortages.totalUnfed} habitant${shortages.totalUnfed > 1 ? 's' : ''} non nourri${shortages.totalUnfed > 1 ? 's' : ''}`
    : '0 habitant non nourri';
  section.appendChild(totalLine);

  return section;
}

/**
 * @param {{
 *   consumed: Record<string, number>,
 *   totalUnfed: number,
 *   month: number,
 * }} consumption
 */
function createConsumptionSection(consumption) {
  const section = document.createElement('div');
  section.className = 'building-info-diet__section';

  const heading = document.createElement('h3');
  heading.className = 'building-info-diet__heading';
  heading.textContent = `Consommation mois #${consumption.month ?? '?'}`;
  section.appendChild(heading);

  const consumedLabel = document.createElement('div');
  consumedLabel.className = 'building-info-diet__category-label';
  consumedLabel.textContent = 'Consommé';
  section.appendChild(consumedLabel);

  const consumedRow = document.createElement('div');
  consumedRow.className = 'building-info-diet__consumption-row';

  for (const type of FOOD_TYPE_ORDER) {
    if (!Object.hasOwn(consumption.consumed, type)) continue;

    const qty = consumption.consumed[type] ?? 0;
    if (qty <= 0) continue;

    const item = document.createElement('div');
    item.className = 'building-info-diet__consumption-item';
    const emoji = FOOD_EMOJI[type] || '❓';
    const label = FOOD_LABELS[type] || type;
    item.innerHTML = `
      <span aria-hidden="true">${emoji}</span>
      <span>${qty.toFixed(1)}</span>
      <span class="building-info-diet__item-label">${label}</span>
    `;
    consumedRow.appendChild(item);
  }

  section.appendChild(consumedRow);

  return section;
}
