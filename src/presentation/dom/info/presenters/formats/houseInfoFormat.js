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
import {
  getQuantityConsumerEntries,
  getQuantityConsumerEntry,
  getCycleRecipeEntries,
} from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { formatHousePopulationPresentation } from '../../population/formatHousePopulationPresentation.js';
import { describeActivitySupplyGap } from '../../../shell/BuildingNotifications.js';

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

const NO_CYCLE_YET = '–';

/**
 * Activité tab — the house's OWN business, if its catalog entry gives it one: every 'producer' entry declared
 * as a `cycle` becomes its own block (a house can run more than one, like House-Red's pots and cakes), each
 * showing the same three things regardless of what it makes or how many steps it takes:
 *   - its raw materials, in the same consommé/besoin shape as the Ressources tab's needs (`activityInputs`
 *     keeps what was taken, the catalog's own `amount` is the need — read fresh, never stored twice);
 *   - what it has finished (its own stock of the good it makes);
 *   - its manufacturing steps, one card each (a single-step recipe gets a single card), their progress read
 *     from `cycleState` and a stuck step called out from `activityShortfall`.
 * A house type without any such entry gets an empty list — the tab still renders, saying so.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseActivityModel(vm) {
  const entries = vm.buildingType ? getCycleRecipeEntries(vm.buildingType) : [];
  const gaps = vm.activitySupplyGaps ?? [];
  return { recipes: entries.map((entry) => activityRecipeOf(entry, vm.buildingRow, gaps)) };
}

/**
 * @param {import('../../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts} entry
 * @param {object | null} buildingRow The raw building row (stocks, cycleState, activityShortfall, activityInputs).
 */
function activityRecipeOf(entry, buildingRow, gaps = []) {
  const category = entry.categories[0];
  const recipeGaps = gaps.filter((gap) => gap.category === category);
  const gapMessages = recipeGaps.map((gap) => describeActivitySupplyGap(gap));
  const shortfall = buildingRow?.activityShortfall?.[category] === true;
  const lastInputs = buildingRow?.activityInputs?.[category] ?? null;
  const cycleState = buildingRow?.cycleState?.[category] ?? null;

  const inputs = entry.cycle.flatMap((step) => step.inputs ?? []);
  const materials = inputs.map((input) => materialCardOf(input, lastInputs));

  const stock = Math.max(0, Math.floor(Number(buildingRow?.stocks?.[category]) || 0));
  const productLabel = goodLabel(category);
  const product = {
    kind: category,
    icon: goodIcon(category),
    label: productLabel,
    met: stock > 0,
    valueText: String(stock),
    ariaLabel: `${productLabel} : ${stock} en stock`,
  };

  const steps = entry.cycle.map((step, index) => stepCardOf(step, index, entry.cycle.length, cycleState, shortfall));

  return { category, label: productLabel, materials, product, steps, gapMessages };
}

/**
 * One raw material: what was taken the last cycle it ran, over what the catalog's own step declares — the
 * same "consommé/besoin" pairing as a personal need's card.
 */
function materialCardOf(input, lastInputs) {
  const label = goodLabel(input.category);
  const needed = Math.max(0, Math.floor(Number(input.amount) || 0));
  const taken = lastInputs ? Math.max(0, Math.floor(Number(lastInputs.takenByCategory?.[input.category]) || 0)) : 0;
  const met = lastInputs != null && taken >= needed;
  return {
    kind: input.category,
    icon: goodIcon(input.category),
    label,
    met,
    valueText: lastInputs ? `${taken}/${needed}` : NO_CYCLE_YET,
    ariaLabel: lastInputs
      ? `${label} : ${taken} sur ${needed} consommé le dernier cycle${met ? ', besoin couvert' : ', besoin non couvert'}`
      : `${label} : pas encore de cycle`,
  };
}

/** Structural only ("Étape 1", "Étape 2"...) — the recipe's own step id is an internal catalog word, not one a
 *  player reads (see CatalogVocabulary); a single-step recipe is named for what it does instead of numbered. */
function stepLabel(index, total) {
  return total > 1 ? `Étape ${index + 1}` : 'Fabrication';
}

/**
 * A step's progress, read live from `cycleState[category]` (`{ index, value, opened }`, see ProduceResource.js):
 * a lower index than the step's own means it is done for the cycle under way, the same index means it is the
 * one running now (or stuck on `activityShortfall`), a higher index means it has not started yet.
 */
function stepCardOf(step, index, total, cycleState, shortfall) {
  const label = stepLabel(index, total);
  const currentIndex = cycleState?.index ?? 0;
  const isCurrent = currentIndex === index;
  const stuck = isCurrent && shortfall && (step.inputs?.length ?? 0) > 0;

  let status;
  let met;
  if (currentIndex > index) {
    status = 'Terminée';
    met = true;
  } else if (stuck) {
    status = 'En attente de matière';
    met = false;
  } else if (isCurrent) {
    status = 'En cours';
    met = false;
  } else {
    status = 'À venir';
    met = false;
  }

  return {
    kind: step.id,
    icon: stuck ? '⛔' : met ? '✅' : '⏳',
    label,
    met,
    valueText: status,
    ariaLabel: `${label} : ${status}`,
  };
}
