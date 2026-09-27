/**
 * Service building (flag-distributor) — pure format.
 *
 * Covers every building whose sole 'distributor' role is 'flag'-mode (marks
 * a nearby consumer "served this period", no stock at all — see
 * ResourceRolePolicy.js / DistributeResourceToConsumers.js): Chapel,
 * School, Library, Doctor, Hospital, PublicBath, Theatre, Cinema, Pub,
 * and any future building shaped the same way. Deliberately ONE format,
 * driven entirely by the building's own catalog facts (displayName,
 * resourceRoles, employment) — a new service building needs a catalog
 * entry only, never a new format/case here (see classifySupplyKind in
 * GetBuildingSupplyView.js for the routing this group is reached through).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { buildingName } from '../../../shell/CatalogVocabulary.js';
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';
import { getServiceCategoryDisplay } from './serviceCategoryPresentation.js';

/**
 * @param {string} buildingType
 * @returns {{ category: string | null, range: number | undefined }}
 */
function resolveServiceRole(buildingType) {
  const role = (getBuildingDefinition(buildingType)?.resourceRoles ?? []).find(
    (entry) => entry.role === 'distributor',
  );
  return { category: role?.categories?.[0] ?? null, range: role?.range };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatServiceLayoutHeader(vm) {
  const def = getBuildingDefinition(vm.buildingType);
  return {
    title: buildingName(vm.buildingType),
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · <span aria-label="${vm.buildingPop} habitants">${vm.buildingPop} hab.</span>`,
    accent: null,
  };
}

export function formatServiceLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * État tab — catalog reference facts only (which need this building serves,
 * how far). Operational status ("no road", "no employees") is a Messages-
 * tab complaint now (see messagesInfoFormat.js's personnelComplaint, which
 * reads this same buildingRow.roads/employees shape) — repeating it here
 * would just be the same fact said twice.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatServiceOverviewModel(vm) {
  const { buildingRow, buildingType } = vm;
  if (!buildingRow?.employees) return null;

  const def = getBuildingDefinition(buildingType);
  const { category, range } = resolveServiceRole(buildingType);

  return {
    sections: [{
      title: `État — ${buildingName(buildingType)}`,
      rows: [
        ...(category
          ? [{ label: 'Service rendu', value: getServiceCategoryDisplay(category).label }]
          : []),
        ...(range != null ? [{ label: 'Portée', value: range === Infinity ? 'illimitée' : `${range} cases` }] : []),
      ],
    }],
  };
}

/**
 * Staff tab — same generic panel every workplace group uses (see
 * workplaceEmployeesFormat.js): staffing numbers only, no per-building
 * copy needed here — "lacks personnel" is a Messages-tab complaint now.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatServiceStaffModel(vm) {
  return formatWorkplaceEmployeesPanel(vm.buildingRow, vm.employment);
}
