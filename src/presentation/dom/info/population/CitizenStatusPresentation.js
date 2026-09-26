/**
 * Presentation — French labels for house info panel (not domain logic).
 */

import { getResidentialGroupLabel } from '../../shell/ResidentialGroupLabels.js';

/** @type {Readonly<Record<string, { label: string, emoji: string, singular: string, plural: string }>>} */
export const STATUS_PRESENTATION = Object.freeze({
  'hunter-gatherer': Object.freeze({
    label: 'Chasseurs-cueilleurs',
    emoji: '🏹',
    singular: 'chasseur-cueilleur',
    plural: 'chasseurs-cueilleurs',
  }),
});

/**
 * The citizens of one social category: named after the category the catalog gives its house
 * (`Artisans-ouvriers` → "citoyens artisans-ouvriers"), so renaming it there renames it here. Only the
 * emoji is a look of this screen.
 * @param {string} group
 * @param {string} emoji
 */
const citizensOf = (group, emoji) =>
  Object.freeze({
    emoji,
    get label() {
      return `Citoyens ${getResidentialGroupLabel(group)}`;
    },
    get singular() {
      return `citoyen (${getResidentialGroupLabel(group).toLowerCase()})`;
    },
    get plural() {
      return `citoyens ${getResidentialGroupLabel(group).toLowerCase()}`;
    },
  });

/** @type {Readonly<Record<string, { label: string, emoji: string, singular: string, plural: string }>>} */
export const GROUP_CITIZEN_PRESENTATION = Object.freeze({
  artisans: citizensOf('artisans', '🔨'),
  merchants: citizensOf('merchants', '🛒'),
  scholars: citizensOf('scholars', '📚'),
});

// Skill display (label/emoji + preferred order) lives in
// shared/population/skillCatalog.js — the one source of truth every skill
// id anywhere (socialCategoryCatalog.js, CitizenStatusCatalog.js,
// buildingEconomy.js's requiredSkill) is drawn from, instead of this file
// keeping its own parallel dictionary that can drift out of sync (it used
// to: two skills went missing here after being added to the catalog).
// See formatHousePopulationPresentation.js for the consumer.

export const DEFAULT_RESIDENTIAL_GROUP = 'artisans';

export const PROFILE_DISPLAY_ORDER = Object.freeze([
  'hunter-gatherer',
  'worker',
]);
