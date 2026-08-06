/** @typedef {'raw_material'|'finished_product'} FactoryCommodityKind */
/** @typedef {'direct'|'manufacturing'} FactoryLineDestination */

export const FACTORY_COMMODITY_KIND = Object.freeze({
  RAW_MATERIAL: 'raw_material',
  FINISHED_PRODUCT: 'finished_product',
});

const RAW = FACTORY_COMMODITY_KIND.RAW_MATERIAL;
const FINISHED = FACTORY_COMMODITY_KIND.FINISHED_PRODUCT;
const DIRECT = 'direct';
const BOTH = Object.freeze([DIRECT, 'manufacturing']);
const DIRECT_ONLY = Object.freeze([DIRECT]);

/**
 * Canonical factory commodity definitions (single source of truth).
 *
 * @type {Readonly<Record<string, Readonly<{
 *   id: string,
 *   kind: FactoryCommodityKind,
 *   lineDestinations: readonly FactoryLineDestination[],
 *   maxStorage: number,
 *   workerNeed: number,
 *   employeeRole: string,
 *   recipe?: Readonly<Record<string, number>>,
 *   productionTurns?: number,
 *   hasTransformation?: boolean,
 * }>>>}
 */
export const FACTORY_COMMODITIES = Object.freeze({
  wood: Object.freeze({
    id: 'wood',
    kind: RAW,
    lineDestinations: BOTH,
    maxStorage: 200,
    workerNeed: 2,
    employeeRole: 'bucheron',
  }),
  rock: Object.freeze({
    id: 'rock',
    kind: RAW,
    lineDestinations: BOTH,
    maxStorage: 200,
    workerNeed: 2,
    employeeRole: 'mineur',
  }),
  clay: Object.freeze({
    id: 'clay',
    kind: RAW,
    lineDestinations: BOTH,
    maxStorage: 200,
    workerNeed: 2,
    employeeRole: 'creuseur',
  }),
  iron: Object.freeze({
    id: 'iron',
    kind: RAW,
    lineDestinations: BOTH,
    maxStorage: 200,
    workerNeed: 2,
    employeeRole: 'mineur',
  }),
  gold: Object.freeze({
    id: 'gold',
    kind: RAW,
    lineDestinations: BOTH,
    maxStorage: 200,
    workerNeed: 2,
    employeeRole: 'mineur',
  }),
  furniture: Object.freeze({
    id: 'furniture',
    kind: FINISHED,
    lineDestinations: DIRECT_ONLY,
    maxStorage: 100,
    workerNeed: 2,
    employeeRole: 'menuisier',
    recipe: Object.freeze({ logs: 4 }),
    productionTurns: 1,
    hasTransformation: true,
  }),
  weapons: Object.freeze({
    id: 'weapons',
    kind: FINISHED,
    lineDestinations: DIRECT_ONLY,
    maxStorage: 100,
    workerNeed: 2,
    employeeRole: 'armurier',
    recipe: Object.freeze({ refinedIron: 4 }),
    productionTurns: 1,
    hasTransformation: true,
  }),
  pottery: Object.freeze({
    id: 'pottery',
    kind: FINISHED,
    lineDestinations: DIRECT_ONLY,
    maxStorage: 100,
    workerNeed: 2,
    employeeRole: 'potier',
    recipe: Object.freeze({ refinedClay: 4 }),
    productionTurns: 1,
    hasTransformation: true,
  }),
  jewelry: Object.freeze({
    id: 'jewelry',
    kind: FINISHED,
    lineDestinations: DIRECT_ONLY,
    maxStorage: 100,
    workerNeed: 2,
    employeeRole: 'bijoutier',
    recipe: Object.freeze({ refinedGold: 4 }),
    productionTurns: 1,
    hasTransformation: true,
  }),
});

/**
 * @param {string} commodityId
 */
export function getFactoryCommodity(commodityId) {
  return FACTORY_COMMODITIES[commodityId] ?? null;
}

export function listFactoryCommodities() {
  return Object.values(FACTORY_COMMODITIES);
}

export function listRawFactoryCommodities() {
  return listFactoryCommodities().filter((commodity) => commodity.kind === RAW);
}

export function listFinishedFactoryCommodities() {
  return listFactoryCommodities().filter((commodity) => commodity.kind === FINISHED);
}

/**
 * @param {string} resourceType
 * @returns {number}
 */
export function getFactoryMaxStorage(resourceType) {
  return getFactoryCommodity(resourceType)?.maxStorage ?? 200;
}

/**
 * @param {string} resourceType
 * @returns {number}
 */
export function getFactoryWorkerNeed(resourceType) {
  return getFactoryCommodity(resourceType)?.workerNeed ?? 2;
}

/**
 * @param {string} resourceType
 * @returns {string}
 */
export function getFactoryEmployeeRoleType(resourceType) {
  return getFactoryCommodity(resourceType)?.employeeRole ?? 'worker';
}

/**
 * Config mirror for employment UI — derived from FACTORY_COMMODITIES.
 */
export function buildFactoryEmployeeNeedsConfig() {
  return Object.freeze(
    Object.fromEntries(
      listFactoryCommodities().map((commodity) => [
        commodity.id,
        Object.freeze({
          worker_need: commodity.workerNeed,
          type: commodity.employeeRole,
        }),
      ])
    )
  );
}

/**
 * Config mirror for factory storage UI — derived from FACTORY_COMMODITIES.
 */
export function buildFactoryMaxStorageConfig() {
  return Object.freeze(
    Object.fromEntries(
      listFactoryCommodities().map((commodity) => [commodity.id, commodity.maxStorage])
    )
  );
}
