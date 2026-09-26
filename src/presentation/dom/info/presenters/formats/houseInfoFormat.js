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
import { buildingName, goodIcon, goodLabel, goodUnit } from '../../../shell/CatalogVocabulary.js';
import { getQuantityConsumerEntries, getQuantityConsumerEntry } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { formatHousePopulationPresentation } from '../../population/formatHousePopulationPresentation.js';

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseLayoutHeader(vm) {
  const group = residentialGroupForType(vm.buildingType);
  const title = group ? getResidentialGroupTitle(group) : buildingName(vm.buildingType);

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

/** A number as the player reads it (0,25 — never 0.25). */
const formatNumber = (value) => Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/**
 * Ressources tab — the house's NEEDS, not its goods: one card per need the catalog gives it (its diet, the
 * goods it wears out...), each reading what was used up last month over what was needed (8/8 = met, 4/8 = half
 * unmet). A need is met by ANY of its goods, so the need is what is counted; the detail of which good satisfied
 * it (wheat, carrot… / pots, plates…) is one click away, under the need it belongs to. The house holds no stock
 * of its own — the hub does — so nothing here reads one; the figures come from each need's own record
 * (`outcomeField`, see ConsumeResource.js). Names and icons come from the catalog (CatalogVocabulary), the needs
 * and their goods from the house's own consumer entries — a new need or good is a catalog entry, never a change here.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseResourcesModel(vm) {
  const entries = vm.buildingType ? getQuantityConsumerEntries(vm.buildingType) : [getQuantityConsumerEntry()];
  return {
    caption: CONSUMED_LAST_MONTH_CAPTION,
    needs: entries.map((entry, index) =>
      needOf(entry, index === 0 ? (vm.lastConsumption ?? null) : (vm.buildingRow?.[entry.outcomeField] ?? null), vm.buildingPop)
    ),
  };
}

/**
 * One need: its own card (used up over needed) and the detail of each of its goods (used up of each).
 * @param {import('../../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts} entry
 * @param {object | null} last The record of its last consumption.
 * @param {number} pop Inhabitants now, for the calculation shown before any consumption is recorded.
 */
function needOf(entry, last, pop) {
  const { categories, totalKey } = entry;
  const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

  const categoryCards = categories.map((category) => {
    const eaten = whole(last?.takenByCategory?.[category]);
    const emoji = goodIcon(category);
    const label = goodLabel(category);
    return {
      kind: category,
      icon: emoji,
      label,
      met: eaten > 0,
      valueText: last ? String(eaten) : NO_MEAL_YET,
      ariaLabel: last ? `${label} : ${eaten} consommé le mois dernier` : `${label} : pas encore de repas`,
    };
  });

  const emoji = goodIcon(totalKey);
  const label = goodLabel(totalKey);
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

  // How the need is worked out, as the catalog declares it: inhabitants × the rate per inhabitant. With a record,
  // it is that month's own (its demand, so the inhabitants it implies), not today's population.
  const rate = Number(entry.amount);
  const inhabitants = last && rate > 0 ? whole(last.demand / rate) : whole(pop);
  // (The result is the figure above it: only the working is said here, with the unit the catalog gives the need.)
  const formula = `Besoin : ${inhabitants} hab. × ${formatNumber(rate)} ${goodUnit(totalKey, rate)}`;

  return { kind: totalKey, card: { ...totalCard, detailText: formula }, details: categoryCards };
}
