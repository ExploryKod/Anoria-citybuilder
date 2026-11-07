import 'fake-indexeddb/auto';
import { describe, test, expect } from '@jest/globals';
import db, { deleteGameDatabaseForNewGame, waitForDatabaseReady } from '../../src/core/persistence/dexie/db.js';
import { residentsOfHouseId } from '../../src/core/persistence/dexie/residentsProjection.js';

// A new game deletes the whole database and creates it again; only the cheat codes the player activated outlive it.
describe('a new game deletes the whole database', () => {
  test('the game is gone, the residents are counted again from nothing, the cheat codes stay, and the database works afterwards', async () => {
    await waitForDatabaseReady();
    await db.citizens.add({ id: 'a', houseId: 'house', hamletId: 'hamlet' });
    await db.journal.add({ turn: 1, date: 'd', type: 't', amount: 1, description: 'x' });
    await db.cheatCodes.put({ code: 'MAXPOP', activatedAt: 1 });
    expect(residentsOfHouseId('house')).toBe(1);

    await deleteGameDatabaseForNewGame();

    expect(await db.citizens.count()).toBe(0);
    expect(await db.journal.count()).toBe(0);
    expect(residentsOfHouseId('house')).toBe(0);
    expect(await db.cheatCodes.toArray()).toEqual([{ code: 'MAXPOP', activatedAt: 1 }]);

    await db.citizens.add({ id: 'b', houseId: 'house', hamletId: 'hamlet' });
    expect(residentsOfHouseId('house')).toBe(1);
  });
});
