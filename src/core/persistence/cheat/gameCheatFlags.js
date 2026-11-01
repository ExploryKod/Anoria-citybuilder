/**
 * The cheats that stay on for the rest of ONE game (a one-shot cheat, like the treasury, leaves nothing here). Each is a named flag in the
 * game's own settings, so a new game starts without any (the table is emptied with it) and a saved game keeps them.
 *
 * A flag is only a record. Whether it changes the rules is the engine's to decide, and it asks `isCheatCodesAllowed` too
 * (src/config/cheatCodes.js): with the permission off, a flag does nothing.
 */
import db from '../dexie/db.js';

const SETTING_NAME = 'cheats';

/** The flags a code can set (one entry each, named after what it does to the rules). */
export const GAME_CHEAT_FLAGS = Object.freeze({
  /** Every house is at the highest level of its social category, whatever its services and requirements, and never goes down. */
  houseLevelsUnlocked: 'houseLevelsUnlocked',
  /** Every house holds exactly this many inhabitants (its ceiling and its count), whatever its level allows. */
  housePopulation: 'housePopulation',
});

/** What each flag holds: `boolean`, or `positiveInteger` (read as a number, or null while the flag is not set). */
const FLAG_KINDS = Object.freeze({
  [GAME_CHEAT_FLAGS.houseLevelsUnlocked]: 'boolean',
  [GAME_CHEAT_FLAGS.housePopulation]: 'positiveInteger',
});

/** @param {string} flag */
function kindOf(flag) {
  const kind = FLAG_KINDS[flag];
  if (!kind) throw new Error(`[cheat] "${flag}" is not a game cheat flag (known: ${Object.keys(FLAG_KINDS).join(', ')})`);
  return kind;
}

/**
 * @param {string} flag one of GAME_CHEAT_FLAGS
 * @returns {Promise<boolean | number | null>} a boolean flag reads true/false; a number flag reads its number, or null while it is not set
 */
export async function readGameCheatFlag(flag) {
  const kind = kindOf(flag);
  const row = await db.gameSettings.get(SETTING_NAME);
  if (kind === 'boolean') return row?.[flag] === true;
  const value = row?.[flag];
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * @param {string} flag one of GAME_CHEAT_FLAGS
 * @param {boolean | number} value true/false for a boolean flag, a whole number >= 1 for a number flag
 */
export async function writeGameCheatFlag(flag, value) {
  const kind = kindOf(flag);
  if (kind === 'boolean' && typeof value !== 'boolean') throw new Error(`[cheat] the flag "${flag}" is true or false, got ${typeof value}`);
  if (kind === 'positiveInteger' && !(Number.isInteger(value) && value > 0)) throw new Error(`[cheat] the flag "${flag}" is a whole number >= 1, got ${value}`);
  const row = (await db.gameSettings.get(SETTING_NAME)) ?? { name: SETTING_NAME };
  await db.gameSettings.put({ ...row, [flag]: value });
}
