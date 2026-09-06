/**
 * House — pure format (VM → display models).
 */

import {
  getHouseDwellingLevelAriaLabel,
  getHouseDwellingLevelLabel,
  maxPopulationForLevel,
} from '../../../../../contexts/housing/application/queries/HouseDwellingLevelPresentation.js';
import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import {
  getResidentialGroupTitle,
  residentialGroupForType,
} from '../../../shell/ResidentialGroupLabels.js';
import { computeHouseCitizenComposition } from '../../../../../composition/housingCatalog.js';
import {
  getResourceStockShape,
  getResourceCategoryPresentation,
} from '../../../../../composition/supplyCatalog.js';
import { formatHousePopulationPresentation } from '../../population/formatHousePopulationPresentation.js';

/**
 * "Fed or not" — total quantity only. Diet variety (which food types) is a
 * separate, not-yet-built feature.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ totalUnfed: number, month: number | null }}
 */
function resolveHouseDietShortages(vm) {
  return {
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
 * Savoirs tab — skills grid only. No group/pop chips here: the panel header
 * already shows the residential group and "x/max hab.", so repeating them
 * in the tab body would be pure duplication.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseSkillsModel(vm) {
  const residentialGroup = residentialGroupForType(vm.buildingType);
  const composition = computeHouseCitizenComposition({
    level: vm.houseLevel,
    pop: vm.buildingPop,
    buildingType: vm.buildingType,
    residentialGroup,
  });
  const { skills } = formatHousePopulationPresentation(composition, residentialGroup);

  return {
    skills,
    anchorX: vm.anchorX,
    anchorY: vm.anchorY,
  };
}

/**
 * Ressources tab — one tiny card per resource category the house's stock
 * declares (icon + current amount), plus one card for the aggregate total
 * (have vs. this period's consumption need). Icons/labels come from
 * ResourceCategoryCatalog.js, the category list from the stock itself (see
 * SupplyStock.js / ResourceRolePolicy.getResourceStockShape) — a new
 * resource category needs a catalog entry, never a change here.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseResourcesModel(vm) {
  const stocks = vm.stocks || {};
  const { categories, totalKey } = getResourceStockShape();
  const need = vm.lastConsumption?.demand ?? null;

  const categoryCards = categories.map((category) => {
    const have = Math.max(0, Math.floor(Number(stocks[category]) || 0));
    const { emoji, label } = getResourceCategoryPresentation(category);
    return {
      kind: category,
      icon: emoji,
      label,
      met: have > 0,
      valueText: String(have),
      ariaLabel: `${label} : ${have}`,
    };
  });

  const have = Math.max(0, Math.floor(Number(stocks[totalKey]) || 0));
  const { emoji, label } = getResourceCategoryPresentation(totalKey);
  const totalCard =
    need == null
      ? {
          kind: totalKey,
          icon: emoji,
          label,
          met: have > 0,
          valueText: String(have),
          ariaLabel: `${label} : ${have}`,
        }
      : {
          kind: totalKey,
          icon: emoji,
          label,
          met: have >= need,
          valueText: `${have}/${need}`,
          ariaLabel: `${label} : ${have} sur ${need} nécessaires${have >= need ? ', besoin couvert' : ', besoin non couvert'}`,
        };

  return {
    cards: [...categoryCards, totalCard],
  };
}

/**
 * Diet (régime) tab model — food stocks, consumption, production details.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseDietModel(vm) {
  const model = {
    stockGroups: null,
    shortages: resolveHouseDietShortages(vm),
  };

  // Stocks actuels (déplacé depuis foyer)
  if (vm.stocks && Object.hasOwn(vm.stocks, 'food')) {
    const groups = resolveStockGroups(vm.stocks);
    model.stockGroups = {
      subsistence: groups.subsistence,
      farms: groups.farms,
    };
  }

  return model;
}
