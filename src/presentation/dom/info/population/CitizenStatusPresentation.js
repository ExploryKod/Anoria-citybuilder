/**
 * Presentation — French labels for house info panel (not domain logic).
 */

/** @type {Readonly<Record<string, { label: string, emoji: string, singular: string, plural: string }>>} */
export const STATUS_PRESENTATION = Object.freeze({
  'hunter-gatherer': Object.freeze({
    label: 'Chasseurs-cueilleurs',
    emoji: '🏹',
    singular: 'chasseur-cueilleur',
    plural: 'chasseurs-cueilleurs',
  }),
});

/** @type {Readonly<Record<string, { label: string, emoji: string, singular: string, plural: string }>>} */
export const GROUP_CITIZEN_PRESENTATION = Object.freeze({
  'artisans': Object.freeze({
    label: 'Citoyens artisans',
    emoji: '🔨',
    singular: 'citoyen artisan',
    plural: 'citoyens artisans',
  }),
  merchants: Object.freeze({
    label: 'Citoyens commerçants',
    emoji: '🛒',
    singular: 'citoyen commerçant',
    plural: 'citoyens commerçants',
  }),
  scholars: Object.freeze({
    label: 'Citoyens savants',
    emoji: '📚',
    singular: 'citoyen savant',
    plural: 'citoyens savants',
  }),
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
