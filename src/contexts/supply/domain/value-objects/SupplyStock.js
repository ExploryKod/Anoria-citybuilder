import { createResourceStock, nonNegInt } from './ResourceStock.js';
import { getResourceStockShape } from '../policies/ResourceRolePolicy.js';

/**
 * The generic ResourceStock mechanic, instantiated with this catalog's own
 * category list and total key (see ResourceRolePolicy.getResourceStockShape)
 * instead of a hand-picked, resource-named list.
 *
 * Every OTHER aggregate the catalog declares rides along untouched:
 * createResourceStock only syncs the one total it is handed, so a second
 * good's total (a warehouse's capacity, say) would silently vanish from the
 * row on the next read — the same drop-on-read bug already fixed for
 * `servedFlags`, the hub link fields and `lastConsumption`. They are
 * PRESERVED, never recomputed from the categories: a hub deliberately caps
 * its own total below their sum (see CollectResourceToHub), and recomputing
 * here would quietly undo that cap.
 *
 * @param {Record<string, number>} [raw]
 * @returns {Readonly<Record<string, number>>}
 */
export function createSupplyStock(raw = {}) {
  const { categories, totalKey, totalKeys } = getResourceStockShape();
  const stock = createResourceStock(raw, categories, totalKey);

  const otherTotals = {};
  for (const key of totalKeys) {
    if (key === totalKey) continue;
    otherTotals[key] = nonNegInt(raw?.[key]);
  }

  return Object.freeze({ ...stock, ...otherTotals });
}
