import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { unlockHamlet } from '../../src/core/persistence/hamlet/hamletAccess.js';
import {
  ensureHamletCatalog,
  getActiveHamletId,
  setActiveHamletId,
} from '../../src/core/persistence/hamlet/hamletSession.js';
import { createMapSessionApi } from '../../src/composition/mapSessionApi.js';
import { H, setupHamlets } from '../helpers/hamletIds.js';

describe('mapSessionApi', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await setupHamlets();
    await ensureHamletCatalog();
  });

  test('travelToHamlet rejects locked hamlets', async () => {
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet(H['clairiere']);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('locked');
    expect(getActiveHamletId()).toBe(H.eraanurbs);
  });

  test('travelToHamlet switches active hamlet when unlocked', async () => {
    await unlockHamlet(H['clairiere']);
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet(H['clairiere']);
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(false);
    expect(getActiveHamletId()).toBe(H['clairiere']);
  });

  test('travelToHamlet is noop for already active hamlet', async () => {
    const mapApi = createMapSessionApi();
    const result = await mapApi.travelToHamlet(H.eraanurbs);
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(true);
  });
});
