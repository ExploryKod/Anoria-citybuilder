import { buildingCatalog, getBuildingDefinition } from '../../../shared/building-catalog/index.js';
import { getResourceRoles } from '../../../shared/building-catalog/resourceRoleQueries.js';
import { BUILDING_ASSETS } from '../../three/assets/buildingAssets.js';
import {
  getResourceCategoryPresentation,
  hasResourceCategoryPresentation,
} from '../../../composition/supplyCatalog.js';
import { displayMonthByIndex, toDisplayMonth, toDisplaySeason } from '../../../composition/supplyTimeLabels.js';

/**
 * The words the player reads that the catalog decides: a building's name, a good's name and unit, a
 * social category's name, a month or season a schedule names. Every text of the interface that speaks of
 * one of these takes it from here, so a change in the catalog changes the wording everywhere — nothing is
 * spelled out by hand.
 *
 * A term the catalog does not declare is shown as "…" and warned about once (`[vocabulary] …`), never
 * replaced by a made-up word: what still needs a catalog entry, or a text still written by hand, stands
 * out on screen and in the console (`pnpm console:tag vocabulary`).
 */

/** What stands for a term the catalog does not give. */
export const UNRESOLVED_TERM = '…';

const warned = new Set();

/**
 * @param {string} what The kind of term (e.g. 'building name').
 * @param {unknown} id What it was asked for.
 * @returns {string} UNRESOLVED_TERM, after a one-time warning.
 */
export function unresolvedTerm(what, id) {
  const key = `${what}:${id}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[vocabulary] no ${what} declared in the catalog for "${id}" — shown as "${UNRESOLVED_TERM}"`);
  }
  return UNRESOLVED_TERM;
}

/** @param {string} type A building id. @returns {string} Its `displayName`, e.g. "Moulin". */
export function buildingName(type) {
  return getBuildingDefinition(type)?.displayName ?? unresolvedTerm('building name', type);
}

/** @param {string} type @returns {string} `buildingName`, for the middle of a sentence. */
export function buildingNameInSentence(type) {
  const name = buildingName(type);
  return name === UNRESOLVED_TERM ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Every building type that holds a role for some of the given goods — "who does this in the city".
 * @param {import('../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {ReadonlyArray<string>} categories
 * @returns {string[]} Catalog ids, in catalog order.
 */
export function typesHoldingRole(role, categories) {
  return Object.keys(buildingCatalog).filter((type) =>
    getResourceRoles(type).some(
      (entry) => entry.role === role && entry.categories.some((category) => categories.includes(category))
    )
  );
}

/**
 * The names of every building that holds a role for some of the given goods.
 * @param {import('../../../shared/building-catalog/buildingCatalog.js').ResourceRoleKind} role
 * @param {ReadonlyArray<string>} categories
 * @returns {string[]} Distinct names of the buildings the player can build (a legacy variant with no build
 *   button is not one), in catalog order; a warning and one "…" when there is none.
 */
export function namesOfBuildings(role, categories) {
  const buildable = typesHoldingRole(role, categories).filter((type) => BUILDING_ASSETS[type]?.button);
  const names = [...new Set(buildable.map(buildingName))];
  return names.length > 0 ? names : [unresolvedTerm(`building holding the "${role}" role`, categories.join('+'))];
}

/**
 * The names of the natural resources of one kind (the trees that are "wood"), as the catalog names them.
 * @param {string} resource A `naturalResource` kind, e.g. 'wood'.
 * @returns {string[]}
 */
export function namesOfNaturalResource(resource) {
  const names = [
    ...new Set(
      Object.values(buildingCatalog)
        .filter((definition) => definition.naturalResource === resource && definition.displayName)
        .map((definition) => definition.displayName)
    ),
  ];
  return names.length > 0 ? names : [unresolvedTerm('natural resource name', resource)];
}

/**
 * The names of the buildings whose placement needs a hub of this type (a market needs the windmill): what
 * goes with it when it is demolished.
 * @param {string} hubType
 * @returns {string[]}
 */
export function namesOfDependents(hubType) {
  const stored = getResourceRoles(hubType).find((entry) => entry.role === 'hub')?.categories ?? [];
  const names = Object.entries(buildingCatalog)
    .filter(([, definition]) =>
      (definition.placementRequires ?? []).some(
        (requirement) => requirement.role === 'hub' && requirement.categories.some((category) => stored.includes(category))
      )
    )
    .map(([type]) => buildingName(type));
  const distinct = [...new Set(names)];
  return distinct.length > 0 ? distinct : [unresolvedTerm('building depending on a hub', hubType)];
}

/** @param {string} category @returns {string} A good's name, e.g. "Blé". */
export function goodLabel(category) {
  return hasResourceCategoryPresentation(category)
    ? getResourceCategoryPresentation(category).label
    : unresolvedTerm('good name', category);
}

/**
 * @param {string} category
 * @param {number} count
 * @returns {string} The unit that counts this good, agreeing with the count ("panier" up to 1, "paniers" above).
 */
export function goodUnit(category, count) {
  const unit = hasResourceCategoryPresentation(category) ? getResourceCategoryPresentation(category).unit : undefined;
  if (!unit) return unresolvedTerm('unit', category);
  return count > 1 ? unit.many : unit.one;
}

/** @param {string} category @param {number} count @returns {string} e.g. "12 paniers". */
export function goodAmount(category, count) {
  return `${count} ${goodUnit(category, count)}`;
}

/** @param {string} supplyMonth e.g. 'december' @returns {string} e.g. "Décembre". */
export function monthName(supplyMonth) {
  return toDisplayMonth(supplyMonth) ?? unresolvedTerm('month name', supplyMonth);
}

/** @param {string} supplySeason e.g. 'autumn' @returns {string} e.g. "Automne". */
export function seasonName(supplySeason) {
  return toDisplaySeason(supplySeason) ?? unresolvedTerm('season name', supplySeason);
}

/**
 * A catalog schedule (see ResourceSchedulePolicy.js) in words: "Toute l'année", "Décembre", "Automne",
 * "Tous les 2 mois".
 * @param {{ unit: string, values?: Array<string | number>, interval?: number } | null | undefined} schedule
 * @returns {string}
 */
export function scheduleLabel(schedule) {
  if (!schedule) return unresolvedTerm('schedule', 'none');
  if (schedule.unit === 'always') return "Toute l'année";
  if (Array.isArray(schedule.values)) {
    const names = schedule.values.map((value) => {
      if (schedule.unit === 'season') return seasonName(value);
      if (schedule.unit === 'month') return monthName(value);
      if (schedule.unit === 'monthIndex') return displayMonthByIndex(value) ?? unresolvedTerm('month name', value);
      return unresolvedTerm(`name for a "${schedule.unit}"`, value);
    });
    return names.join(', ');
  }
  if (Number.isFinite(schedule.interval) && (schedule.unit === 'monthIndex' || schedule.unit === 'month')) {
    return schedule.interval === 1 ? 'Chaque mois' : `Tous les ${schedule.interval} mois`;
  }
  return unresolvedTerm('schedule wording', schedule.unit);
}
