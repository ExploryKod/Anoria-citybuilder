import { FOOD_CIRCUIT } from './FoodCircuitCatalog.js';
import { cropFromFarmType } from '../value-objects/CropType.js';
import { canFarmHarvest } from '../policies/HarvestSeasonPolicy.js';
import { annualFarmYield } from '../policies/FarmYieldPolicy.js';
import { canWindmillCollectFromFarms } from '../policies/CollectingMonthPolicy.js';
import {
  canMarketBuyFromWindmill,
  canMarketDistributeToHouses,
} from '../policies/BuyingSeasonPolicy.js';
import { applyHouseFoodConsumption } from '../policies/HouseConsumptionPolicy.js';

/**
 * Circuit descriptors for the food loop: each one binds the generic
 * production/collection/transfer/distribution/consumption commands to
 * food's own categories, timing rules and repository field names. A new
 * circuit (e.g. water) gets its own sibling descriptor here — the generic
 * commands never change.
 */

/** Farm produces its annual crop harvest into its own stock (autumn, once/year). */
export const FARM_HARVEST_CIRCUIT = Object.freeze({
  categories: FOOD_CIRCUIT.crops,
  totalKey: 'food',
  canProduce: (period) => canFarmHarvest(period.season),
  resourceCategoryForBuilding: (buildingType) => cropFromFarmType(buildingType),
  yieldAmount: () => annualFarmYield(),
  lastProducedField: 'lastProductionYear',
  periodKey: (period) => (Number.isFinite(period.year) ? Math.floor(period.year) : 0),
  saveProductionMetadata: (repository, buildingId, period) => {
    const fields = { lastProductionYear: Number.isFinite(period.year) ? Math.floor(period.year) : 0 };
    if (Number.isFinite(period.monthIndex)) {
      fields.lastProductionMonth = period.monthIndex;
    }
    return repository.updateBuildingFields(buildingId, fields);
  },
});

/** Windmill collects crop surplus from nearby farms (December only). */
export const WINDMILL_COLLECT_CIRCUIT = Object.freeze({
  categories: FOOD_CIRCUIT.crops,
  totalKey: 'food',
  canCollect: (period) => canWindmillCollectFromFarms(period.month),
  resourceCategoryForBuilding: (buildingType) => cropFromFarmType(buildingType),
});

/** Market restocks from its assigned windmill's allocation bucket (monthly). */
export const MARKET_WINDMILL_TRANSFER_CIRCUIT = Object.freeze({
  categories: FOOD_CIRCUIT.crops,
  totalKey: 'food',
  canTransfer: (period) => canMarketBuyFromWindmill(period.month),
  sourceLinkField: 'supplyWindmillId',
  linksField: 'linkedMarkets',
  linkTargetIdField: 'marketId',
  allocationField: 'allocatedStocks',
  saveLinks: (repository, sourceId, links) => repository.saveLinkedMarkets(sourceId, links),
});

/** Market distributes crops to houses in range (every month). */
export const MARKET_DISTRIBUTE_CIRCUIT = Object.freeze({
  categories: FOOD_CIRCUIT.crops,
  totalKey: 'food',
  canDistribute: (period) => canMarketDistributeToHouses(period.season),
});

/** House consumes food baskets for its population (monthly). */
export const HOUSE_FOOD_CONSUMPTION_CIRCUIT = Object.freeze({
  periodKey: (period) => (Number.isFinite(period.monthIndex) ? Math.floor(period.monthIndex) : 0),
  lastConsumedField: 'lastConsumptionMonth',
  applyConsumption: applyHouseFoodConsumption,
  saveConsumptionMetadata: (repository, buildingId, periodKey, period, record) =>
    repository.updateBuildingFields(buildingId, {
      lastConsumptionMonth: periodKey,
      lastConsumption: { month: period.monthIndex, ...record },
    }),
});
