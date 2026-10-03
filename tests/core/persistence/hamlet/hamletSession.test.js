import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../../src/core/persistence/dexie/db.js';
import { HAMLET_CATALOG } from '../../../../src/shared/hamlet-catalog/hamletCatalog.js';
import {
  DEFAULT_HAMLET_SLUG,
  ensureHamletCatalog,
  getActiveHamletId,
  getDefaultHamletId,
  hamletSlugOf,
  listHamlets,
  parseGameHamletPath,
} from '../../../../src/core/persistence/hamlet/hamletSession.js';
import { canTravelToHamlet } from '../../../../src/core/persistence/hamlet/hamletAccess.js';
import { H, setupHamlets } from '../../../helpers/hamletIds.js';

const UUID = '0b6f1c2e-3a4d-4e5f-8a9b-1c2d3e4f5a6b';

describe('hamlet session — identity by UUID', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('every proto hamlet gets its own UUID at creation, the starting one included', async () => {
    await ensureHamletCatalog();
    const hamlets = await listHamlets();

    expect(hamlets).toHaveLength(HAMLET_CATALOG.length);
    for (const hamlet of hamlets) {
      expect(hamlet.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(new Set(hamlets.map((h) => h.id)).size).toBe(HAMLET_CATALOG.length);
    expect(hamlets.map((h) => h.slug).sort()).toEqual(HAMLET_CATALOG.map((p) => p.slug).sort());
  });

  test('listHamlets follows the catalogue order, whatever the UUIDs', async () => {
    await ensureHamletCatalog();
    const hamlets = await listHamlets();

    expect(hamlets.map((h) => h.slug)).toEqual(HAMLET_CATALOG.map((p) => p.slug));
    expect(hamlets[0].slug).toBe(DEFAULT_HAMLET_SLUG);
  });

  test('the starting hamlet is active by default and only it is unlocked', async () => {
    await setupHamlets();
    expect(getActiveHamletId()).toBe(getDefaultHamletId());
    expect(hamletSlugOf(getDefaultHamletId())).toBe('eraanurbs');
    expect(await canTravelToHamlet(H['clairiere'])).toBe(false);
  });

  test('a requested unlocked hamlet becomes active', async () => {
    await ensureHamletCatalog();
    const clairiere = (await listHamlets()).find((h) => h.slug === 'clairiere');
    await db.hamlets.put({ ...(await db.hamlets.get(clairiere.id)), unlocked: true });

    expect(await ensureHamletCatalog({ requestedId: clairiere.id })).toBe(clairiere.id);
    expect(getActiveHamletId()).toBe(clairiere.id);
  });

  test('a requested hamlet that is locked or unknown falls back to the starting one', async () => {
    await ensureHamletCatalog();
    const locked = (await listHamlets()).find((h) => h.slug === 'pont-saules');

    expect(await ensureHamletCatalog({ requestedId: locked.id })).toBe(getDefaultHamletId());
    expect(await ensureHamletCatalog({ requestedId: UUID })).toBe(getDefaultHamletId());
  });

  test('ensuring again keeps the same UUIDs', async () => {
    await ensureHamletCatalog();
    const first = (await listHamlets()).map((h) => h.id).sort();
    await ensureHamletCatalog();
    expect((await listHamlets()).map((h) => h.id).sort()).toEqual(first);
  });

  test('parseGameHamletPath accepts only /game/<uuid>', () => {
    expect(parseGameHamletPath(`/game/${UUID}`)).toBe(UUID);
    expect(parseGameHamletPath(`/game/${UUID}/`)).toBe(UUID);
    expect(parseGameHamletPath('/game')).toBeNull();
    expect(parseGameHamletPath('/game/eraanurbs')).toBeNull();
    expect(parseGameHamletPath('/world')).toBeNull();
  });
});
