import { getResourceRoles } from '../building-catalog/resourceRoleQueries.js';
import { getResourceBaseValue, getServiceCategories } from './ResourceCategoryCatalog.js';

/**
 * The value chain of a good, in the order its stages sell it: a producer makes it, a hub stores it, a distributor sells
 * it to the houses. Each stage sells at its buyer's price plus its own margin, so the price of a unit grows along the
 * chain (a real markup). Declared once, here: the supply logs each transfer at its seller's price, and accounting reads
 * the same rows. Services are not part of the chain: they are priced at their base value.
 */
export const MARGIN_BY_STAGE = Object.freeze({ producer: 0.2, hub: 0.2, distributor: 0.25 });

const STAGE_ORDER = Object.freeze(['producer', 'hub', 'distributor']);

/**
 * The stage a building type sells at: its first role in STAGE_ORDER.
 * @param {string} buildingType
 * @returns {'producer' | 'hub' | 'distributor'}
 */
export function stageOfBuildingType(buildingType) {
  const roles = getResourceRoles(buildingType).map((entry) => entry.role);
  const stage = STAGE_ORDER.find((candidate) => roles.includes(candidate));
  if (!stage) throw new Error(`[value-chain] "${buildingType}" sells no good: it has no producer, hub or distributor role`);
  return stage;
}

/**
 * The unit price a building sells a good at: the good's base value, marked up by every stage up to the building's own.
 * A service is not marked up.
 * @param {string} buildingType the seller
 * @param {string} category the good or service
 * @returns {number} in euros, to the centime
 */
export function unitPriceOf(buildingType, category) {
  const base = getResourceBaseValue(category);
  if (getServiceCategories().includes(category)) return base;
  const sellerStage = stageOfBuildingType(buildingType);
  let price = base;
  for (const stage of STAGE_ORDER) {
    price *= 1 + MARGIN_BY_STAGE[stage];
    if (stage === sellerStage) break;
  }
  return Math.round(price * 100) / 100;
}
