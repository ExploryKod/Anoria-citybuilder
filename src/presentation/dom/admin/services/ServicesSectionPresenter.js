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
    const board = document.getElementById('services-board');
    if (!board) throw new Error('[services] #services-board is missing from the page');

    const [subsidies, rows, houseMaintenanceSubsidyRate] = await Promise.all([
      this.accounting.getServiceSubsidies(),
      this.construction.listAllBuildingRows(),
      this.accounting.getHouseMaintenanceSubsidyRate(),
    ]);
    const provided = providedServices(rows);

    // The upkeep of the houses: the hamlet pays the share the player sets to the owner (the property company), which bears the rest and covers it with the rents.
    const upkeep = createSliderRow({
      label: 'Entretien des maisons',
      scope: 'Subvention',
      min: this.bounds.houseMaintenanceSubsidyPercent.min,
      max: this.bounds.houseMaintenanceSubsidyPercent.max,
      value: Math.round(houseMaintenanceSubsidyRate * 100),
      unit: '%',
      ariaLabel: "Subvention de l'entretien des maisons, en pourcentage : le hameau paie cette part au propriétaire, qui porte le reste et le couvre avec les loyers",
      store: (value) => this.accounting.setHouseMaintenanceSubsidyRate(value / 100),
    });
    const upkeepHint = document.createElement('p');
    upkeepHint.className = 'commerce-customs-hint';
    upkeepHint.textContent = "Le hameau paie cette part de l'entretien de chaque maison à son propriétaire (la SCI), qui porte le reste : ce sont les loyers qui le couvrent.";

    board.replaceChildren(
      upkeep,
      upkeepHint,
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
