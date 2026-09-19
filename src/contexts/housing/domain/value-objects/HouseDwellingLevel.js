/**
 * Player-facing names for house dwelling levels.
 *
 * Technical `level` stays in persisted house state and policies; these labels
 * are the shared vocabulary for UI and player messages. Same names for every
 * residential group and house color. Add a tier here to give it its own
 * label — nothing else in this module is hardcoded to a specific count.
 */

import { HOUSE_LEVEL_AUTARKY } from '../policies/HouseLevelPolicy.js';

/** @typedef {number} HouseDwellingLevel */

export const HOUSE_DWELLING_LEVELS = Object.freeze({
  1: Object.freeze({ level: 1, label: 'cabane' }),
  2: Object.freeze({ level: 2, label: 'masure' }),
  3: Object.freeze({ level: 3, label: 'logis' }),
  4: Object.freeze({ level: 4, label: 'demeure' }),
  5: Object.freeze({ level: 5, label: 'manoir' }),
});

const MAX_DWELLING_LEVEL = Math.max(...Object.keys(HOUSE_DWELLING_LEVELS).map(Number));

/**
 * @param {number | null | undefined} level
 * @returns {HouseDwellingLevel}
 */
export function normalizeHouseDwellingLevel(level) {
  const n = Number.isFinite(level) ? Math.floor(level) : HOUSE_LEVEL_AUTARKY;
  return Object.hasOwn(HOUSE_DWELLING_LEVELS, n) ? n : HOUSE_LEVEL_AUTARKY;
}

/**
 * @param {number | null | undefined} level
 * @returns {string}
 */
export function getHouseDwellingLevelLabel(level) {
  return HOUSE_DWELLING_LEVELS[normalizeHouseDwellingLevel(level)].label;
}

/**
 * @param {number | null | undefined} level
 * @returns {string}
 */
export function getHouseDwellingLevelAriaLabel(level) {
  const normalized = normalizeHouseDwellingLevel(level);
  return `${getHouseDwellingLevelLabel(level)} (niveau ${normalized})`;
}

/**
 * Foyer status copy for a grouped house at a given dwelling level.
 *
 * @param {HouseDwellingLevel} level
 * @param {number} pop
 * @param {boolean} hasRoadAccess
 * @returns {string}
 */
export function resolveHouseDwellingStatusMessage(level, pop, hasRoadAccess) {
  const normalized = normalizeHouseDwellingLevel(level);
  const currentLabel = getHouseDwellingLevelLabel(normalized);
  const nextLabel = normalized < MAX_DWELLING_LEVEL ? getHouseDwellingLevelLabel(normalized + 1) : null;
  const previousLabel = normalized > HOUSE_LEVEL_AUTARKY ? getHouseDwellingLevelLabel(normalized - 1) : null;
  const safePop = Math.max(0, Math.floor(pop) || 0);

  if (normalized === HOUSE_LEVEL_AUTARKY) {
    if (safePop <= 0) {
      return 'Maison vide. Des habitants s\'y installeront avec le temps.';
    }
    if (!hasRoadAccess) {
      return `Cette maison vit en autarcie. Une route et des habitants permettront le passage à la ${nextLabel}.`;
    }
    return `Les conditions sont réunies : la maison peut passer à la ${nextLabel}.`;
  }

  if (!hasRoadAccess && previousLabel) {
    return `Route coupée : la maison risque de redescendre en ${previousLabel}.`;
  }

  if (!nextLabel) {
    return `Foyer établi en ${currentLabel}, au sommet de son évolution.`;
  }

  return 'Foyer intégré à l\'économie de la ville.';
}
