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
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseLayoutHeader(vm) {
  const group = residentialGroupForType(vm.buildingType);
  const title = group ? getResidentialGroupTitle(group) : (getBuildingDefinition(vm.buildingType)?.displayName ?? vm.buildingType);

  const maxPop = maxPopulationForLevel(vm.houseLevel, group);
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
