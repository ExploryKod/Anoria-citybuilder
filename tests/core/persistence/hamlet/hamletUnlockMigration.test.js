import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../../src/core/persistence/dexie/db.js';
import { recordCheatActivation } from '../../../../src/core/persistence/cheat/cheatCodeRepository.js';
import { reconcileHamletUnlockFlags } from '../../../../src/core/persistence/hamlet/hamletUnlockMigration.js';
import { canTravelToHamlet } from '../../../../src/core/persistence/hamlet/hamletAccess.js';
import { setActiveHamletId, DEFAULT_HAMLET_ID } from '../../../../src/core/persistence/hamlet/hamletSession.js';

describe('hamletUnlockMigration', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('clears mistaken unlocks from natureSeeded-only visits', async () => {
    await db.hamlets.bulkPut([
      { id: 'eraanurbs', name: "Val d'Era", natureSeeded: true, unlocked: true },
      { id: 'clairiere', name: 'Clairière', natureSeeded: true, unlocked: true },
    ]);

    await db.transaction('rw', db.hamlets, db.cheatCodes, reconcileHamletUnlockFlags);

    const clairiere = await db.hamlets.get('clairiere');
    expect(clairiere?.unlocked).toBe(false);
    expect(await canTravelToHamlet('clairiere')).toBe(false);
  });

  test('keeps unlocks when HamletsAll cheat was recorded', async () => {
    await db.hamlets.bulkPut([
      { id: 'eraanurbs', name: "Val d'Era", natureSeeded: true, unlocked: true },
      { id: 'clairiere', name: 'Clairière', natureSeeded: true, unlocked: true },
    ]);
    await recordCheatActivation('HamletsAll');

    await db.transaction('rw', db.hamlets, db.cheatCodes, reconcileHamletUnlockFlags);

    const clairiere = await db.hamlets.get('clairiere');
    expect(clairiere?.unlocked).toBe(true);
    expect(await canTravelToHamlet('clairiere')).toBe(true);
  });
});
