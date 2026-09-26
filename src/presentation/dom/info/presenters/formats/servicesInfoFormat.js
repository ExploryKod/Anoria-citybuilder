/**
 * Services tab — pure format (VM → display model).
 */

import { residentialGroupForType } from '../../../shell/ResidentialGroupLabels.js';
import { describeRelevantServiceCoverage } from '../../../../../composition/housingCatalog.js';
import { getServiceCategoryDisplay } from './serviceCategoryPresentation.js';
import { getSuppliedCategories, requiresRoad } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { namesOfBuildings } from '../../../shell/CatalogVocabulary.js';

function isResidentialHouse(buildingType) {
  return typeof buildingType === 'string' && buildingType.includes('House');
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
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

    // One chip per service this house needs to reach ITS NEXT tier (its
    // final tier's own services once maxed) — e.g. a tier-1 house shows
    // only Chapel; once it reaches tier 2, the chips update to show
    // Chapel (still met) + Doctor (what unlocks tier 3). See
    // HouseLevelPolicy.describeRelevantServiceCoverage — same "reached or
    // not" question the Route/Marché chips above already answer, just
    // driven by the catalog instead of one hand-picked building.
    const residentialGroup = residentialGroupForType(vm.buildingType);
    const coverage = describeRelevantServiceCoverage({
      level: vm.houseLevel,
      residentialGroup,
      servedFlags: vm.servedFlags,
      periodKey: vm.periodKey,
    });
    for (const requirement of coverage) {
      const { label, emoji } = getServiceCategoryDisplay(requirement.category);
      items.push({
        emoji,
        label,
        value: requirement.met ? '✓' : null,
        status: requirement.met ? 'ok' : 'off',
        ariaLabel: requirement.met ? `${label} à portée` : `${label} hors de portée ou non desservi`,
      });
    }
  }

  return { items };
}
