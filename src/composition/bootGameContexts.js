/**
 * Wire BC contexts + ECS runtime for a game session.
 */

import { TimeManager } from '../shared/time/TimeManager.js';
import { getOrCreateParcelsContext } from './createParcelsContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { createServiceQueuePort } from './serviceQueuePort.js';
import { getOrCreateCitizenRegistry } from './citizenRegistry.js';
import { createConsumerMoneyPort } from './consumerMoneyPort.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateGameplayContext } from './createGameplayContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { getOrCreateTradeContext } from './createTradeContext.js';
import { createLandContext } from './createLandContext.js';
import { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';
import { createGameRuntime } from './createGameRuntime.js';
import { assembleSessionApi } from './sessionApi.js';
import { isCheatCodesAllowed } from '../config/cheatCodes.js';
import { GAME_CHEAT_FLAGS, readGameCheatFlag } from '../core/persistence/cheat/gameCheatFlags.js';

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
  const supply = getOrCreateSupplyContext({
    consumerMoney: createConsumerMoneyPort(accounting),
    serviceQueue: createServiceQueuePort(getOrCreateCitizenRegistry()),
  });
  // A house reaches level 3 only if its own business can reach a warehouse: no 'no-hub' gap in any of its recipes.
  housing.setActivityAccessCheck(async (house) => {
    const gaps = await supply.describeActivitySupplyAccess({ id: house.id, type: house.type, x: house.x, y: house.y });
    return !gaps.some((gap) => gap.status === 'no-hub');
  });
  // The cheat that lifts every house to its highest level: in force only while the player allows cheat codes (Paramètres) AND this game holds the flag.
  housing.setLevelsUnlockedCheck(async () =>
    isCheatCodesAllowed() && (await readGameCheatFlag(GAME_CHEAT_FLAGS.houseLevelsUnlocked)));
  // The cheat MaxPop<n>: every house holds exactly n inhabitants — the same two conditions (allowed in Paramètres, flag held by this game).
  housing.setPopulationOverrideCheck(async () =>
    isCheatCodesAllowed() ? await readGameCheatFlag(GAME_CHEAT_FLAGS.housePopulation) : null);
  const intelligence = getOrCreateIntelligenceContext();
  const trade = getOrCreateTradeContext({ supply, accounting });
  const land = createLandContext({ supply, accounting, construction });
  const sessionApi = assembleSessionApi({
    construction,
    accounting,
    cityAssets,
    supply,
    employment,
    housing,
    parcels,
    intelligence,
    gameplay,
  });
  const runtime = createGameRuntime({
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    intelligence,
    trade,
    land,
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
    land,
    sessionApi,
    runtime,
  };
}
