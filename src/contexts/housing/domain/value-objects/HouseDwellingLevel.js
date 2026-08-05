/**
 * Player-facing names for house dwelling levels (1 | 2).
 *
 * Technical `level` stays in persisted house state and policies; these labels
 * are the shared vocabulary for UI and player messages. Same names for every
 * residential group and house color.
 */

import {
  HOUSE_LEVEL_AUTARKY,
  HOUSE_LEVEL_SPECIALIZED,
} from '../policies/HouseLevelPolicy.js';

/** @typedef {1 | 2} HouseDwellingLevel */

export const HOUSE_DWELLING_LEVELS = Object.freeze({
  [HOUSE_LEVEL_AUTARKY]: Object.freeze({
    level: HOUSE_LEVEL_AUTARKY,
    label: 'cabane',
  }),
  [HOUSE_LEVEL_SPECIALIZED]: Object.freeze({
    level: HOUSE_LEVEL_SPECIALIZED,
    label: 'masure',
  }),
});

/**
 * @param {number | null | undefined} level
 * @returns {HouseDwellingLevel}
 */
export function normalizeHouseDwellingLevel(level) {
  return level === HOUSE_LEVEL_SPECIALIZED ? HOUSE_LEVEL_SPECIALIZED : HOUSE_LEVEL_AUTARKY;
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
  const cabaneLabel = getHouseDwellingLevelLabel(HOUSE_LEVEL_AUTARKY);
  const masureLabel = getHouseDwellingLevelLabel(HOUSE_LEVEL_SPECIALIZED);
  const safePop = Math.max(0, Math.floor(pop) || 0);

  if (normalized === HOUSE_LEVEL_AUTARKY) {
    if (safePop <= 0) {
      return 'Maison vide. Des habitants s\'y installeront avec le temps.';
    }
    if (!hasRoadAccess) {
      return `Cette maison vit en autarcie. Une route et des habitants permettront le passage à la ${masureLabel}.`;
    }
    return `Les conditions sont réunies : la maison peut passer à la ${masureLabel}.`;
  }

  if (!hasRoadAccess) {
    return `Route coupée : la maison risque de redescendre en ${cabaneLabel}.`;
  }

  return 'Foyer intégré à l\'économie de la ville.';
}
