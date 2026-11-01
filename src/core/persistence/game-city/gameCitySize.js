/**
 * The side of the city's map (in tiles), frozen with the game like its calendar: written once when the game is created (from the menu choice: a new
 * game, a mission, a map, the starter prefab), read back each time the saved game is reloaded. The boot never works it out again: a reload has no menu
 * choice, and a size guessed from a default put the grid under the buildings and the trees the game already holds (a 16 x 16 map over an 18 x 18 city).
 */
import db from '../dexie/db.js';

const CITY_SIZE_SETTING_NAME = 'citySize';

/** @param {unknown} size @param {string} where */
function assertCitySize(size, where) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`[game-city] the city size ${where} must be a whole number > 0, got ${size}`);
  }
  return size;
}

/** @param {number} size */
export async function writeGameCitySize(size) {
  assertCitySize(size, 'to freeze with the game');
  await db.gameSettings.put({ name: CITY_SIZE_SETTING_NAME, size });
}

/**
 * @returns {Promise<number>} The size the game was created with. Throws when the saved game has none: it is written when a game is created, never guessed.
 */
export async function readGameCitySize() {
  const row = await db.gameSettings.get(CITY_SIZE_SETTING_NAME);
  if (!row) {
    throw new Error('[game-city] the saved game has no city size (it is written when the game is created): start the game again from the menu');
  }
  return assertCitySize(row.size, 'saved with the game');
}
