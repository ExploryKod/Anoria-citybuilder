/**
 * Wire BC contexts + ECS runtime for a game session.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { createConsumerMoneyPort } from './consumerMoneyPort.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateGameplayContext } from './createGameplayContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { getOrCreateTradeContext } from './createTradeContext.js';
import { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';
import { createGameRuntime } from './createGameRuntime.js';
import { assembleSessionApi } from './sessionApi.js';

/**
 * @returns {{
 *   parcels: object,
 *   supply: object,
 *   housing: object,
 *   employment: object,
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
  const housing = getOrCreateHousingContext();
  const employment = getOrCreateEmploymentContext({
    citizenProvidesSkillAtLevel: (house, skillKey, requiredLevel) =>
      housing.citizenProvidesSkillAtLevel(house, skillKey, requiredLevel),
  });
  const gameplay = getOrCreateGameplayContext();
  const construction = getOrCreateConstructionContext();
  const cityAssets = getOrCreateCityAssetsContext();
  const accounting = getOrCreateAccountingContext({
    cityAssets,
    getLabourMarket: () => employment.getLabourMarket(),
    // A service is billed at the price its seller sold it at (the supply's price book, built after the accounting: read at call time).
    getSellingPrice: (building, category, period) => supply.sellingPriceOf(building, category, period),
    // What a company's stock is worth at cost, for its balance sheet.
    valueStock: (buildingId, period) => supply.valueStockOf(buildingId, period),
    // The shelves' prices, for the cost of living.
    listSellingPrices: (period) => supply.listSellingPrices(period),
    listServicePrices: (period) => supply.listServicePrices(period),
  });
  // The supply needs the consumers' money (their personal accounts), so the accounting exists first.
  const supply = getOrCreateSupplyContext({ consumerMoney: createConsumerMoneyPort(accounting) });
  // A house reaches level 3 only if its own business can reach a warehouse: no 'no-hub' gap in any of its recipes.
  housing.setActivityAccessCheck(async (house) => {
    const gaps = await supply.describeActivitySupplyAccess({ id: house.id, type: house.type, x: house.x, y: house.y });
    return !gaps.some((gap) => gap.status === 'no-hub');
  });
  const intelligence = getOrCreateIntelligenceContext();
  const trade = getOrCreateTradeContext({ supply, accounting });
  const sessionApi = assembleSessionApi({
    construction,
    accounting,
    cityAssets,
    supply,
    employment,
    housing,
    parcels,
    intelligence,
  });
  const runtime = createGameRuntime({
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    intelligence,
    trade,
    getTimeInfo: (turn) => TimeManager.getTimeInfo(turn),
    toSupplySeason,
    toSupplyMonth,
    getSkillPriorities: () => employment.getAllSkillPriorities(),
  });

  return {
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    construction,
    accounting,
    intelligence,
    trade,
    sessionApi,
    runtime,
  };
}
