import { createResourceStock } from './ResourceStock.js';
import { getResourceStockShape } from '../policies/ResourceRolePolicy.js';

/**
 * The generic ResourceStock mechanic, instantiated with this catalog's own
 * category list and total key (see ResourceRolePolicy.getResourceStockShape)
 * instead of a hand-picked, resource-named list.
 *
 * @param {Record<string, number>} [raw]
 * @returns {Readonly<Record<string, number>>}
 */
export function createSupplyStock(raw = {}) {
  const { categories, totalKey } = getResourceStockShape();
  return createResourceStock(raw, categories, totalKey);
}
