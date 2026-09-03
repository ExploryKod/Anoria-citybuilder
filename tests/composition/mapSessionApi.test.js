import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { unlockHamlet } from '../../src/core/persistence/hamlet/hamletAccess.js';
import {
  DEFAULT_HAMLET_ID,
  ensureHamletCatalog,
  getActiveHamletId,
  setActiveHamletId,
} from '../../src/core/persistence/hamlet/hamletSession.js';
import { createMapSessionApi } from '../../src/composition/mapSessionApi.js';

describe('mapSessionApi', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
    await ensureHamletCatalog();
  });

  test('travelToHamlet rejects locked hamlets', async () => {
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet('clairiere');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('locked');
    expect(getActiveHamletId()).toBe(DEFAULT_HAMLET_ID);
  });

  test('travelToHamlet switches active hamlet when unlocked', async () => {
    await unlockHamlet('clairiere');
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet('clairiere');
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(false);
    expect(getActiveHamletId()).toBe('clairiere');
  });

  test('travelToHamlet is noop for already active hamlet', async () => {
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet(DEFAULT_HAMLET_ID);
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(true);
  });
});
