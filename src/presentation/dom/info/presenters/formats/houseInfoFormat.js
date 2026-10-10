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
  getConsumerEntries,
  getQuantityConsumerEntry,
  getCycleRecipeEntries,
  getTotalKeyForCategory,
} from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { getServiceCategories } from '../../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { formatHousePopulationPresentation } from '../../population/formatHousePopulationPresentation.js';
import { describeActivitySupplyGap } from '../../../shell/BuildingNotifications.js';
import { getServiceCategoryDisplay } from './serviceCategoryPresentation.js';

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
 * goods it wears out, and now its services too — see below), each reading what was used up last month over
 * what was needed (8/8 = met, 4/8 = half unmet). A need is met by ANY of its goods, so the need is what is
 * counted; the detail of which good satisfied it (wheat, carrot… / pots, plates…) is one click away, under
 * the need it belongs to. The house holds no stock of its own — the hub does — so nothing here reads one;
 * the figures come from each need's own record (`outcomeField`, see ConsumeResource.js). Names and icons
 * come from the catalog (CatalogVocabulary), the needs and their goods from the house's own consumer
 * entries — a new need or good is a catalog entry, never a change here.
 *
 * Services (2026-10-10) sit under their own "Services" need rather than one card each: a service — flag
 * (doctor, school, ...) or quantity (Chapel's faith) alike — is still a consumer entry and still a fact
 * the house consumed or did not, so it belongs here exactly like the diet does. Which categories are
 * "services" is read from the SAME catalog fact the Services tab's evolution requirements and the accounting
 * side already use (ResourceCategoryCatalog's `kind: 'service'`), never a second list.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
export function formatHouseResourcesModel(vm) {
  const entries = vm.buildingType ? getConsumerEntries(vm.buildingType) : [getQuantityConsumerEntry()];
  const serviceCategories = new Set(getServiceCategories());
  const isService = (entry) => entry.categories.some((category) => serviceCategories.has(category));

  const basicNeeds = entries
    .filter((entry) => !isService(entry))
    .map((entry, index) =>
      needOf(
        entry,
        index === 0 ? (vm.lastConsumption ?? null) : (vm.buildingRow?.[entry.outcomeField] ?? null),
        vm.buildingPop,
        vm.buildingRow?.supplyShortfall ?? null,
      )
    );
  const serviceEntries = entries.filter(isService);

  return {
    caption: CONSUMED_LAST_MONTH_CAPTION,
    needs: serviceEntries.length > 0 ? [...basicNeeds, servicesNeedOf(serviceEntries, vm)] : basicNeeds,
  };
}

/**
 * The "Services" need: one sub-card per service the house's catalog gives it, picked together under one
 * aggregate ("6/8 servis") exactly like the diet's own goods sit under "Nourriture". A quantity-mode
 * service (Chapel's faith) reuses `needOf` — it IS an ordinary quantity consumer entry, nothing special
 * about it; a flag-mode one (doctor, school, ...) reads `servedFlags`, the same "served this period" fact
 * the evolution requirements read too (see servicesInfoFormat.js) — this card asks "was I served", that
 * one asks "does it count toward my next tier", so the same fact legitimately appears in both places.
 * @param {ReadonlyArray<import('../../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts>} serviceEntries
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
function servicesNeedOf(serviceEntries, vm) {
  const details = serviceEntries.map((entry) => {
    if ((entry.consumption ?? 'quantity') === 'quantity') {
      return needOf(entry, vm[entry.outcomeField] ?? null, vm.buildingPop, null).card;
    }
    return flagServiceCard(entry.categories[0], vm);
  });
  const metCount = details.filter((detail) => detail.met).length;
  const met = details.length > 0 && metCount === details.length;
  return {
    kind: 'services',
    card: {
      kind: 'services',
      icon: '🤝',
      label: 'Services',
      met,
      valueText: `${metCount}/${details.length}`,
      ariaLabel: `Services : ${metCount} sur ${details.length} servis ce mois-ci`,
    },
    details,
  };
}

/** A flag-mode service's own sub-card: served this period (`servedFlags[category] === periodKey`) or not —
 * cut off (could not pay) or simply not reached, same distinction the evolution requirements chip makes. */
function flagServiceCard(category, vm) {
  const { label, emoji } = getServiceCategoryDisplay(category);
  const met = vm.periodKey != null && vm.servedFlags?.[category] === vm.periodKey;
  const cutOff = vm.buildingRow?.serviceCutOff;
  const insolvable = !met && vm.periodKey != null && cutOff?.monthIndex === vm.periodKey && cutOff?.categories?.includes(category);
  const reason = insolvable ? 'insolvable' : 'inexistant';
  return {
    kind: category,
    icon: emoji,
    label,
    met,
    valueText: met ? '✓' : reason,
    ariaLabel: met ? `${label} servi ce mois-ci` : `${label} non servi : ${reason}`,
  };
}

/**
 * Why a need was not met, in two flash keywords with the units concerned: the source ran out (shortage) or the house could
 * not pay for them (unpaid). The month is the one the consumption record reports; a month not kept shows no keyword.
 * @param {{ current?: object, previous?: object } | null | undefined} shortfall
 * @param {string} totalKey
 * @param {number | null | undefined} month the month of the consumption record
 * @returns {Array<{ kind: 'shortage' | 'unpaid', label: string, units: number }>}
 */
function unmetKeywords(shortfall, totalKey, month) {
  if (!shortfall || month == null) return [];
  const record = [shortfall.current, shortfall.previous].find((candidate) => candidate && candidate.monthIndex === month);
  const figures = record?.byNeed?.[totalKey];
  if (!figures) return [];
  const keywords = [];
  if (figures.shortage > 0) keywords.push({ kind: 'shortage', label: 'Pénurie', units: figures.shortage });
  if (figures.unpaid > 0) keywords.push({ kind: 'unpaid', label: 'Non payé', units: figures.unpaid });
  return keywords;
}

/**
 * One need: its own card (used up over needed) and the detail of each of its goods (used up of each).
 * @param {import('../../../../../shared/building-catalog/buildingCatalog.js').ResourceRoleFacts} entry
 * @param {object | null} last The record of its last consumption.
 * @param {number} pop Inhabitants now, for the calculation shown before any consumption is recorded.
 * @param {object | null} shortfall The house's shortfall of the month (why a need was not met).
 */
function needOf(entry, last, pop, shortfall) {
  const { categories } = entry;
  // A single-category entry legally omits `totalKey` (it's its own total — see buildingCatalog.js's doc
  // and ResourceRolePolicy.getTotalKeyForRole); resolve it the same way instead of assuming it is always
  // explicit, or a quantity-mode need with one good (e.g. Chapel's faith) renders as "…"/"…".
  const totalKey = entry.totalKey ?? getTotalKeyForCategory(categories[0]);
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
          keywords: met ? [] : unmetKeywords(shortfall, totalKey, last.month),
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
 * a SINGLE row of card groups, close together within a group and apart between groups (2026-10-10):
 *   - its raw materials, ONE card even when the recipe has several (the bottleneck ingredient — see
 *     materialCardOf below) — a good-by-good breakdown was redundant with the step cards' own "waiting for
 *     material" wording;
 *   - its manufacturing steps, one card each (a single-step recipe gets a single card), their progress read
 *     from `cycleState` and a stuck step called out from `activityShortfall`;
 *   - what it has finished (its own stock of the good it makes), and what a hub last took of it.
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
  const material = materialCardOf(inputs, lastInputs);

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

  const collected = collectedCardOf(category, productLabel, buildingRow?.activityCollected?.[category]);

  const steps = entry.cycle.map((step, index) => stepCardOf(step, index, entry.cycle.length, cycleState, shortfall));

  return { category, label: productLabel, material, product, collected, steps, gapMessages };
}

/**
 * The raw materials, as ONE card: the bottleneck ingredient (the smallest "taken" of the last cycle), so a
 * recipe with several inputs (carrot cake's wheat/carrot/oil) still reads as a single figure — 0 when any
 * one of them has not moved at all, the same "waiting for material" state the step cards already name in
 * words, just conveyed here by the number alone. `met` only once every input reached its own need.
 * @param {ReadonlyArray<{ category: string, amount: number }>} inputs
 * @param {object | null} lastInputs
 */
function materialCardOf(inputs, lastInputs) {
  const label = 'Matières premières';
  const icon = '🧺';
  if (inputs.length === 0 || !lastInputs) {
    return { kind: 'materials', icon, label, met: false, valueText: NO_CYCLE_YET, ariaLabel: `${label} : pas encore de cycle` };
  }
  const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));
  let minTaken = Infinity;
  let met = true;
  for (const input of inputs) {
    const taken = whole(lastInputs.takenByCategory?.[input.category]);
    if (taken < minTaken) minTaken = taken;
    if (taken < whole(input.amount)) met = false;
  }
  return {
    kind: 'materials',
    icon,
    label,
    met,
    valueText: String(minTaken),
    ariaLabel: met
      ? `${label} : besoin couvert le dernier cycle`
      : `${label} : besoin non couvert le dernier cycle`,
  };
}

/**
 * "Collecté" — when this good actually left the producer for a hub (an entrepôt, the trade
 * warehouse...) and how much, from `activityCollected[category]` (see ProcessHubCollection.js).
 * "Produit fini" alone only says what is sitting here right now — it cannot tell freshly-made
 * stock from a pile nothing has ever come to take.
 */
function collectedCardOf(category, label, lastCollected) {
  const amount = lastCollected ? Math.max(0, Math.floor(Number(lastCollected.amount) || 0)) : 0;
  return {
    kind: `${category}-collected`,
    icon: goodIcon(category),
    label: 'Collecté',
    met: lastCollected != null,
    valueText: lastCollected ? String(amount) : NO_CYCLE_YET,
    ariaLabel: lastCollected
      ? `${label} : ${amount} pris par un entrepôt à la dernière collecte`
      : `${label} : jamais encore pris par un entrepôt`,
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
