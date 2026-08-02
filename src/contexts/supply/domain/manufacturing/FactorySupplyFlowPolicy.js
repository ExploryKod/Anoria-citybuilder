import { SUPPLY_FLOW, getBuildingSupplyFlow } from './SupplyFlow.js';
import { FACTORY_RESOURCE_TYPES } from './ProductRecipeCatalog.js';

/** Collect / transform worker keys allowed per dedicated flow (MVP). */
export const FACTORY_RESOURCE_LINES_BY_FLOW = Object.freeze({
  [SUPPLY_FLOW.COMMERCE]: Object.freeze(['wood']),
  [SUPPLY_FLOW.CITY]: Object.freeze([...FACTORY_RESOURCE_TYPES]),
});

/** Finished goods worker keys allowed per dedicated flow (MVP). */
export const FACTORY_PRODUCT_LINES_BY_FLOW = Object.freeze({
  [SUPPLY_FLOW.COMMERCE]: Object.freeze(['furniture']),
  [SUPPLY_FLOW.CITY]: Object.freeze([
    'furniture',
    'weapons',
    'pottery',
    'jewelry',
  ]),
});

/**
 * @param {'city'|'commerce'} flow
 * @param {string} resourceType
 */
export function isResourceLineAllowedForFlow(flow, resourceType) {
  const allowed = FACTORY_RESOURCE_LINES_BY_FLOW[flow] ?? [];
  return allowed.includes(resourceType);
}

/**
 * @param {'city'|'commerce'} flow
 * @param {string} productType
 */
export function isProductLineAllowedForFlow(flow, productType) {
  const allowed = FACTORY_PRODUCT_LINES_BY_FLOW[flow] ?? [];
  return allowed.includes(productType);
}

/**
 * @param {object|null|undefined} factory
 * @param {string} resourceType
 */
export function canFactoryCollectResource(factory, resourceType) {
  const flow = getBuildingSupplyFlow(factory);
  return isResourceLineAllowedForFlow(flow, resourceType);
}

/**
 * @param {object|null|undefined} factory
 * @param {string} resourceType — transform worker key (wood, gold, …)
 */
export function canFactoryTransformResource(factory, resourceType) {
  return canFactoryCollectResource(factory, resourceType);
}

/**
 * @param {object|null|undefined} factory
 * @param {string} productType
 */
export function canFactoryProduceProduct(factory, productType) {
  const flow = getBuildingSupplyFlow(factory);
  return isProductLineAllowedForFlow(flow, productType);
}

/**
 * @param {object|null|undefined} factory
 */
export function isCommerceFactory(factory) {
  return getBuildingSupplyFlow(factory) === SUPPLY_FLOW.COMMERCE;
}

/**
 * @param {object|null|undefined} factory
 */
export function isCityFactory(factory) {
  return getBuildingSupplyFlow(factory) === SUPPLY_FLOW.CITY;
}

/**
 * Human-readable label for admin UI.
 * @param {'city'|'commerce'} flow
 */
export function getSupplyFlowLabel(flow) {
  return flow === SUPPLY_FLOW.COMMERCE ? 'Commerce' : 'Ville';
}
