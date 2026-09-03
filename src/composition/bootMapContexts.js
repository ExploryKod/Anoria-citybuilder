import { waitForDatabaseReady } from '../core/persistence/dexie/db.js';
import { ensureHamletCatalog } from '../core/persistence/hamlet/hamletSession.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { createMapSessionApi } from './mapSessionApi.js';

/**
 * Light bootstrap for /world — no game runtime or ECS tick.
 * @returns {Promise<{ mapApi: ReturnType<typeof createMapSessionApi> }>}
 */
export async function bootMapContexts() {
  await waitForDatabaseReady();
  await ensureHamletCatalog();

  const housing = getOrCreateHousingContext();
  const employment = getOrCreateEmploymentContext({
    citizenProvidesSkill: (house, skillKey) => housing.citizenProvidesSkill(house, skillKey),
  });
  const cityAssets = getOrCreateCityAssetsContext();
  const accounting = getOrCreateAccountingContext({ cityAssets });

  const mapApi = createMapSessionApi({
    housing,
    employment,
    accounting,
    cityAssets,
  });

  return { mapApi };
}
