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
  return unitPriceAtStage(stageOfBuildingType(buildingType), category);
}

/**
 * The unit price a good has once it has been sold by the given stage: the base value, marked up by every stage up to it.
 * @param {'producer' | 'hub' | 'distributor'} sellerStage
 * @param {string} category
 * @returns {number} in euros, to the centime
 */
export function unitPriceAtStage(sellerStage, category) {
  if (!STAGE_ORDER.includes(sellerStage)) throw new Error(`[value-chain] unknown stage "${sellerStage}"`);
  const base = getResourceBaseValue(category);
  if (getServiceCategories().includes(category)) return base;
  let price = base;
  for (const stage of STAGE_ORDER) {
    price *= 1 + MARGIN_BY_STAGE[stage];
    if (stage === sellerStage) break;
  }
  return Math.round(price * 100) / 100;
}

/**
 * How many past months of deliveries a warehouse's or a market's cost is averaged over: what it sells is priced on what its stock cost it,
 * not on the reference, so a change upstream (a customs duty, the merchants' freight) reaches the shelves as the new deliveries replace the old.
 */
export const COST_WINDOW_MONTHS = 3;

/**
 * The cost of a unit a building held before any delivery was recorded (the starter city, a building just built with a stock): valued at
 * what the stage before it sells at in the reference chain. It is the opening valuation of the books, a rule, not a guess.
 * @param {'hub' | 'distributor'} stage the building's own stage
 * @param {string} category
 * @returns {number}
 */
export function openingUnitCost(stage, category) {
  if (stage === 'hub') return unitPriceAtStage('producer', category);
  if (stage === 'distributor') return unitPriceAtStage('hub', category);
  throw new Error(`[value-chain] a "${stage}" holds no stock bought from another stage: it has no opening cost`);
}

/**
 * The unit price a building sells at, built on what its stock cost it: the cost marked up by its own stage's margin.
 * @param {'hub' | 'distributor'} stage
 * @param {number} unitCost
 * @returns {number} in euros, to the centime
 */
export function priceFromCost(stage, unitCost) {
  if (!(unitCost > 0)) throw new Error(`[value-chain] a ${stage} cannot price a unit of cost ${unitCost}`);
  return Math.round(unitCost * (1 + MARGIN_BY_STAGE[stage]) * 100) / 100;
}
