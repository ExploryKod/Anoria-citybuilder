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

export const DEFAULT_RESIDENTIAL_GROUP = 'artisans';

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

/**
 * Presentation for a tier requirement `kind` (see
 * contexts/housing/domain/policies/HouseTierRequirementPolicy.js) — icon,
 * label, and how to render its current/target numbers. A `kind` with no
 * entry here falls back to a neutral placeholder in the renderer rather
 * than crashing — domain and presentation catalogs can drift out of sync
 * when a new requirement kind ships without its icon yet.
 *
 * `format`:
 *   'boolean'   — current/target are 0|1, render met/unmet only (no "3/1").
 *   'threshold' — render "current/target" (e.g. "0/1 habitant").
 *
 * @type {Readonly<Record<string, { icon: string, label: string, format: 'boolean' | 'threshold', unit?: string }>>}
 */
export const REQUIREMENT_KIND_PRESENTATION = Object.freeze({
  roadAccess: Object.freeze({ icon: '🛣️', label: 'Accès route', format: 'boolean' }),
  population: Object.freeze({ icon: '👥', label: 'Habitants', format: 'threshold', unit: 'hab.' }),
});
