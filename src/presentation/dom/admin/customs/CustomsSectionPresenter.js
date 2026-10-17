import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { createSliderRow } from '../sliderRow.js';
import { TAX_COLLECTION_SKILLS } from '../../../../shared/population/socialCategoryCatalog.js';
import { applyTaxCollection } from '../taxCollectionNotice.js';

/** What each flow is called on the page, and who pays the duty. */
const FLOWS = Object.freeze([
  Object.freeze({ id: 'import', listId: 'customs-import-list', scope: 'Importateur' }),
  Object.freeze({ id: 'export', listId: 'customs-export-list', scope: 'Exportateur' }),
]);

/**
 * The Customs section: one customs duty per traded good and per flow, in two lists (what comes in, what goes out).
 * A good appears in a list only if the trade catalog gives it that flow (a city offers it / a city wants it); its
 * range comes from the fiscal catalog and its default from there too. A move shows the value, the release stores it.
 */
export class CustomsSectionPresenter {
  /** @param {{ accounting: object }} deps */
  constructor({ accounting }) {
    this.accounting = accounting;
    this.bounds = accounting.getFiscalSliderBounds().customsPercent;
  }

  /** Reads every duty from its store and draws both lists. */
  async refresh() {
    const [duties, collection] = await Promise.all([this.accounting.listCustomsDuties(), this.accounting.getTaxCollection()]);
    const collected = collection.customs;
    for (const flow of FLOWS) {
      const list = document.getElementById(flow.listId);
      if (!list) throw new Error(`[customs] #${flow.listId} is missing from the page`);
      const rows = duties
        .filter((entry) => entry[flow.id] !== undefined)
        .map((entry) => this.#row(flow, entry.good, entry[flow.id], collected));
      list.replaceChildren(...rows);
    }
    // Nobody collects the customs: every duty is in force at 0 %, shown so and locked, with the reason (see taxCollectionNotice.js).
    const notice = document.getElementById('customs-notice');
    if (!notice) throw new Error('[customs] #customs-notice is missing from the page');
    applyTaxCollection({ collected, skill: TAX_COLLECTION_SKILLS.customs, notice, controls: [] });
  }

  /**
   * @param {{ id: string, scope: string }} flow
   * @param {string} good
   * @param {number} duty A fraction (0.15 = 15 %).
   * @param {boolean} collected false: nobody collects the customs, the duty is shown at 0 % and locked
   */
  #row(flow, good, duty, collected) {
    const label = goodLabel(good);
    return createSliderRow({
      label,
      scope: flow.scope,
      min: this.bounds.min,
      max: this.bounds.max,
      value: collected ? Math.round(duty * 100) : 0,
      active: collected,
      unit: '%',
      ariaLabel: `Droit de douane à ${flow.id === 'import' ? "l'import" : "l'export"} sur ${label}, en pourcentage de la valeur`,
      dataset: { customsGood: good, customsFlow: flow.id },
      store: (percent) => this.accounting.setCustomsDuty(flow.id, good, percent / 100),
    });
  }
}
