import { getBuildingSupplyFlow, SUPPLY_FLOW } from './SupplyFlow.js';

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
  }),
  [SUPPLY_FLOW.CITY]: Object.freeze({
    wood: Object.freeze({ direct: 0, manufacturing: 100 }),
  }),
});

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
