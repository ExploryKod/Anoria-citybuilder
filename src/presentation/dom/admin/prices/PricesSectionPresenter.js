import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { getWorldCityById } from '../../../../composition/worldCityCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';

/** The colour family of each step of a price (the same blue for every tax, so the duty and the VAT read as the State's share). */
const STEP_TONES = Object.freeze({
  reference: 'neutral',
  city: 'neutral',
  producer: 'sales',
  transport: 'external',
  duty: 'tax-paid',
  merchants: 'personnel',
  warehouse: 'purchase',
  market: 'sales',
  vat: 'tax-paid',
});

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * The Prices section: for each good that reaches the shelves, what a unit costs at every step from the reference price to what a house
 * pays, so the player sees what the customs duty, the freight, the margins and the VAT each add (the effect of the levers of the Douanes and
 * Taxes sections). Read from the catalogs and the prices in force this month (`trade.getPriceWaterfalls`); nothing is stored.
 */
export class PricesSectionPresenter {
  /** @param {{ trade: { getPriceWaterfalls: () => Promise<object[]> } }} deps */
  constructor({ trade }) {
    this.trade = trade;
  }

  async refresh() {
    const list = document.getElementById('prices-list');
    if (!list) throw new Error('[prices] #prices-list is missing from the page');
    list.replaceChildren(el('p', 'commerce-customs-hint', '…'));
    const waterfalls = await this.trade.getPriceWaterfalls();
    if (waterfalls.length === 0) {
      list.replaceChildren(el('p', 'commerce-customs-hint', "Aucun bien n'est encore vendu : il faut un entrepôt et un marché qui en tiennent."));
      return;
    }
    list.replaceChildren(...waterfalls.map((waterfall) => this.#card(waterfall)));
  }

  /** @param {{ good: string, origin: string | null, steps: Array<{ id: string, label: string, amount: number, price: number }>, priceTTC: number, dutyShare: number }} waterfall */
  #card(waterfall) {
    const card = el('section', 'price-card');
    const title = el('h3', 'price-card-title', goodLabel(waterfall.good));
    if (waterfall.origin) title.append(el('span', 'building-finance-pill price-card-origin', `Import — ${getWorldCityById(waterfall.origin)?.name ?? waterfall.origin}`));
    card.append(title);

    // The bar: each step is a segment as wide as what it adds to the final price (the reference is the first).
    const bar = el('div', 'price-bar');
    for (const step of waterfall.steps) {
      if (step.id === 'reference' ? false : step.amount <= 0) continue;
      const segment = el('span', 'price-bar-segment');
      segment.dataset.step = STEP_TONES[step.id];
      segment.style.flexGrow = String(step.id === 'reference' ? step.price : step.amount);
      segment.title = `${step.label} : ${formatEuro(step.amount)}`;
      bar.append(segment);
    }
    card.append(bar);

    const table = el('table', 'price-table');
    for (const step of waterfall.steps) {
      const row = el('tr');
      row.dataset.step = STEP_TONES[step.id];
      const label = el('th', null, step.label);
      row.append(label, el('td', 'price-amount', step.id === 'reference' ? '' : `${step.amount >= 0 ? '+' : ''}${formatEuro(step.amount)}`), el('td', 'price-total', formatEuro(step.price)));
      table.append(row);
    }
    card.append(table);

    if (waterfall.dutyShare > 0) {
      card.append(el('p', 'commerce-customs-hint', `Les droits de douane sont ${Math.round(waterfall.dutyShare * 100)} % du prix payé par la maison.`));
    }
    return card;
  }
}
