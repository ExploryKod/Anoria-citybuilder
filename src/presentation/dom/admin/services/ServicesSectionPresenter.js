import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { goodLabel } from '../../shell/CatalogVocabulary.js';
import { createSliderRow } from '../sliderRow.js';

/**
 * The Services tab, for the active hamlet. First the state's two sliders — the reference salary (the base the
 * unemployment allocation is a share of — civil servants themselves were removed, 2026-10-10, "suppress it for
 * now") and the unemployment allocation — then one subsidy slider per social service. A service that no building
 * of the hamlet provides yet is greyed out and disabled: a subsidy needs a service to pay for.
 */
export class ServicesSectionPresenter {
  /** @param {{ accounting: object, construction: object }} deps */
  constructor({ accounting, construction }) {
    this.accounting = accounting;
    this.construction = construction;
    this.bounds = accounting.getFiscalSliderBounds();
  }

  async refresh() {
    const stateBoard = document.getElementById('state-board');
    const board = document.getElementById('services-board');
    if (!stateBoard || !board) throw new Error('[services] #state-board or #services-board is missing from the page');

    const [settings, subsidies, rows] = await Promise.all([
      this.accounting.getSalarySettings(),
      this.accounting.getServiceSubsidies(),
      this.construction.listAllBuildingRows(),
    ]);
    const provided = providedServices(rows);

    stateBoard.replaceChildren(
      createSliderRow({
        label: 'Salaire de référence',
        scope: 'Hameau',
        min: this.bounds.salaryPerMonth.min,
        max: this.bounds.salaryPerMonth.max,
        value: settings.salaryPerMonth,
        unit: '€/mois',
        ariaLabel: "Salaire de référence, en euros par mois — la base de l'allocation chômage",
        store: (value) => this.accounting.setSalarySettings({ salaryPerMonth: value }),
      }),
      createSliderRow({
        label: 'Allocation chômage',
        scope: 'Hameau',
        min: this.bounds.unemploymentBenefitPercent.min,
        max: this.bounds.unemploymentBenefitPercent.max,
        value: Math.round(settings.unemploymentBenefitRate * 100),
        unit: '%',
        ariaLabel: "Allocation chômage, en pourcentage du salaire de référence",
        store: (value) => this.accounting.setSalarySettings({ unemploymentBenefitRate: value / 100 }),
      }),
    );

    board.replaceChildren(
      ...getServiceCategories().map((service) =>
        createSliderRow({
          label: goodLabel(service),
          scope: provided.has(service) ? 'Subvention' : 'Aucun bâtiment',
          active: provided.has(service),
          min: this.bounds.serviceSubsidyPercent.min,
          max: this.bounds.serviceSubsidyPercent.max,
          value: subsidies[service],
          unit: '%',
          ariaLabel: `Subvention du service ${goodLabel(service)}, en pourcentage`,
          dataset: { service },
          store: (value) => this.accounting.setServiceSubsidy(service, value),
        })
      )
    );
  }

}

/**
 * The services the buildings of the given rows provide: a building's `distributor` role names what it gives to houses.
 * @param {ReadonlyArray<{ type: string }>} rows
 * @returns {Set<string>}
 */
export function providedServices(rows) {
  const services = new Set(getServiceCategories());
  const provided = new Set();
  for (const row of rows) {
    for (const entry of getResourceRoles(row.type)) {
      if (entry.role !== 'distributor') continue;
      for (const category of entry.categories) {
        if (services.has(category)) provided.add(category);
      }
    }
  }
  return provided;
}
