/** Dedicated supply channel for a factory or storage building. */
export const SUPPLY_FLOW = Object.freeze({
  CITY: 'city',
  COMMERCE: 'commerce',
});

export const SUPPLY_FLOW_VALUES = Object.freeze([
  SUPPLY_FLOW.CITY,
  SUPPLY_FLOW.COMMERCE,
]);

/**
 * @param {unknown} value
 * @returns {'city'|'commerce'}
 */
export function normalizeSupplyFlow(value) {
  return value === SUPPLY_FLOW.COMMERCE ? SUPPLY_FLOW.COMMERCE : SUPPLY_FLOW.CITY;
}

/**
 * @param {object|null|undefined} building
 * @returns {'city'|'commerce'}
 */
export function getBuildingSupplyFlow(building) {
  return normalizeSupplyFlow(building?.supplyFlow);
}

/**
 * Barn destination flow. Legacy barns (no `supplyFlow`) are commerce hubs;
 * factories use {@link getBuildingSupplyFlow} which defaults to city.
 *
 * @param {object|null|undefined} barn
 * @returns {'city'|'commerce'}
 */
export function getBarnSupplyFlow(barn) {
  return barn?.supplyFlow === SUPPLY_FLOW.CITY
    ? SUPPLY_FLOW.CITY
    : SUPPLY_FLOW.COMMERCE;
}

/**
 * @param {object|null|undefined} barn
 * @returns {boolean}
 */
export function isCommerceBarn(barn) {
  return getBarnSupplyFlow(barn) === SUPPLY_FLOW.COMMERCE;
}

/**
 * @param {object|null|undefined} barn
 * @returns {boolean}
 */
export function isCityBarn(barn) {
  return getBarnSupplyFlow(barn) === SUPPLY_FLOW.CITY;
}
