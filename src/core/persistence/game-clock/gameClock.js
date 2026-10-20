/**
 * The game clock: the current turn (day) of the active game. It is the only copy of the turn that is saved; the
 * accounting reads it live from the running game, never from a copy of its own.
 */
import db from '../dexie/db.js';

const CLOCK_SETTING_NAME = 'clock';

/** @returns {Promise<number>} The saved turn. Throws when the game has no clock: a save never starts without one. */
export async function readGameClock() {
  const row = await db.gameSettings.get(CLOCK_SETTING_NAME);
  if (!row || !Number.isInteger(row.turn) || row.turn < 0) {
    throw new Error('[game-clock] the saved game has no valid turn (the clock is written at every turn)');
  }
  return row.turn;
}

/** @param {number} turn */
export async function writeGameClock(turn) {
  if (!Number.isInteger(turn) || turn < 0) {
    throw new Error(`[game-clock] a turn must be a whole number >= 0, got ${turn}`);
  }
  await db.gameSettings.put({ name: CLOCK_SETTING_NAME, turn });
}
