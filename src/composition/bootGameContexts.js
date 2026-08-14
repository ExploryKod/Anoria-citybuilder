/**
 * Wire BC contexts + ECS runtime for a game session.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateCommerceContext } from './createCommerceContext.js';
import { getOrCreateGameplayContext } from './createGameplayContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';
import { createGameRuntime } from './createGameRuntime.js';
import { assembleSessionApi } from './sessionApi.js';

/**
 * @returns {{
 *   parcels: object,
 *   supply: object,
 *   housing: object,
 *   employment: object,
 *   commerce: object,
 *   gameplay: object,
 *   construction: object,
 *   accounting: object,
 *   intelligence: object,
 *   sessionApi: ReturnType<typeof assembleSessionApi>,
 *   runtime: ReturnType<typeof createGameRuntime>,
 * }}
 */
export function bootGameContexts() {
  const parcels = getOrCreateParcelsContext();
  const supply = getOrCreateSupplyContext();
  const housing = getOrCreateHousingContext();
  const employment = getOrCreateEmploymentContext({
    citizenProvidesSkill: (house, skillKey) => housing.citizenProvidesSkill(house, skillKey),
  });
  employment.ensureSectorPrioritiesInitialized();
  const commerce = getOrCreateCommerceContext({
    barnStockOperations: supply.barnStockOperations,
  });
  const gameplay = getOrCreateGameplayContext();
  const construction = getOrCreateConstructionContext();
  const cityAssets = getOrCreateCityAssetsContext();
  const accounting = getOrCreateAccountingContext({ cityAssets });
  const intelligence = getOrCreateIntelligenceContext();
  const sessionApi = assembleSessionApi({
    construction,
    accounting,
    cityAssets,
    supply,
    employment,
    housing,
    commerce,
    parcels,
    intelligence,
  });
  const runtime = createGameRuntime({
    parcels,
    supply,
    housing,
    employment,
    commerce,
    gameplay,
    intelligence,
    getTimeInfo: (turn) => TimeManager.getTimeInfo(turn),
    toSupplySeason,
    toSupplyMonth,
    getSectorPriorities: () => employment.getAllSectorPriorities(),
    foodDistributionDistance: DEFAULT_FOOD_DISTRIBUTION_DISTANCE,
  });

  return {
    parcels,
    supply,
    housing,
    employment,
    commerce,
    gameplay,
    construction,
    accounting,
    intelligence,
    sessionApi,
    runtime,
  };
}
