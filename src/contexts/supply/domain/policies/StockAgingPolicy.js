/**
 * How long a stock has been kept, and what has gone bad. A building holds each perishable good as batches, oldest first: `[bornTurn, amount]`
 * (the `stockAges` field of the building, one key per good, like `stocks`). The stock itself stays what it was: the batches are the breakdown of
 * it by age, brought in step with it at every pass (`reconcileAges`), so nothing that adds to or takes from a stock has to know about ages, except
 * a transfer from one building to another, which carries the age of what it moves (`takeOldestAges` then `addAges`).
 *
 * A good lives `shelfLifeMonths` (declared per good, `Infinity` for one that never goes bad), times the factor of the place it is kept (a granary, a
 * warehouse: `shelfLifeFactor` on its hub role). An infinite life stays infinite whatever the factor, and its stock is not aged at all.
 */

import { getShelfLifeMonths } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

const amountOf = (ages) => ages.reduce((sum, [, amount]) => sum + amount, 0);

/**
 * The life of a good in turns: its months in the calendar's days, times the factor of where it is kept.
 * @param {{ shelfLifeMonths: number, factor: number, daysPerMonth: number }} params
 * @returns {number} `Infinity` when the good never goes bad
 */
export function shelfLifeTurnsOf({ shelfLifeMonths, factor, daysPerMonth }) {
  if (!(shelfLifeMonths > 0)) throw new Error(`[shelf-life] a shelf life must be above 0 months (or Infinity), got ${shelfLifeMonths}`);
  if (!Number.isFinite(factor) || factor <= 0) throw new Error(`[shelf-life] a shelf life factor must be above 0, got ${factor}`);
  if (!Number.isInteger(daysPerMonth) || daysPerMonth <= 0) throw new Error(`[shelf-life] days per month must be a whole number above 0, got ${daysPerMonth}`);
  return shelfLifeMonths === Infinity ? Infinity : shelfLifeMonths * factor * daysPerMonth;
}

/**
 * Brings the batches in step with the stock: units the batches do not account for are born now, units they overshoot are the oldest ones, gone.
 * @param {ReadonlyArray<[number, number]> | undefined} ages
 * @param {number} stockAmount what the building holds of the good
 * @param {number} turn
 * @returns {Array<[number, number]>}
 */
export function reconcileAges(ages, stockAmount, turn) {
  const stock = Math.max(0, Math.floor(Number(stockAmount) || 0));
  const batches = (ages ?? []).map(([born, amount]) => [born, amount]);
  let overshoot = amountOf(batches) - stock;
  while (overshoot > 0) {
    const oldest = batches[0];
    const cut = Math.min(oldest[1], overshoot);
    oldest[1] -= cut;
    overshoot -= cut;
    if (oldest[1] === 0) batches.shift();
  }
  const missing = stock - amountOf(batches);
  return missing > 0 ? addAges(batches, [[turn, missing]]) : batches;
}

/**
 * Splits off the `amount` oldest units: what a transfer carries, and what stays.
 * @param {ReadonlyArray<[number, number]> | undefined} ages
 * @param {number} amount
 * @returns {{ taken: Array<[number, number]>, rest: Array<[number, number]> }}
 */
export function takeOldestAges(ages, amount) {
  const rest = (ages ?? []).map(([born, units]) => [born, units]);
  const taken = [];
  let remaining = Math.max(0, Math.floor(Number(amount) || 0));
  while (remaining > 0 && rest.length > 0) {
    const oldest = rest[0];
    const cut = Math.min(oldest[1], remaining);
    taken.push([oldest[0], cut]);
    oldest[1] -= cut;
    remaining -= cut;
    if (oldest[1] === 0) rest.shift();
  }
  return { taken, rest };
}

/**
 * Adds batches to a list, oldest first, the batches born the same turn merged.
 * @param {ReadonlyArray<[number, number]> | undefined} ages
 * @param {ReadonlyArray<[number, number]>} batches
 * @returns {Array<[number, number]>}
 */
export function addAges(ages, batches) {
  const byTurn = new Map();
  for (const [born, amount] of [...(ages ?? []), ...batches]) byTurn.set(born, (byTurn.get(born) ?? 0) + amount);
  return [...byTurn.entries()].sort(([a], [b]) => a - b);
}

/**
 * The batches of both sides after `amount` units pass from one building to another: the oldest units go, and keep their age.
 * Each side's batches are first brought in step with the stock it held before the move.
 * @param {{ from: { ages: ReadonlyArray<[number, number]> | undefined, stock: number }, to: { ages: ReadonlyArray<[number, number]> | undefined, stock: number }, amount: number, turn: number }} params
 * @returns {{ from: Array<[number, number]>, to: Array<[number, number]> }}
 */
export function moveAges({ from, to, amount, turn }) {
  const { taken, rest } = takeOldestAges(reconcileAges(from.ages, from.stock, turn), amount);
  return { from: rest, to: addAges(reconcileAges(to.ages, to.stock, turn), taken) };
}

/**
 * The `stockAges` of both buildings after `amount` units of one good pass from one to the other (see `moveAges`). A good that never goes bad is
 * not aged: both books come back as they were.
 * @param {{ category: string, amount: number, turn: number, from: { book: Record<string, Array<[number, number]>> | undefined, stock: number }, to: { book: Record<string, Array<[number, number]>> | undefined, stock: number } }} params
 * @returns {{ from: Record<string, Array<[number, number]>> | undefined, to: Record<string, Array<[number, number]>> | undefined }}
 */
export function movedAgeBooks({ category, amount, turn, from, to }) {
  if (getShelfLifeMonths(category) === Infinity) return { from: from.book, to: to.book };
  if (!Number.isFinite(turn)) throw new Error(`[shelf-life] a transfer of ${category} needs the turn to date the age of what it moves, got ${turn}`);
  const moved = moveAges({ from: { ages: from.book?.[category], stock: from.stock }, to: { ages: to.book?.[category], stock: to.stock }, amount, turn });
  return { from: { ...from.book, [category]: moved.from }, to: { ...to.book, [category]: moved.to } };
}

/**
 * What is left of the life of each batch, oldest first: what a screen shows the player.
 * @param {{ ages: ReadonlyArray<[number, number]> | undefined, turn: number, lifeTurns: number }} params
 * @returns {Array<{ amount: number, remainingTurns: number }>} empty for a good that never goes bad
 */
export function remainingLifeOf({ ages, turn, lifeTurns }) {
  if (lifeTurns === Infinity) return [];
  return (ages ?? []).map(([born, amount]) => ({ amount, remainingTurns: Math.max(0, lifeTurns - (turn - born)) }));
}

/**
 * Throws away the batches that outlived their life.
 * @param {ReadonlyArray<[number, number]>} ages
 * @param {number} turn
 * @param {number} lifeTurns from `shelfLifeTurnsOf`
 * @returns {{ kept: Array<[number, number]>, lost: number }}
 */
export function expireAges(ages, turn, lifeTurns) {
  const kept = [];
  let lost = 0;
  for (const [born, amount] of ages) {
    if (turn - born >= lifeTurns) lost += amount;
    else kept.push([born, amount]);
  }
  return { kept, lost };
}
