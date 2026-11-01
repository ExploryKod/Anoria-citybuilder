/**
 * The badge that says a cheat is in force in this game ("Triche"), on every page that runs a game. It does not say which cheat: only that
 * the game is no longer played by its own rules. It shows while cheat codes are allowed AND the game holds a cheat flag (see hasActiveCheat).
 */

import { hasActiveCheat } from '../../../composition/hasActiveCheat.js';

const BADGE_ID = 'cheat-badge';

/** @returns {HTMLElement} */
function ensureBadge() {
  let badge = document.getElementById(BADGE_ID);
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = 'cheat-badge';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', 'Une triche est active dans cette partie');
  badge.title = 'Une triche est active dans cette partie';
  badge.textContent = '🧪 Triche';
  badge.hidden = true;
  document.body.appendChild(badge);
  return badge;
}

/** Shows or hides the badge from the game's state now. */
export async function refreshCheatBadge() {
  const badge = ensureBadge();
  badge.hidden = !(await hasActiveCheat());
}

/** Installs the badge, and keeps it right when the page regains focus (the permission is changed in Paramètres, another page). */
export function initCheatBadge() {
  ensureBadge();
  const refresh = () => {
    refreshCheatBadge().catch((error) => console.error('[cheat] the cheat badge could not be read:', error));
  };
  refresh();
  window.addEventListener('focus', refresh);
}
