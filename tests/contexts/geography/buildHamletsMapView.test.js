import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../src/core/persistence/dexie/db.js';
import { unlockHamlet } from '../../../src/core/persistence/hamlet/hamletAccess.js';
import {
  DEFAULT_HAMLET_ID,
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../src/core/persistence/hamlet/hamletSession.js';
import { HAMLET_MAP_SITES } from '../../../src/contexts/geography/domain/catalogs/HamletMapCatalog.js';
import { buildHamletsMapView } from '../../../src/contexts/geography/application/queries/buildHamletsMapView.js';

describe('buildHamletsMapView', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
    await ensureHamletCatalog();
  });

  test('marks default hamlet as active and others locked', async () => {
    const view = await buildHamletsMapView();

    expect(view.activeHamletId).toBe(DEFAULT_HAMLET_ID);
    expect(view.totalHamlets).toBe(10);
    expect(view.unlockedCount).toBe(1);

    const active = view.hamlets.find((hamlet) => hamlet.id === DEFAULT_HAMLET_ID);
    expect(active?.access).toBe('active');
    expect(active?.canTravel).toBe(false);

    const locked = view.hamlets.find((hamlet) => hamlet.id === 'clairiere');
    expect(locked?.access).toBe('locked');
    expect(locked?.canTravel).toBe(false);
  });

  test('includes hex coordinates for every proto hamlet', async () => {
    const view = await buildHamletsMapView();

    expect(view.hamlets).toHaveLength(10);
    for (const hamlet of view.hamlets) {
      const site = HAMLET_MAP_SITES.find((item) => item.id === hamlet.id);
      expect(hamlet.map.hex).toEqual({ q: site?.q, r: site?.r });
      expect(hamlet.map.sprite).toBe('hamlet');
    }
  });

  test('reflects unlocked hamlets after unlockHamlet', async () => {
    await unlockHamlet('clairiere');
    const view = await buildHamletsMapView();

    expect(view.unlockedCount).toBe(2);
    const clairiere = view.hamlets.find((hamlet) => hamlet.id === 'clairiere');
    expect(clairiere?.access).toBe('unlocked');
    expect(clairiere?.canTravel).toBe(true);
  });
});
