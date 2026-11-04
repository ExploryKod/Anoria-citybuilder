/**
 * The first names of the citizens: declared here, once. A citizen's name is picked from this list when it arrives and is stored
 * on the citizen (see `shared/citizens/Citizen.js`): it never changes, in any view or any month.
 */
export const CITIZEN_FIRST_NAMES = Object.freeze([
  'Adèle', 'Alain', 'Amélie', 'Arthur', 'Béatrice', 'Bernard', 'Camille', 'Charles', 'Claire', 'Denis',
  'Élise', 'Émile', 'Félix', 'Gaston', 'Hélène', 'Henri', 'Inès', 'Jules', 'Léa', 'Louis',
  'Madeleine', 'Marcel', 'Odile', 'Paul', 'Rose', 'Simon', 'Thérèse', 'Victor', 'Yvette', 'Zoé',
]);

/**
 * A first name drawn for an arriving citizen.
 * @param {() => number} random a draw in [0, 1)
 * @returns {string}
 */
export function drawCitizenFirstName(random) {
  const draw = random();
  if (!(draw >= 0 && draw < 1)) throw new Error(`[names] the random source must give a number in [0, 1), got ${draw}`);
  return CITIZEN_FIRST_NAMES[Math.floor(draw * CITIZEN_FIRST_NAMES.length)];
}
