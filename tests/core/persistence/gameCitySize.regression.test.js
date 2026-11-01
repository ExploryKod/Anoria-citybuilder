/**
 * Regression: a saved game reloaded with F5 was given the default 16 x 16 map whatever size it had been created with (the starter prefab is
 * 18 x 18), so the trees and buildings of its far tiles fell outside the grid and the scene never loaded. The size is now frozen with the game.
 */
import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../src/core/persistence/dexie/db.js';
import { readGameCitySize, writeGameCitySize } from '../../../src/core/persistence/game-city/gameCitySize.js';

describe('the city size frozen with the game', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('the size a game was created with is the size it is reloaded with', async () => {
    await writeGameCitySize(18);
    expect(await readGameCitySize()).toBe(18);
  });

  test('a saved game without a city size is refused, not given a default one', async () => {
    await expect(readGameCitySize()).rejects.toThrow(/no city size/);
  });

  test('a size that is not a whole number above 0 is never written', async () => {
    await expect(writeGameCitySize(0)).rejects.toThrow(/whole number/);
    await expect(writeGameCitySize(Number.NaN)).rejects.toThrow(/whole number/);
  });
});
