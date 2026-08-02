import {
  listFinishedFactoryCommodities,
  listRawFactoryCommodities,
  getFactoryCommodity,
  getFactoryMaxStorage,
  getFactoryWorkerNeed,
} from './ProductRecipeCatalog.js';
import {
  canFactoryCollectResource,
  canFactoryProduceProduct,
} from './FactorySupplyFlowPolicy.js';
import { getFactoryLineMaxCapsPair } from './FactoryLineAllocationPolicy.js';
import { isFactoryCommodityProductionEnabled } from './FactoryCommodityProductionPolicy.js';
import { workerProductionPercentage } from './FactoryStoragePolicy.js';

/** Physical recruitment ceiling for a Winery (city employment pool). */
export const FACTORY_BUILDING_MAX_WORKERS = 18;

/**
 * Commodity lines allowed for this factory's supply flow (stable order).
 *
 * @param {object|null|undefined} factory
 * @returns {string[]}
 */
export function listFactoryCommodityLinesForFactory(factory) {
  const lines = [];
  for (const commodity of listRawFactoryCommodities()) {
    if (canFactoryCollectResource(factory, commodity.id)) {
      lines.push(commodity.id);
    }
  }
  for (const commodity of listFinishedFactoryCommodities()) {
    if (canFactoryProduceProduct(factory, commodity.id)) {
      lines.push(commodity.id);
    }
  }
  return lines;
}

/**
 * Worker demand for one commodity line, derived from configured destination caps.
 * Full cap (sum = storage max) ⇒ max workers for that commodity (usually 2).
 *
 * @param {object|null|undefined} factory
 * @param {string} commodityId
 */
export function computeFactoryCommodityWorkerDemand(factory, commodityId) {
  if (!isFactoryCommodityProductionEnabled(factory, commodityId)) {
    return 0;
  }

  const commodity = getFactoryCommodity(commodityId);
  if (!commodity) return 0;

  const storageMax = getFactoryMaxStorage(commodityId);
  const pair = getFactoryLineMaxCapsPair(factory, commodityId, storageMax);
  const capTotal = pair.direct + pair.manufacturing;
  if (capTotal <= 0) return 0;

  const maxWorkers = getFactoryWorkerNeed(commodityId);
  return Math.min(
    maxWorkers,
    Math.max(1, Math.ceil((capTotal / storageMax) * maxWorkers))
  );
}

/**
 * @param {object|null|undefined} factory
 * @returns {Record<string, number>}
 */
export function computeFactoryCommodityWorkerDemands(factory) {
  /** @type {Record<string, number>} */
  const demands = {};
  for (const commodityId of listFactoryCommodityLinesForFactory(factory)) {
    const demand = computeFactoryCommodityWorkerDemand(factory, commodityId);
    if (demand > 0) {
      demands[commodityId] = demand;
    }
  }
  return demands;
}

/**
 * Total workers the factory requests from city employment (capped at building max).
 *
 * @param {object|null|undefined} factory
 */
export function computeFactoryTotalWorkerNeed(factory) {
  const total = Object.values(computeFactoryCommodityWorkerDemands(factory)).reduce(
    (sum, demand) => sum + demand,
    0
  );
  return Math.min(FACTORY_BUILDING_MAX_WORKERS, total);
}

/**
 * A line is active when its cap-driven worker demand is greater than zero.
 *
 * @param {object|null|undefined} factory
 * @param {string} commodityId
 */
export function isFactoryCommodityLineActive(factory, commodityId) {
  if (!isFactoryCommodityProductionEnabled(factory, commodityId)) {
    return false;
  }
  return computeFactoryCommodityWorkerDemand(factory, commodityId) > 0;
}

/**
 * Allocates factory-assigned workers to commodity lines by demand (catalog order).
 *
 * @param {object|null|undefined} factory
 * @returns {Record<string, number>}
 */
export function computeFactoryProductWorkerDistribution(factory) {
  const pool = Math.max(0, Math.floor(Number(factory?.employees?.worker) || 0));
  const lines = listFactoryCommodityLinesForFactory(factory);

  /** @type {Record<string, number>} */
  const distribution = {};
  let remaining = pool;

  for (const commodityId of lines) {
    const demand = computeFactoryCommodityWorkerDemand(factory, commodityId);
    if (demand <= 0 || remaining <= 0) continue;

    const assigned = Math.min(demand, remaining);
    distribution[commodityId] = assigned;
    remaining -= assigned;
  }

  return distribution;
}

/**
 * @param {object|null|undefined} factory
 * @param {Record<string, number>} [distribution]
 * @returns {Record<string, number>}
 */
export function computeFactoryProductProductionPercentages(
  factory,
  distribution = computeFactoryProductWorkerDistribution(factory)
) {
  /** @type {Record<string, number>} */
  const percentages = {};
  for (const [commodityId, workers] of Object.entries(distribution)) {
    percentages[commodityId] = workerProductionPercentage(
      workers,
      getFactoryWorkerNeed(commodityId)
    );
  }
  return percentages;
}
