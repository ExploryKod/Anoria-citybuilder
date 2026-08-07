/**
 * House — pure format (VM → display models).
 */

import {
  getHouseDwellingLevelAriaLabel,
  getHouseDwellingLevelLabel,
  maxPopulationForLevel,
  resolveHouseDwellingStatusMessage,
} from '../../../../../contexts/housing/application/queries/HouseDwellingLevelPresentation.js';
import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import {
  getResidentialGroupTitle,
  residentialGroupForType,
} from '../../../shell/ResidentialGroupLabels.js';
import { getHouseFoodRequirements } from '../../../../../contexts/supply/domain/policies/HouseFoodRequirementsPolicy.js';
import { computeHouseCitizenComposition } from '../../../../../contexts/housing/domain/policies/HouseCitizenCompositionPolicy.js';
import { formatHousePopulationPresentation } from '../../population/formatHousePopulationPresentation.js';

/**
 * @param {1 | 2} level
 * @returns {string[]}
 */
function foodTypesForLevel(level) {
  const requirements = getHouseFoodRequirements(level);
  return [...requirements.essential, ...requirements.desired];
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ unfed: Record<string, number>, totalUnfed: number, month: number | null }}
 */
function resolveHouseDietShortages(vm) {
  const types = foodTypesForLevel(vm.houseLevel);
  /** @type {Record<string, number>} */
  const unfed = Object.fromEntries(types.map((type) => [type, 0]));

  if (vm.lastConsumption?.unfed) {
    for (const type of types) {
      unfed[type] = vm.lastConsumption.unfed[type] ?? 0;
    }
  }

  return {
    unfed,
    totalUnfed: vm.lastConsumption?.totalUnfed ?? 0,
    month: vm.lastConsumption?.month ?? null,
  };
}

function resolveStockGroups(stocks) {
  const wheat = stocks.wheat || 0;
  const cabbage = stocks.cabbage || 0;
  const carrot = stocks.carrot || 0;
  const fruits = stocks.fruit || 0;
  const game = stocks.game || 0;

  return {
    subsistence: [
      { emoji: '🍎', value: fruits, ariaLabel: `Fruits cueillis : ${fruits} panier${fruits > 1 ? 's' : ''}` },
      { emoji: '🦌', value: game, ariaLabel: `Gibier : ${game} panier${game > 1 ? 's' : ''}` },
    ],
    farms: [
      { emoji: '🌾', value: wheat, ariaLabel: `Blé : ${wheat} panier${wheat > 1 ? 's' : ''}` },
      { emoji: '🥬', value: cabbage, ariaLabel: `Légumes verts : ${cabbage} panier${cabbage > 1 ? 's' : ''}` },
      { emoji: '🥕', value: carrot, ariaLabel: `Autres légumes : ${carrot} panier${carrot > 1 ? 's' : ''}` },
    ],
  };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseLayoutHeader(vm) {
  const group = residentialGroupForType(vm.buildingType);
  const title = group ? getResidentialGroupTitle(group) : (getBuildingDefinition(vm.buildingType)?.displayName ?? vm.buildingType);

  const maxPop = maxPopulationForLevel(vm.houseLevel);
  const dwellingLabel = getHouseDwellingLevelLabel(vm.houseLevel);
  const dwellingAria = getHouseDwellingLevelAriaLabel(vm.houseLevel);
  const meta = `<span aria-label="${dwellingAria}">${dwellingLabel}</span> · <span aria-label="${vm.buildingPop} habitants sur ${maxPop}">${vm.buildingPop}/${maxPop} hab.</span>`;

  return { title, meta, accent: group };
}

export function formatHouseLayoutOptions() {
  return {
    layout: 'centered',
    hubOverlayMode: null,
  };
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseFoyerModel(vm) {
  const hasRoadAccess = vm.roadAccess.hasAccess;
  const variant = vm.houseLevel === 2 && !hasRoadAccess ? 'warning' : 'neutral';

  const residentialGroup = residentialGroupForType(vm.buildingType);
  const composition = computeHouseCitizenComposition({
    level: vm.houseLevel,
    pop: vm.buildingPop,
    buildingType: vm.buildingType,
    residentialGroup,
  });
  const { profiles, skills } = formatHousePopulationPresentation(composition, residentialGroup);

  const model = {
    statusMessage: resolveHouseDwellingStatusMessage(vm.houseLevel, vm.buildingPop, hasRoadAccess),
    statusVariant: variant,
    profiles,
    skills,
    anchorX: vm.anchorX,
    anchorY: vm.anchorY,
  };

  return model;
}

/**
 * Diet (régime) tab model — food stocks, consumption, production details.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseDietModel(vm) {
  const model = {
    stockGroups: null,
    shortages: resolveHouseDietShortages(vm),
    lastConsumption: null,
  };

  // Stocks actuels (déplacé depuis foyer)
  if (vm.stocks && Object.hasOwn(vm.stocks, 'food')) {
    const groups = resolveStockGroups(vm.stocks);
    model.stockGroups = {
      subsistence: groups.subsistence,
      farms: groups.farms,
    };
  }

  // Consommation du mois dernier (si disponible)
  if (vm.lastConsumption) {
    model.lastConsumption = {
      month: vm.lastConsumption.month,
      consumed: normalizeFoodRecord(vm.lastConsumption.consumed, vm.houseLevel),
      totalUnfed: vm.lastConsumption.totalUnfed || 0,
    };
  }

  return model;
}

/**
 * @param {Record<string, number> | null | undefined} record
 * @param {1 | 2} level
 * @returns {Record<string, number>}
 */
function normalizeFoodRecord(record, level) {
  const types = foodTypesForLevel(level);
  return Object.fromEntries(types.map((type) => [type, record?.[type] ?? 0]));
}
