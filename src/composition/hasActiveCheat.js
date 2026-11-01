import { isCheatCodesAllowed } from '../config/cheatCodes.js';
import { GAME_CHEAT_FLAGS, readGameCheatFlag } from '../core/persistence/cheat/gameCheatFlags.js';

/**
 * Whether this game is played with a cheat in force: cheat codes are allowed in Paramètres AND the game holds at least one cheat flag
 * (any of GAME_CHEAT_FLAGS, so a flag added later is counted without touching this). The player is told with a badge (CheatBadge.js);
 * it never says which cheat. A one-shot code (Treasury) leaves no flag, so it does not count.
 * @returns {Promise<boolean>}
 */
export async function hasActiveCheat() {
  if (!isCheatCodesAllowed()) return false;
  for (const flag of Object.values(GAME_CHEAT_FLAGS)) {
    const value = await readGameCheatFlag(flag);
    if (value === true || typeof value === 'number') return true;
  }
  return false;
}
