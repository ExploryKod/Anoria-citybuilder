import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../src/core/persistence/dexie/db.js';
import { unlockHamlet, HAMLET_ACCESS } from '../../../src/core/persistence/hamlet/hamletAccess.js';
import {
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../src/core/persistence/hamlet/hamletSession.js';
import { buildWorldMapView } from '../../../src/contexts/geography/application/queries/buildWorldMapView.js';
import { H, setupHamlets } from '../../helpers/hamletIds.js';

describe('buildWorldMapView', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await setupHamlets();
    await ensureHamletCatalog();
  });

  test('builds kingdom influence from unlocked hamlets', async () => {
    const view = await buildWorldMapView();

    expect(view.kingdom.id).toBe('anoria');
    expect(view.kingdom.influence).toBeCloseTo(1 / 4);
    expect(view.cities.length).toBeGreaterThan(0);
  });

  test('increases influence when more hamlets are unlocked', async () => {
    await unlockHamlet(H['clairiere']);
    await unlockHamlet(H['pont-saules']);

    const view = await buildWorldMapView();

    expect(view.kingdom.unlockedHamlets).toBe(3);
    expect(view.kingdom.influence).toBeCloseTo(3 / 4);

    const unlocked = view.hamlets.filter((hamlet) => hamlet.access !== HAMLET_ACCESS.locked);
    expect(unlocked).toHaveLength(2);
    expect(unlocked.map((hamlet) => hamlet.id).sort()).toEqual([H['clairiere'], H['pont-saules']].sort());
  });

  test('lists all satellite hamlets on the world map including locked ones', async () => {
    const view = await buildWorldMapView();

    expect(view.hamlets).toHaveLength(3);
    expect(view.hamlets.some((hamlet) => hamlet.id === H.eraanurbs)).toBe(false);
    expect(view.hamlets.filter((hamlet) => hamlet.access === HAMLET_ACCESS.locked)).toHaveLength(3);
  });
});
