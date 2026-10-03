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
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../../src/core/persistence/hamlet/hamletSession.js';
import { H, setupHamlets } from '../../../helpers/hamletIds.js';

describe('hamletAccess', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await setupHamlets();
    await ensureHamletCatalog();
  });

  test('starting hamlet is active; others are locked', async () => {
    const hamlets = await listHamletsWithAccess();
    const active = hamlets.find((h) => h.id === H.eraanurbs);
    const locked = hamlets.filter((h) => h.id !== H.eraanurbs);

    expect(active?.access).toBe(HAMLET_ACCESS.active);
    expect(locked.every((h) => h.access === HAMLET_ACCESS.locked)).toBe(true);
  });

  test('canTravelToHamlet only allows unlocked non-active hamlets', async () => {
    expect(await canTravelToHamlet(H.eraanurbs)).toBe(false);
    expect(await canTravelToHamlet(H['clairiere'])).toBe(false);

    await unlockHamlet(H['clairiere']);
    expect(await getHamletAccessState(H['clairiere'])).toBe(HAMLET_ACCESS.unlocked);
    expect(await canTravelToHamlet(H['clairiere'])).toBe(true);
  });

  test('unlockAllHamlets unlocks every proto hamlet', async () => {
    const count = await unlockAllHamlets();
    expect(count).toBeGreaterThan(0);

    const hamlets = await listHamletsWithAccess();
    const nonActive = hamlets.filter((h) => h.id !== H.eraanurbs);
    expect(nonActive.every((h) => h.access === HAMLET_ACCESS.unlocked)).toBe(true);
  });

  test('listUnlockedNeighborHamletIds excludes active and locked hamlets', async () => {
    await unlockHamlet(H['clairiere']);
    await unlockHamlet(H['pont-saules']);

    const neighbors = await listUnlockedNeighborHamletIds();
    expect(neighbors).toContain(H['clairiere']);
    expect(neighbors).toContain(H['pont-saules']);
    expect(neighbors).not.toContain(H.eraanurbs);
    expect(neighbors).not.toContain(H['bruyeres']);
  });

  test('natureSeeded does not imply travel unlock', async () => {
    await db.hamlets.put({
      id: H['clairiere'],
      name: 'Clairière',
      natureSeeded: true,
      unlocked: false,
    });

    expect(await canTravelToHamlet(H['clairiere'])).toBe(false);
    expect(await getHamletAccessState(H['clairiere'])).toBe(HAMLET_ACCESS.locked);
  });
});
