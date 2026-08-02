import { getBuildingSupplyFlow, SUPPLY_FLOW } from './SupplyFlow.js';
import { getFactoryMaxStorage } from './ProductRecipeCatalog.js';
import { workerProductionPercentage } from './FactoryStoragePolicy.js';

/**
 * Split of a raw-material line between direct output (export / city distribution)
 * and the manufacturing pipeline (transform → finished goods).
 *
 * @typedef {{ direct: number, manufacturing: number }} LineAllocation
 */

/** Default % targets when no player config (commerce wood → barn as raw wood). */
export const DEFAULT_LINE_ALLOCATIONS_BY_FLOW = Object.freeze({
  [SUPPLY_FLOW.COMMERCE]: Object.freeze({
    wood: Object.freeze({ direct: 100, manufacturing: 0 }),
    furniture: Object.freeze({ direct: 100, manufacturing: 0 }),
  }),
  [SUPPLY_FLOW.CITY]: Object.freeze({
    wood: Object.freeze({ direct: 0, manufacturing: 100 }),
    furniture: Object.freeze({ direct: 0, manufacturing: 100 }),
  }),
});

/** UI / gameplay destinations for each factory line. */
export const FACTORY_LINE_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'direct', label: 'vente directe' }),
  Object.freeze({ id: 'manufacturing', label: 'pour fabrication' }),
]);

/**
 * @param {string} productId
 * @param {'direct'|'manufacturing'} destination
 */
export function factoryLineDestinationKey(productId, destination) {
  return `${productId}:${destination}`;
}

/**
 * Effective production ceiling for a factory line (workers × storage rules).
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {number} [maxWorkersPerProduct=2]
 */
export function computeFactoryLineProductionMax(
  factory,
  productId,
  maxWorkersPerProduct = 2
) {
  const productWorkerDistribution = factory?.productWorkerDistribution || {};
  const productProductionPercentages = factory?.productProductionPercentages || {};
  const allocatedWorkers = productWorkerDistribution[productId] || 0;

  if (allocatedWorkers <= 0) return 0;

  let productionPercentage = productProductionPercentages[productId];
  if (productionPercentage === undefined) {
    productionPercentage = workerProductionPercentage(
      allocatedWorkers,
      maxWorkersPerProduct
    );
  }

  const maxStorage = getFactoryMaxStorage(productId);
  if (productionPercentage >= 100) return maxStorage;
  return Math.floor(maxStorage * (productionPercentage / 100));
}

/**
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {'direct'|'manufacturing'} destination
 */
export function getConfiguredFactoryLineMaxCap(factory, productId, destination) {
  const key = factoryLineDestinationKey(productId, destination);
  const configured = factory?.lineMaxCaps?.[key];
  if (configured === undefined || configured === null) return undefined;
  return Math.max(0, Math.floor(Number(configured) || 0));
}

/**
 * Player cap for a destination line, clamped to the line production max.
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {'direct'|'manufacturing'} destination
 * @param {number} productionMax
 */
export function getFactoryLineMaxCap(factory, productId, destination, productionMax) {
  const configured = getConfiguredFactoryLineMaxCap(factory, productId, destination);
  const ceiling = Math.max(0, Math.floor(Number(productionMax) || 0));
  if (configured === undefined) return ceiling;
  return Math.min(configured, ceiling);
}

/**
 * @param {number|string|null|undefined} value
 * @param {number} productionMax
 */
export function normalizeFactoryLineMaxCap(value, productionMax) {
  const ceiling = Math.max(0, Math.floor(Number(productionMax) || 0));
  return Math.min(Math.max(0, Math.floor(Number(value) || 0)), ceiling);
}

/**
 * Paired max caps for direct + manufacturing (communicating vessels — sum = productionMax).
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {number} productionMax
 * @returns {{ direct: number, manufacturing: number }}
 */
export function getFactoryLineMaxCapsPair(factory, productId, productionMax) {
  const ceiling = Math.max(0, Math.floor(Number(productionMax) || 0));
  const caps = factory?.lineMaxCaps || {};
  const directKey = factoryLineDestinationKey(productId, 'direct');
  const manufacturingKey = factoryLineDestinationKey(productId, 'manufacturing');
  const directConfigured = caps[directKey];
  const manufacturingConfigured = caps[manufacturingKey];

  if (directConfigured !== undefined && manufacturingConfigured !== undefined) {
    const direct = normalizeFactoryLineMaxCap(directConfigured, ceiling);
    const manufacturing = normalizeFactoryLineMaxCap(manufacturingConfigured, ceiling);
    const total = direct + manufacturing;
    if (total <= ceiling) {
      return { direct, manufacturing };
    }
    const scale = ceiling / total;
    return {
      direct: Math.floor(direct * scale),
      manufacturing: Math.floor(manufacturing * scale),
    };
  }

  if (directConfigured !== undefined) {
    const direct = normalizeFactoryLineMaxCap(directConfigured, ceiling);
    return { direct, manufacturing: Math.max(0, ceiling - direct) };
  }

  if (manufacturingConfigured !== undefined) {
    const manufacturing = normalizeFactoryLineMaxCap(manufacturingConfigured, ceiling);
    return { direct: Math.max(0, ceiling - manufacturing), manufacturing };
  }

  return { direct: ceiling, manufacturing: 0 };
}

/**
 * Rebalance caps when the player edits one destination (vase communicant).
 *
 * @param {string} productId
 * @param {'direct'|'manufacturing'} editedDestination
 * @param {number|string} newValue
 * @param {number} productionMax
 * @returns {Record<string, number>}
 */
export function rebalanceFactoryLineMaxCaps(
  productId,
  editedDestination,
  newValue,
  productionMax
) {
  const ceiling = Math.max(0, Math.floor(Number(productionMax) || 0));
  const normalized = normalizeFactoryLineMaxCap(newValue, ceiling);
  const directKey = factoryLineDestinationKey(productId, 'direct');
  const manufacturingKey = factoryLineDestinationKey(productId, 'manufacturing');

  if (editedDestination === 'direct') {
    return {
      [directKey]: normalized,
      [manufacturingKey]: Math.max(0, ceiling - normalized),
    };
  }

  return {
    [directKey]: Math.max(0, ceiling - normalized),
    [manufacturingKey]: normalized,
  };
}

/**
 * Display value for admin UI (paired caps — sum equals production max).
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {'direct'|'manufacturing'} destination
 * @param {number} productionMax
 */
export function getFactoryLineMaxCapDisplayValue(
  factory,
  productId,
  destination,
  productionMax
) {
  const pair = getFactoryLineMaxCapsPair(factory, productId, productionMax);
  return destination === 'direct' ? pair.direct : pair.manufacturing;
}

/**
 * A destination line is active when its max cap is greater than zero.
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {'direct'|'manufacturing'} destination
 */
export function isFactoryLineDestinationEnabled(factory, productId, destination) {
  const workerMax = computeFactoryLineProductionMax(factory, productId);
  const ceiling = lineMaxCeiling(workerMax, productId);
  const pair = getFactoryLineMaxCapsPair(factory, productId, ceiling);
  const cap = destination === 'direct' ? pair.direct : pair.manufacturing;
  return cap > 0;
}

/**
 * Allocation derived from player max caps (vase communicant).
 *
 * @param {object|null|undefined} factory
 * @param {string} resourceType
 */
export function getEffectiveFactoryLineAllocation(factory, resourceType) {
  const workerMax = computeFactoryLineProductionMax(factory, resourceType);
  const productionMax = lineMaxCeiling(workerMax, resourceType);
  if (productionMax <= 0) {
    return { direct: 0, manufacturing: 0 };
  }

  const pair = getFactoryLineMaxCapsPair(factory, resourceType, productionMax);
  if (pair.direct <= 0 && pair.manufacturing <= 0) {
    return { direct: 0, manufacturing: 0 };
  }
  if (pair.direct > 0 && pair.manufacturing <= 0) {
    return { direct: 100, manufacturing: 0 };
  }
  if (pair.direct <= 0 && pair.manufacturing > 0) {
    return { direct: 0, manufacturing: 100 };
  }

  return normalizeLineAllocation({
    direct: (pair.direct / productionMax) * 100,
    manufacturing: (pair.manufacturing / productionMax) * 100,
  });
}

/**
 * Upper bound for a player-configured line max (worker ceiling or storage rules).
 *
 * @param {number} productionMax
 * @param {string} productId
 */
function lineMaxCeiling(productionMax, productId) {
  const workersMax = Math.max(0, Math.floor(Number(productionMax) || 0));
  if (workersMax > 0) return workersMax;
  return getFactoryMaxStorage(productId);
}

/**
 * Stock attributed to a destination line (display + transfer limits).
 *
 * @param {number} stock
 * @param {number} destinationCap
 * @param {number} siblingCap
 */
export function stockForDestinationCap(stock, destinationCap, siblingCap) {
  const totalStock = Math.max(0, Math.floor(Number(stock) || 0));
  const cap = Math.max(0, Math.floor(Number(destinationCap) || 0));
  const sibling = Math.max(0, Math.floor(Number(siblingCap) || 0));
  if (cap <= 0 || totalStock <= 0) return 0;

  // Hard cap per line; split proportionally only when both lines are active.
  if (sibling > 0) {
    const share = Math.floor(totalStock * (cap / (cap + sibling)));
    return Math.min(share, cap);
  }
  return Math.min(totalStock, cap);
}

/**
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {number} totalStock
 * @param {number} [productionMax]
 */
export function getDirectSaleStockAmount(factory, productId, totalStock, productionMax) {
  if (!isFactoryLineDestinationEnabled(factory, productId, 'direct')) {
    return 0;
  }
  const workerMax =
    productionMax !== undefined
      ? productionMax
      : computeFactoryLineProductionMax(factory, productId);
  const ceiling = lineMaxCeiling(workerMax, productId);
  const pair = getFactoryLineMaxCapsPair(factory, productId, ceiling);
  const stock = Math.max(0, Math.floor(Number(totalStock) || 0));
  return Math.min(stock, pair.direct);
}

/**
 * Manufacturing-eligible stock after cap split.
 *
 * @param {object|null|undefined} factory
 * @param {string} productId
 * @param {number} collectedStock
 * @param {number} [productionMax]
 */
export function getManufacturingEligibleStock(
  factory,
  productId,
  collectedStock,
  productionMax
) {
  if (!isFactoryLineDestinationEnabled(factory, productId, 'manufacturing')) {
    return 0;
  }
  const workerMax =
    productionMax !== undefined
      ? productionMax
      : computeFactoryLineProductionMax(factory, productId);
  const ceiling = lineMaxCeiling(workerMax, productId);
  const pair = getFactoryLineMaxCapsPair(factory, productId, ceiling);
  const stock = Math.max(0, Math.floor(Number(collectedStock) || 0));
  return Math.min(stock, pair.manufacturing);
}

/**
 * @param {LineAllocation|undefined|null} allocation
 * @returns {LineAllocation}
 */
export function normalizeLineAllocation(allocation) {
  const direct = Math.max(0, Math.min(100, Number(allocation?.direct) || 0));
  const manufacturing = Math.max(0, Math.min(100, Number(allocation?.manufacturing) || 0));
  const total = direct + manufacturing;

  if (total === 0) {
    return { direct: 100, manufacturing: 0 };
  }
  if (total === 100) {
    return { direct, manufacturing };
  }

  return {
    direct: Math.round((direct / total) * 100),
    manufacturing: Math.round((manufacturing / total) * 100),
  };
}

/**
 * @param {object|null|undefined} factory
 * @param {string} resourceType
 * @returns {LineAllocation}
 */
export function getFactoryLineAllocation(factory, resourceType) {
  const flow = getBuildingSupplyFlow(factory);
  const configured = factory?.lineAllocations?.[resourceType];
  if (configured) {
    return normalizeLineAllocation(configured);
  }
  const defaults = DEFAULT_LINE_ALLOCATIONS_BY_FLOW[flow]?.[resourceType];
  return normalizeLineAllocation(defaults);
}

/**
 * Caps transform input: only the manufacturing share of collected stock is eligible.
 *
 * @param {number} collectedStock — stock snapshot used for this transform cycle
 * @param {LineAllocation} allocation
 */
export function manufacturingEligibleStock(collectedStock, allocation) {
  const stock = Math.max(0, collectedStock);
  const { manufacturing } = normalizeLineAllocation(allocation);
  if (manufacturing <= 0) return 0;
  return Math.floor(stock * (manufacturing / 100));
}

/**
 * Stock reserved for direct output (barn transfer or city distribution).
 *
 * @param {number} collectedStock
 * @param {LineAllocation} allocation
 */
export function directOutputReservedStock(collectedStock, allocation) {
  const stock = Math.max(0, collectedStock);
  const { direct } = normalizeLineAllocation(allocation);
  if (direct <= 0) return 0;
  return Math.floor(stock * (direct / 100));
}
