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
import { resetCommerceContextForTests } from '../../src/composition/createCommerceContext.js';

const commerce = {
  commerceRepository: {
    loadOrSeedPartners: () => [],
    savePartners: () => {},
    loadStats: () => ({ yearlyExports: {}, yearlyImports: {} }),
    loadOrSeedConfig: () => [],
    saveConfig: () => {},
  },
  clear: () => {},
};

const housing = {
  getCityTotalPopulation: async () => 0,
};

const employment = {
  getCityEmploymentSummary: async () => ({ unemploymentPercentage: 0 }),
};

const accounting = {
  getCommercialRouteFee: () => 500,
  getTreasurySnapshot: async () => ({ turn: 0, funds: 10000 }),
  recordCommercialRouteFee: async () => ({ budget: { funds: 9500 } }),
};

describe('mapSessionApi', () => {
  beforeEach(async () => {
    resetCommerceContextForTests();
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
    await ensureHamletCatalog();
  });

  test('travelToHamlet rejects locked hamlets', async () => {
    const mapApi = createMapSessionApi({ commerce, housing, employment, accounting });
    const result = await mapApi.travelToHamlet('clairiere');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('locked');
    expect(getActiveHamletId()).toBe(DEFAULT_HAMLET_ID);
  });

  test('travelToHamlet switches active hamlet when unlocked', async () => {
    await unlockHamlet('clairiere');
    const mapApi = createMapSessionApi({ commerce, housing, employment, accounting });
    const result = await mapApi.travelToHamlet('clairiere');
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(false);
    expect(getActiveHamletId()).toBe('clairiere');
  });

  test('travelToHamlet is noop for already active hamlet', async () => {
    const mapApi = createMapSessionApi({ commerce, housing, employment, accounting });
    const result = await mapApi.travelToHamlet(DEFAULT_HAMLET_ID);
    expect(result.success).toBe(true);
    expect(result.alreadyActive).toBe(true);
  });
});
