import { beforeEach, describe, expect, test } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../../src/core/persistence/dexie/db.js';
import { unlockHamlet } from '../../../src/core/persistence/hamlet/hamletAccess.js';
import {
  DEFAULT_HAMLET_ID,
  ensureHamletCatalog,
  setActiveHamletId,
} from '../../../src/core/persistence/hamlet/hamletSession.js';
import { buildWorldMapView } from '../../../src/contexts/geography/application/queries/buildWorldMapView.js';

const commerceApi = {
  loadOrSeedCommercePartners: () => [
    {
      id: 'olivea',
      name: 'Olivea',
      description: 'Test partner',
      isActive: false,
      buysFromUs: [],
      sellsToUs: [],
    },
  ],
  loadCommerceStats: () => ({ yearlyExports: {}, yearlyImports: {} }),
  loadOrSeedCommerceConfig: () => [],
};

describe('buildWorldMapView', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
    await ensureHamletCatalog();
  });

  test('builds kingdom influence from unlocked hamlets', async () => {
    const view = await buildWorldMapView({
      commerceApi,
      activationByPartnerId: { olivea: { canActivate: true, unmetConditions: [] } },
    });

    expect(view.kingdom.id).toBe('anoria');
    expect(view.kingdom.influence).toBeCloseTo(0.1);
    expect(view.cities.length).toBeGreaterThan(0);
    expect(view.partners).toHaveLength(1);
  });

  test('increases influence when more hamlets are unlocked', async () => {
    await unlockHamlet('clairiere');
    await unlockHamlet('prevert');

    const view = await buildWorldMapView({
      commerceApi,
      activationByPartnerId: { olivea: { canActivate: false, unmetConditions: ['population'] } },
    });

    expect(view.kingdom.unlockedHamlets).toBe(3);
    expect(view.kingdom.influence).toBeCloseTo(0.3);
    expect(view.partners[0].canActivate).toBe(false);
  });
});
