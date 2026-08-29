import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../../src/core/persistence/dexie/db.js';
import {
  DEFAULT_HAMLET_ID,
  HAMLET_SESSION_ROW_KEY,
  ensureHamletCatalog,
  getActiveHamletId,
  setActiveHamletId,
} from '../../../../src/core/persistence/hamlet/hamletSession.js';
import { canTravelToHamlet } from '../../../../src/core/persistence/hamlet/hamletAccess.js';

describe('hamletSession persistence', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('resets persisted active hamlet when it is locked', async () => {
    await db.hamlets.bulkPut([
      { id: 'eraanurbs', name: "Val d'Era", natureSeeded: true, unlocked: true },
      { id: 'clairiere', name: 'Clairière', natureSeeded: true, unlocked: false },
    ]);
    await db.game.put({ name: HAMLET_SESSION_ROW_KEY, activeHamletId: 'clairiere' });
    setActiveHamletId('clairiere');

    await ensureHamletCatalog();

    expect(getActiveHamletId()).toBe(DEFAULT_HAMLET_ID);
    const session = await db.game.get(HAMLET_SESSION_ROW_KEY);
    expect(session?.activeHamletId).toBe(DEFAULT_HAMLET_ID);
    expect(await canTravelToHamlet('clairiere')).toBe(false);
  });

  test('persists active hamlet in IndexedDB game session row', async () => {
    await ensureHamletCatalog();
    setActiveHamletId('eraanurbs');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const session = await db.game.get(HAMLET_SESSION_ROW_KEY);
    expect(session?.activeHamletId).toBe('eraanurbs');
    expect(localStorage.getItem('anoria.activeHamletId')).toBeNull();
  });

  test('migrates legacy localStorage active hamlet once into IndexedDB', async () => {
    await db.game.clear();
    await db.hamlets.bulkPut([
      { id: 'eraanurbs', name: "Val d'Era", natureSeeded: true, unlocked: true },
      { id: 'clairiere', name: 'Clairière', natureSeeded: true, unlocked: true },
    ]);
    localStorage.setItem('anoria.activeHamletId', 'clairiere');

    await ensureHamletCatalog();

    expect(getActiveHamletId()).toBe('clairiere');
    const session = await db.game.get(HAMLET_SESSION_ROW_KEY);
    expect(session?.activeHamletId).toBe('clairiere');
    expect(localStorage.getItem('anoria.activeHamletId')).toBeNull();
  });
});
