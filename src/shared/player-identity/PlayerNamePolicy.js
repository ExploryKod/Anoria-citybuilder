/**
 * What a name the player types may be (a profile, the pseudo other players see). One rule, read by the form (to tell the player at once), by the stored profiles (a value
 * read back from the browser's storage is as untrusted as one typed) and mirrored by the multiplayer server, which never trusts a client. Letters of any alphabet, digits, and a
 * few signs a name carries (space, dot, underscore, apostrophe, hyphen): nothing that is markup, nothing that is a control character.
 *
 * This is the first line of defence, not the only one: a name is still shown as text, never as markup (see richText.js, safeHtml.js, ToastNotifier.js).
 */
export const PLAYER_NAME_MAX_LENGTH = 32;

const PLAYER_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u;

/**
 * @param {unknown} name
 * @returns {string | null} what is wrong with the name, in words for the player, or null when it is a good one
 */
export function playerNameProblem(name) {
  if (typeof name !== 'string') return 'Le nom doit être un texte.';
  const trimmed = name.trim();
  if (trimmed === '') return 'Le nom est vide.';
  if ([...trimmed].length > PLAYER_NAME_MAX_LENGTH) return `Le nom a au plus ${PLAYER_NAME_MAX_LENGTH} caractères.`;
  if (!PLAYER_NAME_PATTERN.test(trimmed)) {
    return 'Le nom commence par une lettre ou un chiffre, et ne contient que des lettres, des chiffres, des espaces et . _ \' - .';
  }
  return null;
}

/**
 * @param {string} name
 * @returns {string} the trimmed name
 * @throws {Error} naming what is wrong, for a name that does not follow the rule
 */
export function requirePlayerName(name) {
  const problem = playerNameProblem(name);
  if (problem) throw new Error(`[player-name] ${problem}`);
  return name.trim();
}
