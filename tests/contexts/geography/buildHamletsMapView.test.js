import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../src/core/persistence/dexie/db.js';
import { unlockHamlet } from '../../../src/core/persistence/hamlet/hamletAccess.js';
import {
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../src/core/persistence/hamlet/hamletSession.js';
import { HAMLET_MAP_SITES } from '../../../src/contexts/geography/domain/catalogs/HamletMapCatalog.js';
import { buildHamletsMapView } from '../../../src/contexts/geography/application/queries/buildHamletsMapView.js';
import { H, setupHamlets } from '../../helpers/hamletIds.js';

describe('buildHamletsMapView', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await setupHamlets();
    await ensureHamletCatalog();
  });

  test('marks default hamlet as active and others locked', async () => {
    const view = await buildHamletsMapView();

    expect(view.activeHamletId).toBe(H.eraanurbs);
    expect(view.totalHamlets).toBe(4);
    expect(view.unlockedCount).toBe(1);

    const active = view.hamlets.find((hamlet) => hamlet.id === H.eraanurbs);
    expect(active?.access).toBe('active');
    expect(active?.canTravel).toBe(false);

    const locked = view.hamlets.find((hamlet) => hamlet.id === H['clairiere']);
    expect(locked?.access).toBe('locked');
    expect(locked?.canTravel).toBe(false);
  });

  test('includes hex coordinates for every proto hamlet', async () => {
    const view = await buildHamletsMapView();

    expect(view.hamlets).toHaveLength(4);
    for (const hamlet of view.hamlets) {
      const site = HAMLET_MAP_SITES.find((item) => item.id === hamlet.slug);
      expect(hamlet.map.hex).toEqual({ q: site?.q, r: site?.r });
      expect(hamlet.map.sprite).toBe('hamlet');
    }
  });

  test('reflects unlocked hamlets after unlockHamlet', async () => {
    await unlockHamlet(H['clairiere']);
    const view = await buildHamletsMapView();

    expect(view.unlockedCount).toBe(2);
    const clairiere = view.hamlets.find((hamlet) => hamlet.id === H['clairiere']);
    expect(clairiere?.access).toBe('unlocked');
    expect(clairiere?.canTravel).toBe(true);
  });
});
