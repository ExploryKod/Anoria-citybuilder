import { waitForDatabaseReady } from '../core/persistence/dexie/db.js';
import { ensureHamletCatalog } from '../core/persistence/hamlet/hamletSession.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { createConsumerMoneyPort } from './consumerMoneyPort.js';
import { getOrCreateTradeContext } from './createTradeContext.js';
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
    citizenProvidesSkillAtLevel: (house, skillKey, requiredLevel) =>
      housing.citizenProvidesSkillAtLevel(house, skillKey, requiredLevel),
  });
  const cityAssets = getOrCreateCityAssetsContext();
  const accounting = getOrCreateAccountingContext({ cityAssets });
  const supply = getOrCreateSupplyContext({ consumerMoney: createConsumerMoneyPort(accounting) });
  const trade = getOrCreateTradeContext({ supply, accounting });

  const mapApi = createMapSessionApi({
    housing,
    employment,
    accounting,
    cityAssets,
    trade,
  });

  return { mapApi };
}
