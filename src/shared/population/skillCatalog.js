/**
 * Single source of truth for every citizen skill's DISPLAY metadata
 * (label, emoji).
 *
 * Skill ids themselves are declared elsewhere — as bare strings — by
 * whichever catalog grants or requires them: socialCategoryCatalog.js's
 * tiers, CitizenStatusCatalog.js's per-status skills, buildingEconomy.js's
 * `employment.requiredSkill`. None of those files know or care how a skill
 * looks to a player; this file is the one place that says so, so it's the
 * one place to touch when a skill is added — presentation derives from it
 * instead of keeping its own parallel dictionary that can silently drift
 * out of sync (see presentation/dom/info/population/CitizenStatusPresentation.js,
 * which used to duplicate this and forgot two skills' worth of entries).
 *
 * Key insertion order doubles as preferred display order — no separate
 * order list needed. A skill missing from here still displays (see
 * `getSkillDisplay`'s fallback below), just without a curated
 * label/emoji/position until one is added.
 *
 * Data + one small pure accessor — same shape as this directory's sibling
 * CitizenStatusCatalog.js. No imports from `src/contexts/**`.
 */
export const SKILL_CATALOG = Object.freeze({
  'subsistence-forager': Object.freeze({ label: 'Chasse-cueillette', emoji: '🏹' }),
  spiritual: Object.freeze({ label: 'Spiritualité', emoji: '🙏' }),
  fermier: Object.freeze({ label: 'Fermier', emoji: '🌾' }),
  artisanat: Object.freeze({ label: 'Artisanat', emoji: '🏺' }),
  manutention: Object.freeze({ label: 'Manutention', emoji: '📦' }),
  'vente-alimentaire': Object.freeze({ label: 'Vente alimentaire', emoji: '🛒' }),
  'stockage-alimentaire': Object.freeze({ label: 'Stockage alimentaire', emoji: '🌬️' }),
  medical: Object.freeze({ label: 'Médecine', emoji: '⚕️' }),
  education: Object.freeze({ label: 'Éducation', emoji: '📖' }),
  hygiene: Object.freeze({ label: 'Hygiène', emoji: '🛁' }),
  entertainment: Object.freeze({ label: 'Divertissement', emoji: '🎭' }),
  hospitality: Object.freeze({ label: 'Convivialité', emoji: '🍺' }),
  'employment-eligible': Object.freeze({ label: "Éligibilité à l'emploi", emoji: '💼' }),
  administration: Object.freeze({ label: 'Administration', emoji: '🏛️' }),
  'elder-wisdom': Object.freeze({ label: 'Sagesse', emoji: '📜' }),
  learning: Object.freeze({ label: 'Apprentissage', emoji: '📚' }),
});

/**
 * @param {string} skillId
 * @returns {{ label: string, emoji: string }} The curated entry, or the "…" marker for a skill the catalog
 *   does not name — never a label made up from its id.
 */
export function getSkillDisplay(skillId) {
  return SKILL_CATALOG[skillId] ?? { label: '…', emoji: '…' };
}
