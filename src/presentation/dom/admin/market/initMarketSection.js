import { showActiveHamletNameIn } from '../hamletLabel.js';
import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { CLIMATE_PHASES } from '../../../../shared/climate/ClimateCatalog.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A price factor as the player reads it: "+180 %" dearer, "−50 %" cheaper, "normal". @param {number} factor */
const formatChange = (factor) => {
  const percent = Math.round((factor - 1) * 100);
  return percent === 0 ? 'normal' : `${percent > 0 ? '+' : '−'}${Math.abs(percent)} %`;
};

const row = (subject, fact) => {
  const item = el('li', 'ownership-row');
  item.append(el('span', 'ownership-row__subject', subject), el('span', 'ownership-row__fact', fact));
  return item;
};

/**
 * The Marché section (docs/gameplay/PLAN_CRISES.md): what moves the prices. The climate of the year and the yield it gives the fields, how short or plentiful the food is and the
 * price it puts on the shelves, and the world's price of every good the city can trade (it reaches the city only through the trade it makes).
 */
class MarketSectionPresenter {
  /** @param {{ supply: object, trade?: object, getGameTime?: () => number }} deps */
  constructor({ supply, trade, getGameTime }) {
    this.supply = supply;
    this.trade = trade ?? null;
    this.getGameTime = getGameTime;
  }

  #element(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`[market] #${id} is missing from the page`);
    return node;
  }

  async refresh() {
    if (typeof this.getGameTime !== 'function') throw new Error('[market] the section needs the game clock (getGameTime)');
    const period = TimeManager.getTimeInfo(this.getGameTime());
    const climate = await this.supply.getClimateOfYear(period.year);
    this.#element('market-climate').replaceChildren(
      row(CLIMATE_PHASES[climate.phase].label, `Les champs donnent environ ${Math.round(climate.harvestFactor * 100)} % de l'ordinaire`),
    );

    const scarcity = await this.supply.describeScarcity();
    this.#element('market-food').replaceChildren(...scarcity.map((need) => row(
      `Nourriture : ${need.coverMonths.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} mois en réserve, ${need.expectedMonths} attendus`,
      `Prix en rayon : ${formatChange(need.factor)}`,
    )));

    const worldList = this.#element('market-world');
    if (!this.trade) {
      worldList.replaceChildren(el('li', 'ownership-none', 'Aucun commerce possible.'));
      return;
    }
    const prices = await this.trade.getWorldPrices({ year: period.year, monthIndex: period.monthIndex });
    worldList.replaceChildren(...Object.entries(prices).map(([good, index]) => row(goodLabel(good), `Prix mondial : ${formatChange(index)}`)));
  }
}

/** @param {{ supply: object, trade?: object, getGameTime?: () => number }} deps */
export function initMarketSection(deps) {
  const section = document.getElementById('admin-section-market');
  if (!section) return;
  const presenter = new MarketSectionPresenter(deps);
  const open = async () => {
    await showActiveHamletNameIn(section);
    await presenter.refresh();
  };
  new MutationObserver(() => {
    if (section.classList.contains('active')) void open();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void open();
}
