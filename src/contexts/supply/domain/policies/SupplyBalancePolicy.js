import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getQuantityConsumerEntries } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getShelfLifeMonths } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { monthlyUnitsOf } from './StandardUnitCostPolicy.js';

/**
 * Whether the city makes what its citizens use up, for one need (what they eat, the goods they wear out, their heat, their light): what the producers make
 * in a year at full staffing against what the citizens use in a year, and how many producer buildings are missing to close the gap. Every figure comes from
 * the catalog and the buildings standing now, never from the transactions logged.
 */

/**
 * The units a producer role makes in a year at full staffing (see `monthlyUnitsOf`).
 * @param {object} entry the producer role
 * @returns {number}
 */
export function yearlyUnitsOf(entry) {
  return monthlyUnitsOf(entry) * MONTHS_PER_YEAR;
}

/**
 * What a new building adds to the need: the average yearly yield of the producer types the catalog declares for those goods.
 * @param {ReadonlyArray<string>} categories the goods of the need
 * @returns {number}
 */
export function declaredYearlyYield(categories) {
  const yields = [];
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (entry.role === 'producer' && entry.categories.some((category) => categories.includes(category))) yields.push(yearlyUnitsOf(entry));
    }
  }
  if (yields.length === 0) throw new Error(`[supply] no producer is declared for ${categories.join('/')}: the balance of that need cannot say how many are missing`);
  return yields.reduce((sum, units) => sum + units, 0) / yields.length;
}

/**
 * @param {ReadonlyArray<{ type: string, pop?: number }>} consumers the buildings that use the need up
 * @param {ReadonlyArray<string>} categories the goods of the need
 * @returns {number} the units the citizens use up in a year
 */
export function yearlyDemandOf(consumers, categories) {
  return consumers.reduce((sum, consumer) => {
    const entry = getQuantityConsumerEntries(consumer.type).find((role) => role.categories.some((category) => categories.includes(category)));
    return entry ? sum + (consumer.pop ?? 0) * entry.amount * MONTHS_PER_YEAR : sum;
  }, 0);
}

/**
 * @param {object} params
 * @param {number} params.demand units used up in a year
 * @param {number} params.capacity units the working producers make in a year
 * @param {number} params.yieldPerBuilding units one more producer building adds in a year
 * @returns {{ demand: number, capacity: number, judged: boolean, shortfall: number, buildingsMissing: number, surplus: number }}
 */
export function supplyBalanceOf({ demand, capacity, yieldPerBuilding }) {
  if (!Number.isFinite(demand) || demand < 0) throw new Error(`[supply] the yearly demand must be a number of at least 0, got ${demand}`);
  if (!Number.isFinite(capacity) || capacity < 0) throw new Error(`[supply] the yearly capacity must be a number of at least 0, got ${capacity}`);
  if (!(yieldPerBuilding > 0)) throw new Error(`[supply] a producer building must add something in a year, got ${yieldPerBuilding}`);
  // Nothing is judged while there is no one to supply: a producer placed before its houses are lived in has nothing to complain about yet.
  if (!(demand > 0)) return { demand, capacity, judged: false, shortfall: 0, buildingsMissing: 0, surplus: 0 };
  const shortfall = Math.max(0, demand - capacity);
  return {
    demand,
    capacity,
    judged: true,
    shortfall,
    buildingsMissing: Math.ceil(shortfall / yieldPerBuilding),
    surplus: Math.max(0, capacity - demand),
  };
}

/**
 * A good that has working producers but that nobody bought in a whole year: its harvest stays where it grew and goes bad. Not judged before a year of history,
 * since a harvest may simply not have come yet.
 * @param {{ working: number, collected: number, months: number }} params months of history the figures cover
 * @returns {boolean}
 */
export function neverCollected({ working, collected, months }) {
  return months >= MONTHS_PER_YEAR && working > 0 && !(collected > 0);
}

/**
 * What the chain of a need says: `missing` when the producers standing cannot make enough even in theory, `leaking` when they can but part of what they make does not reach
 * the citizens (a good nobody collects, units lost to spoilage), `ok` otherwise, `idle` when there is no one to supply yet.
 * @param {{ judged: boolean, buildingsMissing: number, goods: ReadonlyArray<{ neverCollected: boolean, spoiled: number }> }} params
 * @returns {'idle' | 'missing' | 'leaking' | 'ok'}
 */
export function chainVerdictOf({ judged, buildingsMissing, goods }) {
  if (!judged) return 'idle';
  if (buildingsMissing > 0) return 'missing';
  return goods.some((good) => good.neverCollected || good.spoiled > 0) ? 'leaking' : 'ok';
}

/**
 * The calendar the catalog declares for a seasonal good: when it is harvested, when it is sold on, how long it keeps in the field and in a store. Null for a good that is not harvested
 * in a season (a good made every month has no calendar to tell).
 * @param {string} category
 * @returns {{ harvest: object, sale: object | null, keepsMonths: number | null, keepsInStoreMonths: number | null } | null}
 */
export function declaredCalendarOf(category) {
  let producer = null;
  let store = null;
  for (const definition of Object.values(buildingCatalog)) {
    for (const entry of definition.resourceRoles ?? []) {
      if (!entry.categories.includes(category)) continue;
      if (!producer && entry.role === 'producer' && entry.schedule?.unit === 'season') producer = entry;
      if (!store && entry.role === 'hub') store = entry;
    }
  }
  if (!producer) return null;
  const keepsMonths = getShelfLifeMonths(category);
  return {
    harvest: producer.schedule,
    sale: producer.sale?.schedule ?? null,
    keepsMonths: Number.isFinite(keepsMonths) ? keepsMonths : null,
    keepsInStoreMonths: Number.isFinite(keepsMonths) ? keepsMonths * (store?.shelfLifeFactor ?? 1) : null,
  };
}
