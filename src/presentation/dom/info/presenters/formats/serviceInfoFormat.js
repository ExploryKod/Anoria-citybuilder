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
import { formatWorkplaceEmployeesPanel } from './workplaceEmployeesFormat.js';

/**
 * Curated French label for a service's distributed category — cosmetic
 * only (an unlisted category still displays, just as its raw id): the
 * gameplay-facing catalogs (socialCategoryCatalog.js's `serviceCoverage`
 * requirements, buildingEconomy.js's `resourceRoles` categories) are the
 * single source of truth for which category exists at all.
 * @type {Readonly<Record<string, string>>}
 */
const SERVICE_CATEGORY_LABELS = Object.freeze({
  faith: 'Foi',
  school: 'Éducation',
  library: 'Savoir',
  doctor: 'Soins médicaux',
  hospital: 'Soins hospitaliers',
  publicBath: 'Hygiène publique',
  theatre: 'Spectacles',
  cinema: 'Cinéma',
  pub: 'Convivialité',
});

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
    title: def?.displayName ?? vm.buildingType,
    meta: `📍 (${vm.anchorX}, ${vm.anchorY}) · <span aria-label="${vm.buildingPop} habitants">${vm.buildingPop} hab.</span>`,
    accent: null,
  };
}

export function formatServiceLayoutOptions() {
  return { layout: 'centered', hubOverlayMode: null };
}

/**
 * État tab — operational state + which need this building serves, entirely
 * from catalog facts and the building's own row (roads/employees), same
 * inputs formatWorkplaceEmployeesPanel already reads for the staff tab.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatServiceOverviewModel(vm) {
  const { buildingRow, buildingType } = vm;
  if (!buildingRow?.employees) return null;

  const def = getBuildingDefinition(buildingType);
  const { category, range } = resolveServiceRole(buildingType);
  const roadCount = buildingRow.roads ?? 0;
  const workerNeed = buildingRow.employees.worker_need || 0;
  const worker = buildingRow.employees.worker || 0;

  let state;
  if (roadCount <= 0) {
    state = '🚧 Route nécessaire pour desservir le quartier';
  } else if (workerNeed > 0 && worker === 0) {
    state = '🔴 Inactif : pas d\'employés';
  } else {
    state = '🟢 En service';
  }

  return {
    sections: [{
      title: `État — ${def?.displayName ?? buildingType}`,
      rows: [
        { label: 'État', value: state },
        ...(category
          ? [{ label: 'Service rendu', value: SERVICE_CATEGORY_LABELS[category] ?? category }]
          : []),
        ...(range != null ? [{ label: 'Portée', value: `${range} cases` }] : []),
      ],
    }],
  };
}

/**
 * Staff tab — same generic panel every workplace group uses, with copy
 * built from the building's own displayName instead of hand-written
 * per-building strings (so a new service building needs no new copy here).
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatServiceStaffModel(vm) {
  const name = getBuildingDefinition(vm.buildingType)?.displayName ?? vm.buildingType;
  return formatWorkplaceEmployeesPanel(vm.buildingRow, {
    fullyStaffed: `✅ ${name} fonctionne à plein régime`,
    noWorkers: `❌ ${name} manque de personnel, il ne peut fonctionner`,
    partialWorkers: `⚠️ ${name} tourne au ralenti, faute de personnel suffisant`,
  }, vm.employment);
}
