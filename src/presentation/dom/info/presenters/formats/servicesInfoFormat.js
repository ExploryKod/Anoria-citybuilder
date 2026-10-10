/**
 * Services tab — pure format (VM → display model).
 *
 * Two sections, kept visually and structurally apart (2026-10-10):
 *  - `items`: informative facts with no bearing on tier evolution (Route, Marché reach, Entrepôt
 *    (activité)) — a farm or a workshop gets these too, nothing here assumes a social-category tier
 *    ladder exists.
 *  - `evolutionRequirements`: every requirement the house's CURRENT/NEXT tier declares (road,
 *    population, food, goods variety, a named service's coverage or demand), each read as a plain
 *    met/unmet fact — never a number, even where the underlying figure is one (population, food). The
 *    number already lives elsewhere (the panel header, the Ressources tab); this section only answers
 *    "does it count toward evolving".
 */

import { residentialGroupForType } from '../../../shell/ResidentialGroupLabels.js';
import { describeRelevantServiceCoverage } from '../../../../../composition/housingCatalog.js';
import { getServiceCategoryDisplay } from './serviceCategoryPresentation.js';
import {
  getCycleRecipeEntries,
  getSuppliedCategories,
  requiresRoad,
} from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { goodIcon, goodLabel, namesOfBuildings } from '../../../shell/CatalogVocabulary.js';

function isResidentialHouse(buildingType) {
  return typeof buildingType === 'string' && buildingType.includes('House');
}

/**
 * Icon + label for an evolution requirement. Named services (serviceCoverage/serviceDemandMet) read the
 * same presentation the Ressources tab's Services group and the old Services-tab chips always used.
 * `demandMet`/`goodsVariety` have no `category` of their own (they are always about the house's diet/goods
 * needs by design — see HouseTierRequirementPolicy.js's scope note) so they read the catalog's own
 * 'food'/'goods' presentation instead. An unrecognized kind is a catalog defect, not a "show something
 * anyway" case — it throws, naming the kind, so the gap is obvious instead of silently blank.
 * @param {{ kind: string, category?: string }} requirement
 */
function evolutionRequirementDisplay(requirement) {
  if (requirement.kind === 'serviceCoverage' || requirement.kind === 'serviceDemandMet') {
    return getServiceCategoryDisplay(requirement.category);
  }
  if (requirement.kind === 'roadAccess') return { emoji: '🛣️', label: 'Route' };
  if (requirement.kind === 'population') return { emoji: '👥', label: 'Population' };
  if (requirement.kind === 'demandMet') return { emoji: goodIcon('food'), label: goodLabel('food') };
  if (requirement.kind === 'goodsVariety') return { emoji: goodIcon('goods'), label: goodLabel('goods') };
  throw new Error(`[servicesInfoFormat] unknown tier requirement kind "${requirement.kind}" has no display`);
}

/**
 * One evolution-requirement chip: met or not, nothing in between, nothing numeric.
 * @param {{ kind: string, category?: string, met: boolean }} requirement
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
function evolutionRequirementItem(requirement, vm) {
  const { emoji, label } = evolutionRequirementDisplay(requirement);
  if (requirement.kind === 'serviceCoverage' || requirement.kind === 'serviceDemandMet') {
    // A service the house could not pay for this month is cut off, not absent: the chip says which it is.
    const cutOff = vm.buildingRow?.serviceCutOff;
    const insolvable = !requirement.met && vm.periodKey != null && cutOff?.monthIndex === vm.periodKey && cutOff?.categories?.includes(requirement.category);
    const reason = insolvable ? 'insolvable' : 'inexistant';
    return {
      emoji,
      label,
      value: requirement.met ? '✓' : reason,
      status: requirement.met ? 'ok' : 'off',
      ariaLabel: requirement.met ? `${label} à portée` : `${label} non servi : ${reason}`,
    };
  }
  return {
    emoji,
    label,
    value: requirement.met ? '✓' : null,
    status: requirement.met ? 'ok' : 'off',
    ariaLabel: requirement.met ? `${label} : besoin couvert` : `${label} : besoin non couvert`,
  };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{
 *   items: ReadonlyArray<{ emoji: string, label: string, value: string | null, status: 'ok' | 'off', ariaLabel: string }>,
 *   evolutionRequirements: ReadonlyArray<{ emoji: string, label: string, value: string | null, status: 'ok' | 'off', ariaLabel: string }>,
 * }}
 */
export function formatServicesModel(vm) {
  const roadCount = vm.roadAccess?.roadCount ?? 0;
  // A type the catalog declares `requiresRoad: false` has no road status to lose: always positive.
  const roadRequired = requiresRoad(vm.buildingType);
  const hasRoad = !roadRequired || vm.roadAccess?.hasAccess === true || roadCount > 0;

  /** @type {ReadonlyArray<{
   *   emoji: string,
   *   label: string,
   *   value: string | null,
   *   status: 'ok' | 'off',
   *   ariaLabel: string,
   * }>} */
  const items = [
    {
      emoji: '🛣️',
      label: 'Route',
      value: !roadRequired ? '✓' : hasRoad ? String(roadCount) : null,
      status: hasRoad ? 'ok' : 'off',
      ariaLabel: !roadRequired
        ? 'Route non requise'
        : hasRoad
          ? `${roadCount} route${roadCount > 1 ? 's' : ''} à portée`
          : 'Aucune route à portée',
    },
  ];

  const evolutionRequirements = [];

  if (isResidentialHouse(vm.buildingType)) {
    const hasMarket = vm.supplyView?.marketTooFar !== true;
    // What feeds the house, named as the catalog names those buildings.
    const suppliers = namesOfBuildings('distributor', getSuppliedCategories()).join('/');
    items.push({
      emoji: '🏪',
      label: suppliers,
      value: hasMarket ? '✓' : null,
      status: hasMarket ? 'ok' : 'off',
      ariaLabel: hasMarket ? `${suppliers} à portée` : `${suppliers} hors de portée`,
    });

    // Whether this house's OWN business (its `cycle` recipes, see the Activité tab) can even reach a hub for
    // its raw material — a house with no business of its own (getCycleRecipeEntries empty) gets no chip at
    // all, nothing to say. `activitySupplyGaps` only carries 'no-hub' (reachability) and 'no-supplier'
    // (nothing feeds a reachable hub); only the first one is what "access to the warehouse" means here — the
    // second is a business problem, not an access one, and is said in the Activité tab instead.
    if (getCycleRecipeEntries(vm.buildingType).length > 0) {
      const hasHubAccess = !(vm.activitySupplyGaps ?? []).some((gap) => gap.status === 'no-hub');
      items.push({
        emoji: '📦',
        label: 'Entrepôt (activité)',
        value: hasHubAccess ? '✓' : null,
        status: hasHubAccess ? 'ok' : 'off',
        ariaLabel: hasHubAccess
          ? 'Entrepôt accessible pour son activité'
          : "Aucun entrepôt accessible : pas d'activité possible",
      });
    }

    // Every requirement the house's CURRENT/NEXT tier declares (road excluded — see
    // HouseLevelPolicy.relevantServiceCoverageRequirements) — a tier-1 house shows only Chapel's faith;
    // once it reaches tier 2, Doctor joins it, and so on.
    const residentialGroup = residentialGroupForType(vm.buildingType);
    const coverage = describeRelevantServiceCoverage({
      level: vm.houseLevel,
      residentialGroup,
      pop: vm.buildingPop,
      servedFlags: vm.servedFlags,
      lastConsumption: vm.lastConsumption,
      lastFaithConsumption: vm.lastFaithConsumption,
      periodKey: vm.periodKey,
    });
    for (const requirement of coverage) {
      evolutionRequirements.push(evolutionRequirementItem(requirement, vm));
    }
  }

  return { items, evolutionRequirements };
}
