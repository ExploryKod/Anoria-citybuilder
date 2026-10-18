/**
 * What the closing of a month writes for the books (the opérations diverses, see PcgJournalCatalog): the variation of an account's stock and the
 * depreciation of the owner's constructions. Both are read from the journal and from the live figures, and each is written once per month.
 *
 * Sums are in centimes, so the figures are exact.
 */

import { accountKeyOf } from './AccountKeyPolicy.js';
import { isOperationDiverse, odLegsOf } from '../../../../shared/accounting-catalog/PcgJournalCatalog.js';

const toCentimes = (amount) => Math.round(amount * 100);

/** The words a construction line starts its description with, followed by the building's type (see PlaceBuildingWithPayment). */
const CONSTRUCTION_MARKER = 'Building: ';

/**
 * @param {{ description?: string }} line a `construction` line
 * @returns {string | null} the type of the building it paid for, null when the line does not say
 */
export function buildingTypeOfConstruction(line) {
  return typeof line.description === 'string' && line.description.startsWith(CONSTRUCTION_MARKER) ? line.description.slice(CONSTRUCTION_MARKER.length).trim() : null;
}

/**
 * What the books carry per building of the fixed assets (213), in centimes: the net of the opérations diverses that moved it (the contribution, the
 * disposal) and of the purged years' carried figures. Only a building with something left is in the map.
 * @param {Array<object>} entries the journal lines
 * @param {string} buildingId the owner
 * @param {string | null} accountKind
 * @returns {Map<string, number>}
 */
export function postedAssetsOf(entries, buildingId, accountKind) {
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  const posted = new Map();
  const add = (id, centimes) => posted.set(id, (posted.get(id) ?? 0) + centimes);
  for (const entry of entries) {
    if (accountKeyOf(entry) !== accountKey) continue;
    if (entry.type === 'year_closing') {
      for (const [id, amount] of Object.entries(entry.closing.assets ?? {})) add(id, toCentimes(amount));
    } else if (isOperationDiverse(entry.type) && entry.buildingInstanceId) {
      const { debit, credit } = odLegsOf(entry.type);
      if (debit === '213') add(entry.buildingInstanceId, toCentimes(entry.amount));
      else if (credit === '213') add(entry.buildingInstanceId, -toCentimes(entry.amount));
    }
  }
  return new Map([...posted].filter(([, centimes]) => centimes !== 0));
}

/**
 * What the closings already posted of an account's stock: the sum of its variations (the stock accounts, 37 and 35, debit minus credit).
 * @param {Array<{ type: string, amount: number, accountBuildingId: string | null, accountKind?: string | null }>} entries the journal lines
 * @param {string} buildingId
 * @param {string | null} accountKind
 * @returns {number} in centimes
 */
export function postedStockOf(entries, buildingId, accountKind) {
  const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
  let posted = 0;
  for (const entry of entries) {
    if (!isOperationDiverse(entry.type) || accountKeyOf(entry) !== accountKey) continue;
    const { debit, credit } = odLegsOf(entry.type);
    if (debit === '37' || debit === '35') posted += toCentimes(entry.amount);
    else if (credit === '37' || credit === '35') posted -= toCentimes(entry.amount);
  }
  return posted;
}

/**
 * The variation of stock to post: what the stock is worth now less what the closings posted so far. Nothing when it did not move.
 * @param {{ live: number, posted: number, nature: 'merchandise' | 'production' }} stock `live` and `posted` in centimes; `nature`: goods bought and resold, or goods made
 * @returns {{ type: string, amount: number } | null} `amount` in euros
 */
export function stockVariationOf({ live, posted, nature }) {
  if (nature !== 'merchandise' && nature !== 'production') throw new Error(`[closing] the stock of an account is of goods bought and resold or of goods made, got "${nature}"`);
  const delta = live - posted;
  if (delta === 0) return null;
  return { type: `od_stock_${delta > 0 ? 'up' : 'down'}_${nature}`, amount: Math.abs(delta) / 100 };
}

/**
 * What the owner's books must do, building by building, to follow the buildings it holds: one that is new to it is a contribution of the city (213 against
 * the capital); one that is gone leaves (its depreciation so far is released and what it was still worth is a loss). The books say what they carry per
 * building (`posted`, from the opérations diverses already written and the purged years' carried balances), the buildings say what they should.
 * A building that came and went between two closings was never in the books: nothing is written for it.
 * @param {{ closingKey: number, constructions: ReadonlyArray<{ buildingId: string, cost: number, builtKey: number, years: number, held: boolean }>, posted: ReadonlyMap<string, number> }} params
 *   months as `year × 12 + monthIndex`; `cost` in euros; `posted`: the fixed assets (213) the books carry per building, in centimes
 * @param {number} monthsPerYear
 * @returns {Array<{ buildingId: string, kind: 'contribution' | 'disposal', cost: number, released: number, loss: number }>} in centimes
 */
export function assetMovementsOf({ closingKey, constructions, posted }, monthsPerYear) {
  const movements = [];
  for (const { buildingId, cost, builtKey, years, held } of constructions) {
    const carried = posted.get(buildingId) ?? 0;
    if (held && carried === 0) {
      movements.push({ buildingId, kind: 'contribution', cost: toCentimes(cost), released: 0, loss: 0 });
    } else if (!held && carried > 0) {
      // What the building lost up to the previous closing, the one that last depreciated it.
      const life = years * monthsPerYear;
      const elapsed = Math.min(Math.max(closingKey - 1 - builtKey, 0), life);
      const released = Math.min(carried, Math.round((carried * elapsed) / life));
      movements.push({ buildingId, kind: 'disposal', cost: carried, released, loss: carried - released });
    }
  }
  return movements;
}

/**
 * The depreciation of the month: each building the owner holds loses its cost over its life, one dotation a month from the month after it was built, until it
 * is worth nothing.
 * @param {{ closingKey: number, constructions: ReadonlyArray<{ cost: number, builtKey: number, years: number }> }} params months as `year × 12 + monthIndex`;
 *   `cost` in euros; `years` the life of the building
 * @param {number} monthsPerYear
 * @returns {number} the month's dotation in centimes
 */
export function monthlyDepreciationOf({ closingKey, constructions }, monthsPerYear) {
  let dotation = 0;
  for (const { cost, builtKey, years } of constructions) {
    const elapsed = closingKey - builtKey;
    const life = years * monthsPerYear;
    if (elapsed >= 1 && elapsed <= life) dotation += toCentimes(cost) / life;
  }
  return Math.round(dotation);
}
