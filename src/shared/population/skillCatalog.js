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
  fermier: Object.freeze({ label: 'Fermier', emoji: '🌾' }),
  artisanat: Object.freeze({ label: 'Artisanat', emoji: '🏺' }),
  energie: Object.freeze({ label: 'Énergie', emoji: '⚡' }),
  manutention: Object.freeze({ label: 'Manutention', emoji: '📦' }),
  telecoms: Object.freeze({ label: 'Télécommunications', emoji: '📡' }),
  'vente-alimentaire': Object.freeze({ label: 'Vente alimentaire', emoji: '🏪' }),
  finance: Object.freeze({ label: 'Finance', emoji: '🏦' }),
  'stockage-alimentaire': Object.freeze({ label: 'Stockage alimentaire', emoji: '🥫' }),
  hydraulique: Object.freeze({ label: 'Hydraulique', emoji: '💧' }),
  medical: Object.freeze({ label: 'Médecine', emoji: '⚕️' }),
  incendie: Object.freeze({ label: 'Lutte contre le feu', emoji: '🚒' }),
  securite: Object.freeze({ label: 'Sécurité', emoji: '🚓' }),
  education: Object.freeze({ label: 'Éducation', emoji: '📖' }),
  entertainment: Object.freeze({ label: 'Divertissement', emoji: '🎭' }),
  hospitality: Object.freeze({ label: 'Convivialité', emoji: '🍺' }),
  'employment-eligible': Object.freeze({ label: "Éligibilité à l'emploi", emoji: '💼' }),
  administration: Object.freeze({ label: 'Administration', emoji: '🏛️' }),
  // The administrators' skills: the owner and one collection per tax (see socialCategoryCatalog.js).
  proprietaire: Object.freeze({ label: 'Propriétaire', emoji: '🔑' }),
  perception_ic: Object.freeze({ label: 'Impôt citoyen', emoji: '🧾' }),
  perception_ir: Object.freeze({ label: 'Impôt sur le revenu', emoji: '🧾' }),
  perception_tva: Object.freeze({ label: 'TVA', emoji: '🧾' }),
  perception_is: Object.freeze({ label: 'Impôt sur les sociétés', emoji: '🧾' }),
  perception_douane: Object.freeze({ label: 'Douanes', emoji: '🛃' }),
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
