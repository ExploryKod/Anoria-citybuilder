import 'fake-indexeddb/auto';
import { describe, test, expect } from '@jest/globals';
import db, { createEmptyGameDatabase, deleteGameDatabase, waitForDatabaseReady } from '../../src/core/persistence/dexie/db.js';
import { residentsOfHouseId } from '../../src/core/persistence/dexie/residentsProjection.js';

// Leaving a game deletes the whole database and leaves none behind; the next game creates its own while it loads. Nothing outlives a game, the cheat codes neither.
describe('a game left deletes the whole database', () => {
  test('no database is left, then a new game gets an empty one that works, with the residents counted again from nothing', async () => {
    await waitForDatabaseReady();
    await db.citizens.add({ id: 'a', houseId: 'house', hamletId: 'hamlet' });
    await db.journal.add({ turn: 1, date: 'd', type: 't', amount: 1, description: 'x' });
    await db.cheatCodes.put({ code: 'MAXPOP', activatedAt: 1 });
    expect(residentsOfHouseId('house')).toBe(1);

    await deleteGameDatabase();

    expect((await indexedDB.databases()).map((database) => database.name)).not.toContain(db.name);
    expect(residentsOfHouseId('house')).toBe(0);

    await createEmptyGameDatabase();

    expect(await db.citizens.count()).toBe(0);
    expect(await db.journal.count()).toBe(0);
    expect(await db.cheatCodes.count()).toBe(0);

    await db.citizens.add({ id: 'b', houseId: 'house', hamletId: 'hamlet' });
    expect(residentsOfHouseId('house')).toBe(1);
  });
});
