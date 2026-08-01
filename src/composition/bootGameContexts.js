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
import { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';
import { createGameRuntime } from './createGameRuntime.js';

/**
 * @returns {{
 *   parcels: object,
 *   supply: object,
 *   housing: object,
 *   employment: object,
 *   commerce: object,
 *   gameplay: object,
 *   runtime: ReturnType<typeof createGameRuntime>,
 * }}
 */
export function bootGameContexts() {
  const parcels = getOrCreateParcelsContext();
  const supply = getOrCreateSupplyContext();
  const housing = getOrCreateHousingContext();
  const employment = getOrCreateEmploymentContext();
  employment.ensureSectorPrioritiesInitialized();
  const commerce = getOrCreateCommerceContext();
  const gameplay = getOrCreateGameplayContext();
  const runtime = createGameRuntime({
    parcels,
    supply,
    housing,
    employment,
    commerce,
    gameplay,
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
    runtime,
  };
}
