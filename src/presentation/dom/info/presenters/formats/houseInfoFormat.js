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

/** Says what the figures of the Ressources tab are: a house keeps no stock, it shows what it ate. */
const CONSUMED_LAST_MONTH_CAPTION = 'Consommé le mois dernier :';
const NO_MEAL_YET = '–';

/**
 * Ressources tab — what the house consumed last month: one tiny card per resource category
 * (icon + units of it eaten), plus one card for the aggregate total, eaten over needed
 * (8/8 = needs met, 4/8 = half of them unmet). The house holds no stock of its own — the hub
 * does — so nothing here reads one; the figures come from the meal's own record
 * (`lastConsumption`, see ConsumeResource.js). Icons/labels come from ResourceCategoryCatalog.js,
 * the category list from the stock shape (see ResourceRolePolicy.getResourceStockShape) — a new
 * resource category needs a catalog entry, never a change here.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseResourcesModel(vm) {
  const { categories, totalKey } = getResourceStockShape();
  const last = vm.lastConsumption ?? null;
  const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

  const categoryCards = categories.map((category) => {
    const eaten = whole(last?.takenByCategory?.[category]);
    const { emoji, label } = getResourceCategoryPresentation(category);
    return {
      kind: category,
      icon: emoji,
      label,
      met: eaten > 0,
      valueText: last ? String(eaten) : NO_MEAL_YET,
      ariaLabel: last ? `${label} : ${eaten} consommé le mois dernier` : `${label} : pas encore de repas`,
    };
  });

  const { emoji, label } = getResourceCategoryPresentation(totalKey);
  const totalCard = last
    ? (() => {
        const eaten = whole(last.taken);
        const need = whole(last.demand);
        const met = need > 0 && eaten >= need;
        return {
          kind: totalKey,
          icon: emoji,
          label,
          met,
          valueText: `${eaten}/${need}`,
          ariaLabel: `${label} : ${eaten} sur ${need} nécessaires le mois dernier${met ? ', besoin couvert' : ', besoin non couvert'}`,
        };
      })()
    : {
        kind: totalKey,
        icon: emoji,
        label,
        met: false,
        valueText: NO_MEAL_YET,
        ariaLabel: `${label} : pas encore de repas`,
      };

  return {
    caption: CONSUMED_LAST_MONTH_CAPTION,
    cards: [...categoryCards, totalCard],
  };
}
