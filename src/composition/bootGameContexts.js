/**
 * Wire BC contexts + ECS runtime for a game session.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { getAllSectorPriorities } from '../js/acl/employment.js';
import { getOrCreateParcelsContext } from '../js/acl/parcels.js';
import {
  getOrCreateSupplyContext,
  toSupplySeason,
  toSupplyMonth,
  getDefaultFoodDistributionDistance,
} from '../js/acl/supply.js';
import { getOrCreateHousingContext } from '../js/acl/housing.js';
import {
  getOrCreateEmploymentContext,
  ensureSectorPrioritiesInitialized,
} from '../js/acl/employment.js';
import { getOrCreateCommerceContext } from '../js/acl/commerce.js';
import { getOrCreateGameplayContext } from '../js/acl/gameplay.js';
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
  ensureSectorPrioritiesInitialized();
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
    getSectorPriorities: getAllSectorPriorities,
    foodDistributionDistance: getDefaultFoodDistributionDistance(),
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
