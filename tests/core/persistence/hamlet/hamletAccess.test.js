import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../../src/core/persistence/dexie/db.js';
import {
  HAMLET_ACCESS,
  canTravelToHamlet,
  getHamletAccessState,
  listHamletsWithAccess,
  unlockAllHamlets,
  unlockHamlet,
  listUnlockedNeighborHamletIds,
} from '../../../../src/core/persistence/hamlet/hamletAccess.js';
import {
  DEFAULT_HAMLET_ID,
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../../src/core/persistence/hamlet/hamletSession.js';

describe('hamletAccess', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
    await ensureHamletCatalog();
  });

  test('starting hamlet is active; others are locked', async () => {
    const hamlets = await listHamletsWithAccess();
    const active = hamlets.find((h) => h.id === DEFAULT_HAMLET_ID);
    const locked = hamlets.filter((h) => h.id !== DEFAULT_HAMLET_ID);

    expect(active?.access).toBe(HAMLET_ACCESS.active);
    expect(locked.every((h) => h.access === HAMLET_ACCESS.locked)).toBe(true);
  });

  test('canTravelToHamlet only allows unlocked non-active hamlets', async () => {
    expect(await canTravelToHamlet(DEFAULT_HAMLET_ID)).toBe(false);
    expect(await canTravelToHamlet('clairiere')).toBe(false);

    await unlockHamlet('clairiere');
    expect(await getHamletAccessState('clairiere')).toBe(HAMLET_ACCESS.unlocked);
    expect(await canTravelToHamlet('clairiere')).toBe(true);
  });

  test('unlockAllHamlets unlocks every proto hamlet', async () => {
    const count = await unlockAllHamlets();
    expect(count).toBeGreaterThan(0);

    const hamlets = await listHamletsWithAccess();
    const nonActive = hamlets.filter((h) => h.id !== DEFAULT_HAMLET_ID);
    expect(nonActive.every((h) => h.access === HAMLET_ACCESS.unlocked)).toBe(true);
  });

  test('listUnlockedNeighborHamletIds excludes active and locked hamlets', async () => {
    await unlockHamlet('clairiere');
    await unlockHamlet('pont-saules');

    const neighbors = await listUnlockedNeighborHamletIds();
    expect(neighbors).toContain('clairiere');
    expect(neighbors).toContain('pont-saules');
    expect(neighbors).not.toContain(DEFAULT_HAMLET_ID);
    expect(neighbors).not.toContain('bruyeres');
  });

  test('natureSeeded does not imply travel unlock', async () => {
    await db.hamlets.put({
      id: 'clairiere',
      name: 'Clairière',
      natureSeeded: true,
      unlocked: false,
    });

    expect(await canTravelToHamlet('clairiere')).toBe(false);
    expect(await getHamletAccessState('clairiere')).toBe(HAMLET_ACCESS.locked);
  });
});
