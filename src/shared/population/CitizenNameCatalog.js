/**
 * The first names of the citizens: declared here, once. A citizen's name is picked from this list by its place in its
 * household, so the same citizen keeps the same name in every view and every month.
 */
export const CITIZEN_FIRST_NAMES = Object.freeze([
  'Adèle', 'Alain', 'Amélie', 'Arthur', 'Béatrice', 'Bernard', 'Camille', 'Charles', 'Claire', 'Denis',
  'Élise', 'Émile', 'Félix', 'Gaston', 'Hélène', 'Henri', 'Inès', 'Jules', 'Léa', 'Louis',
  'Madeleine', 'Marcel', 'Odile', 'Paul', 'Rose', 'Simon', 'Thérèse', 'Victor', 'Yvette', 'Zoé',
]);

/**
 * The first name of the citizen at `index` of a household: deterministic, so it never changes.
 * @param {string} householdId
 * @param {number} index
 * @returns {string}
 */
export function citizenFirstName(householdId, index) {
  if (!householdId || !Number.isInteger(index) || index < 0) throw new Error('[names] a citizen needs its household and its place');
  let hash = 0;
  for (const char of `${householdId}:${index}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CITIZEN_FIRST_NAMES[hash % CITIZEN_FIRST_NAMES.length];
}
