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
  elite: Object.freeze({
    label: 'Élites',
    emoji: '👑',
    singular: 'élite',
    plural: 'élites',
  }),
});

/** @type {Readonly<Record<string, { label: string, emoji: string, singular: string, plural: string }>>} */
export const GROUP_CITIZEN_PRESENTATION = Object.freeze({
  'artisans-ouvriers': Object.freeze({
    label: 'Citoyens artisans',
    emoji: '🔨',
    singular: 'citoyen artisan',
    plural: 'citoyens artisans',
  }),
  commercants: Object.freeze({
    label: 'Citoyens commerçants',
    emoji: '🛒',
    singular: 'citoyen commerçant',
    plural: 'citoyens commerçants',
  }),
  savants: Object.freeze({
    label: 'Citoyens savants',
    emoji: '📚',
    singular: 'citoyen savant',
    plural: 'citoyens savants',
  }),
});

/** @type {Readonly<Record<string, { label: string, emoji: string }>>} */
export const SKILL_PRESENTATION = Object.freeze({
  'subsistence-forager': Object.freeze({ label: 'Chasse-cueillette', emoji: '🏹' }),
  fermier: Object.freeze({ label: 'Fermier', emoji: '🌾' }),
  'vente-alimentaire': Object.freeze({ label: 'Vente alimentaire', emoji: '🛒' }),
  'stockage-alimentaire': Object.freeze({ label: 'Stockage alimentaire', emoji: '🌬️' }),
  governance: Object.freeze({ label: 'Gouvernance', emoji: '👑' }),
  administration: Object.freeze({ label: 'Administration', emoji: '🏛️' }),
  'elder-wisdom': Object.freeze({ label: 'Sagesse', emoji: '📜' }),
  learning: Object.freeze({ label: 'Apprentissage', emoji: '📚' }),
});

export const DEFAULT_RESIDENTIAL_GROUP = 'artisans-ouvriers';

export const PROFILE_DISPLAY_ORDER = Object.freeze([
  'hunter-gatherer',
  'worker',
  'elite',
]);

export const SKILL_DISPLAY_ORDER = Object.freeze([
  'subsistence-forager',
  'fermier',
  'vente-alimentaire',
  'stockage-alimentaire',
  'governance',
  'administration',
  'elder-wisdom',
  'learning',
]);
