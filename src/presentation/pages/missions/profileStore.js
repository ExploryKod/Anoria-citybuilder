import { playerNameProblem, requirePlayerName } from '../../../shared/player-identity/PlayerNamePolicy.js';

const STORAGE_KEY = 'anoria.playerProfiles';

const DEFAULT_PROFILES = ['Alexandros', 'Era', 'Démo'];

/** @returns {string[]} */
export function listProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // What the browser's storage holds is as untrusted as what was just typed (another script, a hand edit): a name that does not follow the rule is left out, and said.
        return parsed.filter((name) => {
          const problem = playerNameProblem(name);
          if (problem) console.warn(`[profiles] a stored profile is ignored (${problem}):`, name);
          return problem === null;
        }).map((name) => name.trim());
      }
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_PROFILES];
}

/**
 * @param {string} name
 * @throws {Error} when the name does not follow the rule (PlayerNamePolicy.js): the form tells the player before it gets here
 */
export function addProfile(name) {
  const trimmed = requirePlayerName(name);
  const profiles = listProfiles();
  if (!profiles.includes(trimmed)) {
    profiles.push(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      /* ignore */
    }
  }
}
